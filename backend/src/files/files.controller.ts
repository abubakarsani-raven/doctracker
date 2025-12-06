import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import * as multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  // Folders routes must come before :id route
  @Get('folders')
  async getFolders(
    @Request() req: any,
    @Query('companyId') companyId?: string,
    @Query('parentId') parentId?: string,
  ) {
    // Use user's company if not specified
    const userCompanyId = req.user?.companyId || companyId;
    return this.filesService.getFolders(userCompanyId, parentId);
  }

  @Get('folders/:id')
  async getFolder(@Param('id') id: string, @Request() req: any) {
    return this.filesService.getFolder(id, req.user);
  }

  @Post('folders')
  async createFolder(
    @Request() req: any,
    @Body() body: {
      name: string;
      description?: string;
      scopeLevel: string;
      parentFolderId?: string;
      departmentId?: string;
      divisionId?: string;
    },
  ) {
    const user = req.user;
    if (!user || !user.companyId) {
      throw new Error('User company not found');
    }

    return this.filesService.createFolder({
      name: body.name,
      description: body.description,
      scopeLevel: body.scopeLevel,
      companyId: user.companyId,
      parentFolderId: body.parentFolderId,
      departmentId: body.departmentId,
      divisionId: body.divisionId,
      createdBy: user.id,
    });
  }

  @Get()
  async getFiles(@Request() req: any, @Query('companyId') companyId?: string) {
    // Use user's company if not specified
    const userCompanyId = req.user?.companyId || companyId;
    return this.filesService.getFiles(userCompanyId);
  }

  @Get(':id')
  async getFile(@Param('id') id: string, @Request() req: any) {
    return this.filesService.getFile(id, req.user);
  }

  @Post()
  async createFile(
    @Request() req: any,
    @Body() body: {
      fileName: string;
      fileType: string;
      storagePath?: string;
      scopeLevel: string;
      folderId?: string;
      departmentId?: string;
      divisionId?: string;
    },
  ) {
    const user = req.user;
    if (!user || !user.companyId) {
      throw new Error('User company not found');
    }

    return this.filesService.createFile({
      fileName: body.fileName,
      fileType: body.fileType,
      storagePath: body.storagePath || `/storage/${user.companyId}/${body.fileName}`,
      scopeLevel: body.scopeLevel,
      companyId: user.companyId,
      folderId: body.folderId,
      departmentId: body.departmentId,
      divisionId: body.divisionId,
      createdBy: user.id,
    });
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.diskStorage({
        destination: (req, file, cb) => {
          const user = (req as any).user;
          const uploadPath = path.join(process.cwd(), 'uploads', user?.companyId || 'default');
          // Create directory if it doesn't exist
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${uniqueSuffix}-${file.originalname}`);
        },
      }),
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
    if (!user || !user.companyId) {
      throw new Error('User company not found');
    }

    if (!file) {
      throw new Error('No file uploaded');
    }

    // Get form data from request body (multer puts non-file fields in req.body)
    const scopeLevel = req.body.scopeLevel || 'company';
    const folderId = req.body.folderId;
    const departmentId = req.body.departmentId;
    const divisionId = req.body.divisionId;

    const relativePath = path.join('uploads', user.companyId, file.filename);
    const fileSize = file.size;

    const createdFile = await this.filesService.createFile({
      fileName: file.originalname,
      fileType: path.extname(file.originalname).slice(1) || 'unknown',
      storagePath: relativePath,
      scopeLevel,
      companyId: user.companyId,
      folderId,
      departmentId,
      divisionId,
      createdBy: user.id,
      fileSize,
    });

    return createdFile;
  }

  @Post('rich-text')
  async createRichTextDocument(
    @Request() req: any,
    @Body() body: {
      fileName: string;
      htmlContent: string;
      scopeLevel: string;
      folderId: string;
      departmentId?: string;
      divisionId?: string;
    },
  ) {
    const user = req.user;
    if (!user || !user.companyId) {
      throw new Error('User company not found');
    }

    return this.filesService.createRichTextDocument({
      fileName: body.fileName,
      htmlContent: body.htmlContent,
      scopeLevel: body.scopeLevel,
      companyId: user.companyId,
      folderId: body.folderId,
      departmentId: body.departmentId,
      divisionId: body.divisionId,
      createdBy: user.id,
    });
  }

  @Put('rich-text/:id')
  async updateRichTextDocument(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: {
      htmlContent: string;
    },
  ) {
    const user = req.user;
    if (!user) {
      throw new Error('User not authenticated');
    }

    return this.filesService.updateRichTextDocument(id, body.htmlContent, user.id);
  }

  @Get(':id/versions')
  async getFileVersions(@Param('id') id: string) {
    return this.filesService.getFileVersions(id);
  }

  @Post(':id/versions')
  async uploadFileVersion(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: {
      storagePath: string;
      fileName: string;
      fileType: string;
    },
  ) {
    const user = req.user;
    if (!user) {
      throw new Error('User not authenticated');
    }

    return this.filesService.uploadFileVersion(id, body.storagePath, user.id);
  }

  @Post(':id/versions/:versionId/restore')
  async restoreFileVersion(
    @Request() req: any,
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    const user = req.user;
    if (!user) {
      throw new Error('User not authenticated');
    }

    return this.filesService.restoreFileVersion(id, versionId, user.id);
  }
}
