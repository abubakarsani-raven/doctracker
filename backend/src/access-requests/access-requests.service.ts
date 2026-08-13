import { ForbiddenException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityService } from '../activity/activity.service';
import { PermissionsService } from '../permissions/permissions.service';

@Injectable()
export class AccessRequestsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private activityService: ActivityService,
    private permissionsService: PermissionsService,
  ) {}

  async findAll(userId: string) {
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

    const permissions =
      await this.permissionsService.getEffectivePermissions(userId);
    const canReview = permissions.capabilities.includes(
      'access_requests.review',
    );

    const userCompanyId = user.companyId;
    const userDepartmentIds = user.userDepartments.map((ud) => ud.departmentId);

    // Reviewers see company/department queues. Everyone else only sees
    // requests they raised — otherwise Staff would read the whole company list.
    const requests = await this.prisma.accessRequest.findMany({
      where: canReview
        ? {
            OR: [
              { requestedBy: userId },
              { companyId: userCompanyId },
              { departmentId: { in: userDepartmentIds } },
            ],
          }
        : { requestedBy: userId },
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

    return Promise.all(
      requests.map(async (request) => ({
        ...request,
        canReview: await this.canReviewRequest(userId, request, permissions),
      })),
    );
  }

  async findOne(id: string, currentUser: any) {
    const request = await this.prisma.accessRequest.findUnique({
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

    if (!request) {
      throw new NotFoundException('Access request not found');
    }

    const capabilities: string[] = currentUser?.permissions?.capabilities ?? [];
    const isRequester = request.requestedBy === currentUser?.id;
    const isReviewer = capabilities.includes('access_requests.review');

    if (!isRequester && !isReviewer) {
      throw new ForbiddenException('You cannot view this access request.');
    }

    if (
      isReviewer &&
      !isRequester &&
      currentUser?.permissions?.dataScope !== 'all' &&
      request.companyId &&
      request.companyId !== currentUser.companyId
    ) {
      throw new ForbiddenException(
        'That access request belongs to another company.',
      );
    }

    return request;
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

    const resourceType =
      data.resourceType === 'folder' ? 'folder' : 'file';
    const alreadyAllowed = await this.permissionsService.checkPermission(
      currentUser.id,
      resourceType,
      data.resourceId,
      'read',
    );
    if (alreadyAllowed) {
      throw new BadRequestException(
        'You already have access to this resource — no request needed.',
      );
    }

    if (
      resourceType === 'file' &&
      (await this.permissionsService.isFileAccessRevoked(data.resourceId))
    ) {
      throw new ForbiddenException(
        'Access to this file has been revoked by a group administrator.',
      );
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
      throw new NotFoundException('Access request not found');
    }

    // Approving or rejecting is a reviewer's decision, so it takes the
    // capability rather than merely being signed in.
    const capabilities: string[] = currentUser?.permissions?.capabilities ?? [];
    if (!capabilities.includes('access_requests.review')) {
      throw new ForbiddenException(
        'Your role cannot approve or reject access requests.',
      );
    }

    if (existingRequest.requestedBy === currentUser.id) {
      throw new ForbiddenException(
        'You cannot approve or reject your own access request.',
      );
    }

    // A reviewer only decides requests inside their own company; only an
    // instance-wide scope reaches across companies.
    if (
      currentUser?.permissions?.dataScope !== 'all' &&
      existingRequest.companyId &&
      existingRequest.companyId !== currentUser.companyId
    ) {
      throw new ForbiddenException(
        'That access request belongs to another company.',
      );
    }

    const canReadResource = await this.permissionsService.checkPermission(
      currentUser.id,
      existingRequest.resourceType === 'folder' ? 'folder' : 'file',
      existingRequest.resourceId,
      'read',
    );
    if (!canReadResource) {
      throw new ForbiddenException(
        'You can only review access requests for resources you can open.',
      );
    }

    if (
      data.status === 'approved' &&
      existingRequest.resourceType !== 'folder' &&
      (await this.permissionsService.isFileAccessRevoked(
        existingRequest.resourceId,
      ))
    ) {
      throw new ForbiddenException(
        'Access to this file has been revoked by a group administrator. Restore access before approving requests.',
      );
    }

    // Reviewer identity comes from the session, never from the request body.
    const now = new Date();
    const reviewerName =
      currentUser?.name || currentUser?.email || currentUser?.id || 'Unknown';

    const decision: any = {
      status: data.status,
      updatedAt: now,
    };

    if (data.status === 'approved') {
      decision.approvedBy = currentUser.id;
      decision.approvedByName = reviewerName;
      decision.approvedAt = now;
    } else if (data.status === 'rejected') {
      decision.rejectedBy = currentUser.id;
      decision.rejectedByName = reviewerName;
      decision.rejectedAt = now;
      decision.rejectionReason = data.rejectionReason ?? null;
    }

    const updatedRequest = await this.prisma.accessRequest.update({
      where: { id },
      data: decision,
    });

    // Grant ACL when approved so the requester can actually open the resource.
    if (data.status === 'approved') {
      try {
        const actor = {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
        };
        const resourceId = existingRequest.resourceId;

        if (existingRequest.resourceType === 'folder') {
          await this.permissionsService.grantUserFolderAccess(
            resourceId,
            existingRequest.requestedBy,
            ['read'],
            actor,
            {
              source: `access_request:${id}`,
              subjectName: existingRequest.requestedByName,
              notify: false,
            },
          );
        } else {
          // document / file
          await this.permissionsService.grantUserFileAccess(
            resourceId,
            existingRequest.requestedBy,
            ['read'],
            actor,
            {
              source: `access_request:${id}`,
              subjectName: existingRequest.requestedByName,
              notify: false,
            },
          );
        }
      } catch (error) {
        console.error('Failed to grant access after approval:', error);
        throw new BadRequestException(
          'Request was recorded but access could not be granted. Try again or grant manually.',
        );
      }
    }

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

    // Record activity for decision
    try {
      await this.activityService.createActivity({
        userId: currentUser.id,
        companyId: currentUser.companyId,
        activityType: 'access_request_decision',
        resourceType: existingRequest.resourceType,
        resourceId: existingRequest.resourceId,
        description: `${data.status === 'approved' ? 'Approved' : 'Rejected'} access request for ${existingRequest.resourceName}`,
        metadata: { 
          requestId: id,
          decision: data.status,
          rejectionReason: data.rejectionReason,
        },
      });
    } catch (error) {
      // Don't fail the operation if activity logging fails
    }

    return updatedRequest;
  }

  /**
   * Withdraw a request. The person who raised it can take it back; a reviewer
   * can dismiss it. Nobody else.
   */
  async delete(id: string, currentUser: any) {
    const request = await this.prisma.accessRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Access request not found');
    }

    const capabilities: string[] = currentUser?.permissions?.capabilities ?? [];
    const isRequester = request.requestedBy === currentUser?.id;
    const isReviewer = capabilities.includes('access_requests.review');

    if (!isRequester && !isReviewer) {
      throw new ForbiddenException(
        'You can only withdraw your own access requests.',
      );
    }

    if (
      isReviewer &&
      !isRequester &&
      currentUser?.permissions?.dataScope !== 'all' &&
      request.companyId &&
      request.companyId !== currentUser.companyId
    ) {
      throw new ForbiddenException(
        'That access request belongs to another company.',
      );
    }

    return this.prisma.accessRequest.delete({ where: { id } });
  }

  /**
   * A reviewer may decide a request only when they can already open the
   * resource — otherwise a Division Head could approve a board paper they
   * cannot read.
   */
  private async canReviewRequest(
    userId: string,
    request: {
      requestedBy: string;
      companyId: string | null;
      resourceType: string;
      resourceId: string;
    },
    permissions: {
      capabilities: string[];
      dataScope: string;
      companyId: string | null;
    },
  ): Promise<boolean> {
    if (request.requestedBy === userId) return false;
    if (!permissions.capabilities.includes('access_requests.review')) {
      return false;
    }
    if (
      permissions.dataScope !== 'all' &&
      request.companyId &&
      request.companyId !== permissions.companyId
    ) {
      return false;
    }
    return this.permissionsService.checkPermission(
      userId,
      request.resourceType === 'folder' ? 'folder' : 'file',
      request.resourceId,
      'read',
    );
  }
}

