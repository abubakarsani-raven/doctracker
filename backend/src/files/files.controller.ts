import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  Response,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response as ExpressResponse } from 'express';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsService } from '../permissions/permissions.service';
import { RequireCapability, CapabilityGuard } from '../permissions/require-capability.decorator';
import { ActivityService } from '../activity/activity.service';
import { assertAllowedUpload } from './upload-allowlist';
import * as multer from 'multer';
import * as path from 'path';
import * as crypto from 'crypto';

@Controller('files')
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly permissionsService: PermissionsService,
    private readonly activityService: ActivityService,
  ) {}

  // Folders routes must come before :id route
  @Get('folders')
  @RequireCapability('documents.view')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async getFolders(
    @Request() req: any,
    @Query('companyId') companyId?: string,
    @Query('parentId') parentId?: string,
    @Query('includeDeleted') includeDeleted?: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    try {
      const seesAll = req.user?.permissions?.dataScope === 'all';
      const userCompanyId = companyId || req.user?.companyId || null;
      if (!userCompanyId && !seesAll) {
        return [];
      }
      const folders = await this.filesService.getFolders(
        userCompanyId, 
        parentId,
        includeDeleted === 'true',
        includeArchived === 'true',
      );
      
      // Annotate rather than filter. A folder the user cannot open still has to
      // be visible, otherwise they cannot discover it exists and request
      // access to it — the request flow would be unreachable.
      return await this.permissionsService.annotateAccess(
        req.user.id,
        'folder',
        folders,
      );
    } catch (error: any) {
      console.error('[FilesController] Error getting folders:', error);
      throw error;
    }
  }

  @Get('folders/:id')
  @RequireCapability('documents.view')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async getFolder(@Param('id') id: string, @Request() req: any) {
    // Openable, not readable: being granted one file inside is enough to open
    // the folder. Its contents are then narrowed to what the user may read.
    if (!(await this.permissionsService.canOpenFolder(req.user.id, id))) {
      await this.permissionsService.assertPermission(req.user.id, 'folder', id, 'read');
    }

    const folder = await this.filesService.getFolder(id, req.user);
    if (!folder) return folder;

    const links = (folder as any).fileFolderLinks ?? [];
    const readableFiles = await this.permissionsService.filterReadable(
      req.user.id,
      'file',
      links.map((link: any) => link.file).filter(Boolean),
    );
    const readableIds = new Set(readableFiles.map((f: any) => f.id));

    return {
      ...folder,
      fileFolderLinks: links.filter((link: any) => readableIds.has(link.file?.id)),
      access: {
        canRead: await this.permissionsService.checkPermission(
          req.user.id,
          'folder',
          id,
          'read',
        ),
      },
    };
  }

  @Post('folders')
  @RequireCapability('folders.create')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async createFolder(
    @Request() req: any,
    @Body() body: {
      name: string;
      description?: string;
      scopeLevel: string;
      parentFolderId?: string;
      departmentId?: string;
      divisionId?: string;
      companyId?: string;
    },
  ) {
    const user = req.user;
    const seesAll = user?.permissions?.dataScope === 'all';
    const companyId =
      (seesAll && body.companyId) || user?.companyId || null;
    if (!user || !companyId) {
      throw new BadRequestException(
        'companyId is required (pass it when creating folders as Master)',
      );
    }

    if (body.parentFolderId) {
      await this.permissionsService.assertPermission(
        user.id,
        'folder',
        body.parentFolderId,
        'write',
      );
    }

    return this.filesService.createFolder({
      name: body.name,
      description: body.description,
      scopeLevel: body.scopeLevel,
      companyId,
      parentFolderId: body.parentFolderId,
      departmentId: body.departmentId,
      divisionId: body.divisionId,
      createdBy: user.id,
    });
  }

  @Get()
  @RequireCapability('documents.view')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async getFiles(
    @Request() req: any, 
    @Query('companyId') companyId?: string,
    @Query('includeDeleted') includeDeleted?: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    try {
      const seesAll = req.user?.permissions?.dataScope === 'all';
      // Prefer explicit company filter; otherwise home company. Masters without
      // a companyId query see nothing useful unless they pass one.
      const userCompanyId = companyId || req.user?.companyId || null;
      if (!userCompanyId && !seesAll) {
        return [];
      }
      const files = await this.filesService.getFiles(
        userCompanyId,
        includeDeleted === 'true',
        // Default: exclude archived unless client asks for them.
        includeArchived === 'true',
      );
      
      // Filter files by permissions
      return await this.permissionsService.filterReadable(req.user.id, 'file', files);
    } catch (error: any) {
      console.error('[FilesController] Error getting files:', error);
      throw error;
    }
  }

  @Get('search')
  @RequireCapability('documents.view')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async searchFiles(
    @Request() req: any,
    @Query('q') query: string,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @Query('companyId') companyId?: string,
  ) {
    if (!query) {
      return { items: [], total: 0 };
    }

    const seesAll = req.user?.permissions?.dataScope === 'all';
    const targetCompanyId = companyId || req.user?.companyId;
    if (!targetCompanyId) {
      if (seesAll) {
        throw new BadRequestException(
          'companyId is required when searching as an instance-scoped user',
        );
      }
      return { items: [], total: 0 };
    }

    if (
      !seesAll &&
      companyId &&
      companyId !== req.user.companyId
    ) {
      throw new BadRequestException('Cannot search another company');
    }

    return this.filesService.searchFiles(
      targetCompanyId,
      req.user,
      query,
      skip ? parseInt(skip.toString()) : 0,
      take ? parseInt(take.toString()) : 50,
    );
  }

  @Get(':id')
  @RequireCapability('documents.view')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async getFile(@Param('id') id: string, @Request() req: any) {
    // Reading a single document by id has to be authorised here: without it,
    // knowing an id was enough to read another company's record.
    await this.permissionsService.assertPermission(req.user.id, 'file', id, 'read');
    return this.filesService.getFile(id, req.user);
  }

  @Post()
  @RequireCapability('documents.create')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async createFile(
    @Request() req: any,
    @Body() body: {
      fileName: string;
      fileType: string;
      scopeLevel: string;
      folderId?: string;
      departmentId?: string;
      divisionId?: string;
      companyId?: string;
    },
  ) {
    const user = req.user;
    const seesAll = user?.permissions?.dataScope === 'all';
    const companyId =
      (seesAll && body.companyId) || user?.companyId || null;
    if (!user || !companyId) {
      throw new BadRequestException(
        'companyId is required (pass it when creating as Master)',
      );
    }

    if (body.folderId) {
      await this.permissionsService.assertPermission(
        user.id,
        'folder',
        body.folderId,
        'write',
      );
    }

    // Never accept a client-supplied storage path — use /files/upload for bytes.
    const storagePath = `pending://${crypto.randomUUID()}`;

    return this.filesService.createFile({
      fileName: body.fileName,
      fileType: body.fileType,
      storagePath,
      scopeLevel: body.scopeLevel,
      companyId,
      folderId: body.folderId,
      departmentId: body.departmentId,
      divisionId: body.divisionId,
      createdBy: user.id,
    });
  }

  @Post('upload')
  @RequireCapability('documents.create')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
      },
    }),
  )
  async uploadFile(
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const user = req.user;
    const seesAll = user?.permissions?.dataScope === 'all';
    const companyId =
      (seesAll && req.body.companyId) || user?.companyId || null;
    if (!user || !companyId) {
      throw new BadRequestException(
        'companyId is required (pass it when uploading as Master)',
      );
    }

    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Validate file type
    assertAllowedUpload(file.originalname, file.mimetype);

    // Get form data from request body (multer puts non-file fields in req.body)
    const scopeLevel = req.body.scopeLevel || 'company';
    // An optional display name, so a scan called "SCAN_0042.pdf" can be filed
    // as something a person will recognise. The extension is preserved.
    const displayName = resolveDisplayName(req.body.fileName, file.originalname);
    const folderId = req.body.folderId;
    const departmentId = req.body.departmentId;
    const divisionId = req.body.divisionId;

    if (folderId) {
      await this.permissionsService.assertPermission(
        user.id,
        'folder',
        folderId,
        'write',
      );
    }

    // Generate file ID first
    const fileId = crypto.randomUUID();

    // Upload to object storage
    const storagePath = await this.filesService.uploadToStorage(
      file.buffer,
      companyId,
      fileId,
      file.originalname,
      file.mimetype
    );

    const createdFile = await this.filesService.createFile({
      fileName: displayName,
      fileType: path.extname(file.originalname).slice(1) || 'unknown',
      storagePath,
      scopeLevel,
      companyId,
      folderId,
      departmentId,
      divisionId,
      createdBy: user.id,
      fileSize: file.size,
    });

    return createdFile;
  }

  @Post('rich-text')
  @RequireCapability('documents.create')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async createRichTextDocument(
    @Request() req: any,
    @Body() body: {
      fileName: string;
      htmlContent: string;
      scopeLevel: string;
      folderId: string;
      departmentId?: string;
      divisionId?: string;
      companyId?: string;
    },
  ) {
    const user = req.user;
    const seesAll = user?.permissions?.dataScope === 'all';
    const companyId =
      (seesAll && body.companyId) || user?.companyId || null;
    if (!user || !companyId) {
      throw new BadRequestException(
        'companyId is required (pass it when creating documents as Master)',
      );
    }

    return this.filesService.createRichTextDocument({
      fileName: body.fileName,
      htmlContent: body.htmlContent,
      scopeLevel: body.scopeLevel,
      companyId,
      folderId: body.folderId,
      departmentId: body.departmentId,
      divisionId: body.divisionId,
      createdBy: user.id,
    });
  }

  @Put('rich-text/:id')
  @RequireCapability('documents.edit')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async updateRichTextDocument(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: {
      htmlContent: string;
    },
  ) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    await this.permissionsService.assertPermission(req.user.id, 'file', id, 'write');
    return this.filesService.updateRichTextDocument(id, body.htmlContent, user.id);
  }

  @Get(':id/versions')
  @RequireCapability('documents.view')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async getFileVersions(@Param('id') id: string, @Request() req: any) {
    await this.permissionsService.assertPermission(req.user.id, 'file', id, 'read');
    return this.filesService.getFileVersions(id);
  }

  @Post(':id/versions')
  @RequireCapability('documents.edit')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 50 * 1024 * 1024,
      },
    }),
  )
  async uploadFileVersion(
    @Request() req: any,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { changeNote?: string },
  ) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    assertAllowedUpload(file.originalname, file.mimetype);
    await this.permissionsService.assertPermission(req.user.id, 'file', id, 'write');

    const existing = await this.filesService.getFile(id, user);
    const storagePath = await this.filesService.uploadToStorage(
      file.buffer,
      existing.companyId,
      id,
      file.originalname,
      file.mimetype,
    );

    return this.filesService.uploadFileVersion(
      id,
      storagePath,
      user.id,
      file.size,
      file.originalname,
      body?.changeNote,
    );
  }

  @Post(':id/versions/:versionId/restore')
  @RequireCapability('documents.edit')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async restoreFileVersion(
    @Request() req: any,
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    await this.permissionsService.assertPermission(req.user.id, 'file', id, 'write');
    return this.filesService.restoreFileVersion(id, versionId, user.id);
  }

  // -------------------------------------------------------------------------
  // Download Endpoints
  // -------------------------------------------------------------------------

  @Get(':id/download')
  @RequireCapability('documents.view')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async downloadFile(
    @Param('id') id: string,
    @Request() req: any,
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    await this.permissionsService.assertPermission(req.user.id, 'file', id, 'read');
    
    const file = await this.filesService.getFile(id, req.user);
    
    // Skip download for rich-text-content:// paths
    if (file.storagePath.startsWith('rich-text-content://')) {
      throw new BadRequestException('Rich text documents cannot be downloaded as files');
    }

    try {
      const fileStream = await this.filesService.getFileStream(file.storagePath);
      const metadata = await this.filesService.getFileMetadata(file.storagePath);
      
      // Set headers — sanitize filename to avoid header injection
      const safeName = String(file.fileName || 'download')
        .replace(/[\r\n"]/g, '_')
        .slice(0, 200);
      res.set({
        'Content-Type': metadata.contentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeName}"`,
        'Content-Length': metadata.contentLength?.toString(),
      });

      // Log download activity
      try {
        await this.activityService.createActivity({
          userId: req.user.id,
          companyId: file.companyId,
          activityType: 'document_downloaded',
          resourceType: 'document',
          resourceId: id,
          description: `Document "${file.fileName}" was downloaded`,
        });
      } catch (error) {
        console.error('Failed to log download activity:', error);
      }

      return new StreamableFile(fileStream);
    } catch (error) {
      console.error('Error downloading file:', error);
      throw new BadRequestException('File could not be downloaded');
    }
  }

  @Get(':id/versions/:versionId/download')
  @RequireCapability('documents.view')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async downloadFileVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @Request() req: any,
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    await this.permissionsService.assertPermission(req.user.id, 'file', id, 'read');
    
    const versions = await this.filesService.getFileVersions(id);
    const version = versions.find(v => v.id === versionId);
    
    if (!version) {
      throw new BadRequestException('Version not found');
    }

    // Skip download for rich-text-content:// paths
    if (version.storagePath.startsWith('rich-text-content://')) {
      throw new BadRequestException('Rich text document versions cannot be downloaded as files');
    }

    try {
      const fileStream = await this.filesService.getFileStream(version.storagePath);
      const metadata = await this.filesService.getFileMetadata(version.storagePath);
      
      const file = await this.filesService.getFile(id, req.user);
      const versionFileName = `${path.parse(file.fileName).name}_v${version.versionNumber}${path.extname(file.fileName)}`
        .replace(/[\r\n"]/g, '_')
        .slice(0, 200);
      
      // Set headers
      res.set({
        'Content-Type': metadata.contentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${versionFileName}"`,
        'Content-Length': metadata.contentLength?.toString(),
      });

      return new StreamableFile(fileStream);
    } catch (error) {
      console.error('Error downloading file version:', error);
      throw new BadRequestException('File version could not be downloaded');
    }
  }

  // -------------------------------------------------------------------------
  // File CRUD Operations
  // -------------------------------------------------------------------------

  @Patch(':id/rename')
  @RequireCapability('documents.edit')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async renameFile(
    @Param('id') id: string,
    @Body() body: { fileName: string },
    @Request() req: any,
  ) {
    if (!body.fileName || !body.fileName.trim()) {
      throw new BadRequestException('File name is required');
    }

    await this.permissionsService.assertPermission(req.user.id, 'file', id, 'write');
    return this.filesService.renameFile(id, body.fileName.trim(), req.user.id);
  }

  @Post(':id/archive')
  @RequireCapability('documents.edit')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async archiveFile(@Param('id') id: string, @Request() req: any) {
    await this.permissionsService.assertPermission(req.user.id, 'file', id, 'write');
    return this.filesService.archiveFile(id, req.user.id);
  }

  @Post(':id/unarchive')
  @RequireCapability('documents.edit')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async unarchiveFile(@Param('id') id: string, @Request() req: any) {
    await this.permissionsService.assertPermission(req.user.id, 'file', id, 'write');
    return this.filesService.unarchiveFile(id, req.user.id);
  }

  @Delete(':id')
  @RequireCapability('documents.delete')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async deleteFile(@Param('id') id: string, @Request() req: any) {
    await this.permissionsService.assertPermission(req.user.id, 'file', id, 'delete');
    return this.filesService.softDeleteFile(id, req.user.id);
  }

  @Post(':id/restore')
  @RequireCapability('documents.edit')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async restoreFile(@Param('id') id: string, @Request() req: any) {
    await this.permissionsService.assertPermission(req.user.id, 'file', id, 'write');
    return this.filesService.restoreFile(id, req.user.id);
  }

  @Post(':id/move')
  @RequireCapability('documents.edit')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async moveFile(
    @Param('id') id: string,
    @Body() body: { folderId: string },
    @Request() req: any,
  ) {
    if (!body.folderId) {
      throw new BadRequestException('Folder ID is required');
    }

    await this.permissionsService.assertPermission(req.user.id, 'file', id, 'write');
    await this.permissionsService.assertPermission(
      req.user.id,
      'folder',
      body.folderId,
      'write',
    );
    return this.filesService.moveFile(id, body.folderId, req.user.id);
  }

  // -------------------------------------------------------------------------
  // Folder CRUD Operations
  // -------------------------------------------------------------------------

  @Patch('folders/:id')
  @RequireCapability('folders.edit')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async updateFolder(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string },
    @Request() req: any,
  ) {
    if (!body.name && body.description === undefined) {
      throw new BadRequestException('Name or description must be provided');
    }

    await this.permissionsService.assertPermission(req.user.id, 'folder', id, 'write');
    return this.filesService.updateFolder(id, body, req.user.id);
  }

  @Post('folders/:id/archive')
  @RequireCapability('folders.edit')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async archiveFolder(@Param('id') id: string, @Request() req: any) {
    await this.permissionsService.assertPermission(req.user.id, 'folder', id, 'write');
    return this.filesService.archiveFolder(id, req.user.id);
  }

  @Delete('folders/:id')
  @RequireCapability('folders.delete')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async deleteFolder(@Param('id') id: string, @Request() req: any) {
    await this.permissionsService.assertPermission(req.user.id, 'folder', id, 'delete');
    return this.filesService.softDeleteFolder(id, req.user.id);
  }
}

/**
 * Combine a user-supplied name with the uploaded file's real extension.
 *
 * The extension comes from the actual upload, never from the typed name — it is
 * what the allowlist validated and what the browser will use to open the file.
 */
function resolveDisplayName(requested: unknown, originalName: string): string {
  const extension = path.extname(originalName);

  if (typeof requested !== 'string' || !requested.trim()) {
    return originalName;
  }

  // Strip any path separators a name could smuggle in, and drop a duplicate
  // extension if the user typed one.
  const cleaned = requested
    .trim()
    .replace(/[/\\]/g, '-')
    .replace(new RegExp(`${extension.replace('.', '\\.')}$`, 'i'), '')
    .trim();

  if (!cleaned) return originalName;

  return `${cleaned.slice(0, 180)}${extension}`;
}
