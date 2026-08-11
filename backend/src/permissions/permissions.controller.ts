import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  PermissionsService,
  ResourcePermission,
  ResourceType,
} from './permissions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CAPABILITIES, Capability, EffectivePermissions } from './capabilities';
import { CapabilityGuard, RequireCapability } from './require-capability.decorator';
import { ActivityService } from '../activity/activity.service';

const RESOURCE_TYPES: ResourceType[] = ['folder', 'file'];
const RESOURCE_PERMISSIONS: ResourcePermission[] = [
  'read',
  'write',
  'delete',
  'share',
  'manage',
];

@Controller('permissions')
export class PermissionsController {
  constructor(
    private permissionsService: PermissionsService,
    private activityService: ActivityService,
  ) {}

  /** The capability vocabulary, so admin UIs can render role editors. */
  @Get('capabilities')
  @RequireCapability('manage_permissions')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  listCapabilities() {
    return { capabilities: CAPABILITIES };
  }

  /** The caller's own resolved permissions. */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async myPermissions(@Request() req: any) {
    return req.user.permissions as EffectivePermissions;
  }

  @Get('folder/:id')
  @RequireCapability('folders.manage_permissions')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async getFolderPermissions(@Param('id') id: string, @Request() req: any) {
    // Reading the ACL is itself a privileged action — you must be able to
    // manage the folder to see who else has access to it.
    await this.permissionsService.assertPermission(
      req.user.id,
      'folder',
      id,
      'manage',
    );
    return this.permissionsService.getFolderPermissions(id);
  }

  @Get('file/:id')
  @RequireCapability('documents.manage_permissions')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async getFilePermissions(
    @Param('id') id: string,
    @Query('folderId') folderId: string | undefined,
    @Request() req: any,
  ) {
    await this.permissionsService.assertPermission(
      req.user.id,
      'file',
      id,
      'manage',
    );
    return this.permissionsService.getFilePermissions(id, folderId);
  }

  @Put('file/:fileId')
  @RequireCapability('documents.manage_permissions')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async updateFilePermissions(
    @Param('fileId') fileId: string,
    @Query('folderId') folderId: string,
    @Body() body: { permissions: unknown; onRevoke?: 'leave' | 'flag' },
    @Request() req: any,
  ) {
    if (!folderId) {
      throw new BadRequestException(
        'A folderId query parameter is required: file permissions are stored per folder.',
      );
    }

    await this.permissionsService.assertPermission(
      req.user.id,
      'file',
      fileId,
      'manage',
    );

    const result = await this.permissionsService.updateFilePermissions(
      fileId,
      folderId,
      body?.permissions,
      req.user,
      { onRevoke: body?.onRevoke },
    );

    // Record activity
    try {
      await this.activityService.createActivity({
        userId: req.user.id,
        companyId: req.user.companyId,
        activityType: 'permissions_update',
        resourceType: 'file',
        resourceId: fileId,
        description: `Updated file permissions`,
        metadata: { folderId, onRevoke: body?.onRevoke },
      });
    } catch (error) {
      // Don't fail the operation if activity logging fails
    }

    return result;
  }

  @Put('folder/:folderId')
  @RequireCapability('folders.manage_permissions')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async updateFolderPermissions(
    @Param('folderId') folderId: string,
    @Body() body: { permissions: unknown; onRevoke?: 'leave' | 'flag' },
    @Request() req: any,
  ) {
    await this.permissionsService.assertPermission(
      req.user.id,
      'folder',
      folderId,
      'manage',
    );

    const result = await this.permissionsService.updateFolderPermissions(
      folderId,
      body?.permissions,
      req.user,
      { onRevoke: body?.onRevoke },
    );

    // Record activity
    try {
      await this.activityService.createActivity({
        userId: req.user.id,
        companyId: req.user.companyId,
        activityType: 'permissions_update',
        resourceType: 'folder',
        resourceId: folderId,
        description: `Updated folder permissions`,
        metadata: { onRevoke: body?.onRevoke },
      });
    } catch (error) {
      // Don't fail the operation if activity logging fails
    }

    return result;
  }

  @Get('check')
  @UseGuards(JwtAuthGuard)
  async checkPermission(
    @Query('userId') userId: string,
    @Query('resourceType') resourceType: ResourceType,
    @Query('resourceId') resourceId: string,
    @Query('permission') permission: ResourcePermission,
    @Request() req: any,
  ) {
    if (!RESOURCE_TYPES.includes(resourceType)) {
      throw new BadRequestException(
        `resourceType must be one of: ${RESOURCE_TYPES.join(', ')}`,
      );
    }
    if (!RESOURCE_PERMISSIONS.includes(permission)) {
      throw new BadRequestException(
        `permission must be one of: ${RESOURCE_PERMISSIONS.join(', ')}`,
      );
    }
    if (!resourceId) {
      throw new BadRequestException('resourceId is required');
    }

    // Previously any caller could probe any other user's access. Checking on
    // behalf of someone else now requires the ability to manage permissions.
    const target = userId || req.user.id;
    if (target !== req.user.id) {
      const capabilities: Capability[] =
        req.user.permissions?.capabilities ?? [];
      const canInspect =
        capabilities.includes('folders.manage_permissions') ||
        capabilities.includes('documents.manage_permissions');
      if (!canInspect) {
        throw new ForbiddenException(
          "You may only check your own permissions.",
        );
      }
    }

    const hasPermission = await this.permissionsService.checkPermission(
      target,
      resourceType,
      resourceId,
      permission,
    );

    return { hasPermission };
  }
}
