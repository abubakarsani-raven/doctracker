import { Controller, Get, Query, UseGuards, Request, Response } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CapabilityGuard, RequireCapability } from '../permissions/require-capability.decorator';
import { Response as ExpressResponse } from 'express';

@Controller('activity')
export class ActivityController {
  constructor(private activityService: ActivityService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
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
  @RequireCapability('activity.view_all')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async getRecentActivities(
    @Request() req,
    @Query('limit') limit?: number,
  ) {
    return this.activityService.getRecentActivities(req.user.companyId, limit ? parseInt(limit.toString()) : 50);
  }

  @Get('company')
  @RequireCapability('activity.view_all')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async getCompanyActivities(
    @Request() req,
    @Query('userId') userId?: string,
    @Query('activityType') activityType?: string,
    @Query('resourceType') resourceType?: string,
    @Query('resourceId') resourceId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ) {
    const filters: any = {};
    
    if (userId) filters.userId = userId;
    if (activityType) filters.activityType = activityType;
    if (resourceType) filters.resourceType = resourceType;
    if (resourceId) filters.resourceId = resourceId;
    if (from) filters.from = new Date(from);
    if (to) filters.to = new Date(to);
    if (skip !== undefined) filters.skip = parseInt(skip.toString());
    if (take !== undefined) filters.take = parseInt(take.toString());

    return this.activityService.getCompanyActivities(req.user.companyId, filters);
  }

  @Get('export')
  @RequireCapability('activity.view_all')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async exportActivities(
    @Request() req,
    @Response() res: ExpressResponse,
    @Query('userId') userId?: string,
    @Query('activityType') activityType?: string,
    @Query('resourceType') resourceType?: string,
    @Query('resourceId') resourceId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('format') format?: string,
  ) {
    const filters: any = {};
    
    if (userId) filters.userId = userId;
    if (activityType) filters.activityType = activityType;
    if (resourceType) filters.resourceType = resourceType;
    if (resourceId) filters.resourceId = resourceId;
    if (from) filters.from = new Date(from);
    if (to) filters.to = new Date(to);

    const activities = await this.activityService.exportActivities(req.user.companyId, filters);

    if (format === 'csv') {
      // Convert to CSV format
      const csvHeader = 'ID,User Name,User Email,Activity Type,Resource Type,Resource ID,Description,Created At\n';
      const csvRows = activities.map(activity => {
        const row = [
          activity.id,
          activity.user?.name || '',
          activity.user?.email || '',
          activity.activityType,
          activity.resourceType || '',
          activity.resourceId || '',
          `"${(activity.description || '').replace(/"/g, '""')}"`,
          activity.createdAt.toISOString()
        ].join(',');
        return row;
      }).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="activities_export.csv"');
      return res.send(csvHeader + csvRows);
    } else {
      // Return JSON format
      res.setHeader('Content-Type', 'application/json');
      return res.json(activities);
    }
  }
}

