import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('permissions')
@UseGuards(JwtAuthGuard)
export class PermissionsController {
  constructor(private permissionsService: PermissionsService) {}

  @Get('folder/:id')
  async getFolderPermissions(@Param('id') id: string, @Request() req: any) {
    // Check user has access to folder first
    const folder = await this.permissionsService.getFolderPermissions(id);
    if (req.user && req.user.role !== 'Master') {
      if (folder.companyId !== req.user.companyId) {
        throw new Error('Access denied: Folder belongs to a different company');
      }
    }
    return folder;
  }

  @Get('file/:id')
  async getFilePermissions(
    @Param('id') id: string,
    @Query('folderId') folderId: string | undefined,
    @Request() req: any,
  ) {
    const permissions = await this.permissionsService.getFilePermissions(id, folderId);
    // Check user has access to file first
    if (req.user && req.user.role !== 'Master') {
      if (permissions.companyId !== req.user.companyId) {
        throw new Error('Access denied: File belongs to a different company');
      }
    }
    return permissions;
  }

  @Put('file/:fileId')
  async updateFilePermissions(
    @Param('fileId') fileId: string,
    @Query('folderId') folderId: string,
    @Body() body: { permissions: any },
    @Request() req: any,
  ) {
    // Check user has permission to manage permissions
    const hasManage = await this.permissionsService.checkPermission(
      req.user.id,
      'file',
      fileId,
      'manage',
    );
    if (!hasManage && req.user.role !== 'Master') {
      throw new Error('Access denied: You do not have permission to manage this file');
    }
    
    return this.permissionsService.updateFilePermissions(
      fileId,
      folderId,
      body.permissions,
      req.user,
    );
  }
  
  @Put('folder/:folderId')
  async updateFolderPermissions(
    @Param('folderId') folderId: string,
    @Body() body: { permissions: any },
    @Request() req: any,
  ) {
    // Check user has permission to manage permissions
    const hasManage = await this.permissionsService.checkPermission(
      req.user.id,
      'folder',
      folderId,
      'manage',
    );
    if (!hasManage && req.user.role !== 'Master') {
      throw new Error('Access denied: You do not have permission to manage this folder');
    }
    
    return this.permissionsService.updateFolderPermissions(
      folderId,
      body.permissions,
      req.user,
    );
  }

  @Get('check')
  async checkPermission(
    @Query('userId') userId: string,
    @Query('resourceType') resourceType: 'folder' | 'file',
    @Query('resourceId') resourceId: string,
    @Query('permission') permission: 'read' | 'write' | 'delete' | 'share' | 'manage',
  ) {
    const hasPermission = await this.permissionsService.checkPermission(
      userId,
      resourceType,
      resourceId,
      permission,
    );
    return { hasPermission };
  }
}

