import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActivityService {
  constructor(private prisma: PrismaService) {}

  async createActivity(data: {
    userId: string;
    companyId?: string;
    activityType: string;
    resourceType?: string;
    resourceId?: string;
    description: string;
    metadata?: any;
  }) {
    return this.prisma.activity.create({
      data: {
        userId: data.userId,
        companyId: data.companyId,
        activityType: data.activityType,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        description: data.description,
        metadata: data.metadata,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async getActivities(userId: string, filters?: {
    resourceType?: string;
    resourceId?: string;
    activityType?: string;
    limit?: number;
  }) {
    const where: any = {
      userId,
    };

    if (filters?.resourceType) {
      where.resourceType = filters.resourceType;
    }

    if (filters?.resourceId) {
      where.resourceId = filters.resourceId;
    }

    if (filters?.activityType) {
      where.activityType = filters.activityType;
    }

    return this.prisma.activity.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: filters?.limit || 100,
    });
  }

  async getRecentActivities(companyId?: string, limit: number = 50) {
    const where: any = {};
    if (companyId) {
      where.companyId = companyId;
    }

    return this.prisma.activity.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  }
}

