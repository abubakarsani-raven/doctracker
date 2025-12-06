import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AccessRequestsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async findAll(userId: string) {
    // Get user's company and departments
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        company: true,
        userDepartments: {
          include: {
            department: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const userCompanyId = user.companyId;
    const userDepartmentIds = user.userDepartments.map((ud) => ud.departmentId);

    // Get all access requests that the user can see:
    // 1. Requests they created
    // 2. Requests in their company (if they can approve)
    // 3. Requests for their departments
    const requests = await this.prisma.accessRequest.findMany({
      where: {
        OR: [
          { requestedBy: userId },
          { companyId: userCompanyId },
          { departmentId: { in: userDepartmentIds } },
        ],
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return requests;
  }

  async findOne(id: string) {
    return this.prisma.accessRequest.findUnique({
      where: { id },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async create(data: any, currentUser: any) {
    // Get user's company
    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.id },
      include: {
        company: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Determine companyId and departmentId based on resource
    let companyId = user.companyId;
    let departmentId: string | null = null;

    if (data.resourceType === 'folder') {
      const folder = await this.prisma.folder.findUnique({
        where: { id: data.resourceId },
        select: {
          companyId: true,
          departmentId: true,
        },
      });
      if (folder) {
        companyId = folder.companyId;
        departmentId = folder.departmentId;
      }
    } else if (data.resourceType === 'document') {
      // For documents, get company from folder
      const fileFolderLink = await this.prisma.fileFolderLink.findFirst({
        where: { fileId: data.resourceId },
        include: {
          folder: {
            select: {
              companyId: true,
              departmentId: true,
            },
          },
        },
      });
      if (fileFolderLink?.folder) {
        companyId = fileFolderLink.folder.companyId;
        departmentId = fileFolderLink.folder.departmentId;
      }
    }

    const accessRequest = await this.prisma.accessRequest.create({
      data: {
        resourceId: data.resourceId,
        resourceType: data.resourceType,
        resourceName: data.resourceName,
        scope: data.scope,
        requestedBy: currentUser.id,
        requestedByName: currentUser.name || currentUser.email,
        reason: data.reason,
        companyId,
        departmentId,
        status: 'pending',
      },
    });

    // Create notification for approvers (handled by frontend for now)
    // TODO: Get approvers and create notifications

    return accessRequest;
  }

  async update(id: string, data: any, currentUser: any) {
    const existingRequest = await this.prisma.accessRequest.findUnique({
      where: { id },
    });

    if (!existingRequest) {
      throw new Error('Access request not found');
    }

    const updatedRequest = await this.prisma.accessRequest.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    // Create notification for requester
    try {
      if (data.status === 'approved') {
        await this.notificationsService.create({
          userId: existingRequest.requestedBy,
          companyId: existingRequest.companyId,
          type: 'access_request_approved',
          title: `Access Request Approved`,
          message: `Your access request for "${existingRequest.resourceName}" has been approved.`,
          resourceType: existingRequest.resourceType,
          resourceId: existingRequest.resourceId,
          read: false,
        });
      } else if (data.status === 'rejected') {
        await this.notificationsService.create({
          userId: existingRequest.requestedBy,
          companyId: existingRequest.companyId,
          type: 'access_request_rejected',
          title: `Access Request Rejected`,
          message: `Your access request for "${existingRequest.resourceName}" has been rejected.${data.rejectionReason ? ` Reason: ${data.rejectionReason}` : ''}`,
          resourceType: existingRequest.resourceType,
          resourceId: existingRequest.resourceId,
          read: false,
        });
      }
    } catch (error) {
      console.error('Failed to create notification:', error);
      // Don't throw - notification failure shouldn't break request update
    }

    return updatedRequest;
  }

  async delete(id: string) {
    return this.prisma.accessRequest.delete({
      where: { id },
    });
  }
}

