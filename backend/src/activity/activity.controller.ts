import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('activity')
@UseGuards(JwtAuthGuard)
export class ActivityController {
  constructor(private activityService: ActivityService) {}

  @Get()
  async getActivities(
    @Request() req,
    @Query('resourceType') resourceType?: string,
    @Query('resourceId') resourceId?: string,
    @Query('activityType') activityType?: string,
    @Query('limit') limit?: number,
  ) {
    return this.activityService.getActivities(req.user.id, {
      resourceType,
      resourceId,
      activityType,
      limit: limit ? parseInt(limit.toString()) : undefined,
    });
  }

  @Get('recent')
  async getRecentActivities(
    @Request() req,
    @Query('limit') limit?: number,
  ) {
    return this.activityService.getRecentActivities(req.user.companyId, limit ? parseInt(limit.toString()) : 50);
  }
}

