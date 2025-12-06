import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('storage')
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(private storageService: StorageService) {}

  @Get('company/:id')
  async getCompanyStorage(@Param('id') id: string) {
    const bytes = await this.storageService.getCompanyStorage(id);
    return {
      bytes,
      formatted: this.storageService.formatStorageSize(bytes),
    };
  }

  @Get('user')
  async getUserStorage(@Request() req) {
    const bytes = await this.storageService.getUserStorage(req.user.id);
    return {
      bytes,
      formatted: this.storageService.formatStorageSize(bytes),
    };
  }

  @Get('total')
  async getTotalStorage() {
    const bytes = await this.storageService.getTotalStorage();
    return {
      bytes,
      formatted: this.storageService.formatStorageSize(bytes),
    };
  }
}

