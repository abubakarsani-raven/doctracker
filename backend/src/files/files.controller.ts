import { Controller, Get, Post, Put, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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
  async getFolder(@Param('id') id: string) {
    return this.filesService.getFolder(id);
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
  async getFile(@Param('id') id: string) {
    return this.filesService.getFile(id);
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
