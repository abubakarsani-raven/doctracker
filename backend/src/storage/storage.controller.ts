import { Controller, Get, Param, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CapabilityGuard, RequireCapability } from '../permissions/require-capability.decorator';

@Controller('storage')
export class StorageController {
  constructor(private storageService: StorageService) {}

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats(@Request() req: any) {
    // Dashboard convenience alias for the caller's storage usage
    if (!req.user?.id) {
      return { bytes: 0, formatted: '0 B' };
    }
    const bytes = await this.storageService.getUserStorage(req.user.id);
    return {
      bytes,
      formatted: this.storageService.formatStorageSize(bytes),
    };
  }

  @Get('company/:id')
  @RequireCapability('storage.view')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async getCompanyStorage(@Param('id') id: string, @Request() req: any) {
    if (
      req.user?.permissions?.dataScope !== 'all' &&
      id !== req.user?.companyId
    ) {
      throw new ForbiddenException(
        'You can only view storage for your own company.',
      );
    }
    const bytes = await this.storageService.getCompanyStorage(id);
    return {
      bytes,
      formatted: this.storageService.formatStorageSize(bytes),
    };
  }

  @Get('user')
  @UseGuards(JwtAuthGuard)
  async getUserStorage(@Request() req: any) {
    try {
      if (!req.user?.id) {
        return { bytes: 0, formatted: '0 B' };
      }
      const bytes = await this.storageService.getUserStorage(req.user.id);
      return {
        bytes,
        formatted: this.storageService.formatStorageSize(bytes),
      };
    } catch (error: any) {
      console.error('[StorageController] Error getting user storage:', error);
      return { bytes: 0, formatted: '0 B' };
    }
  }

  @Get('total')
  @RequireCapability('storage.view')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async getTotalStorage() {
    const bytes = await this.storageService.getTotalStorage();
    return {
      bytes,
      formatted: this.storageService.formatStorageSize(bytes),
    };
  }
}

