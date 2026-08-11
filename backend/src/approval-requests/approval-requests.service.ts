import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ApprovalRequestsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  private async loadActor(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        company: true,
        userRoles: { include: { role: true } },
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private assertCanAccessApproval(
    approval: {
      sourceCompanyId: string | null;
      targetCompanyId: string | null;
    },
    currentUser: any,
  ) {
    if (currentUser?.permissions?.dataScope === 'all') return;
    const companyId = currentUser?.companyId;
    if (
      !companyId ||
      (approval.sourceCompanyId !== companyId &&
        approval.targetCompanyId !== companyId)
    ) {
      throw new ForbiddenException(
        'That approval request belongs to another company.',
      );
    }
  }

  async findAll(userId: string, currentUser?: any) {
    const user = await this.loadActor(userId);
    const seesAll =
      currentUser?.permissions?.dataScope === 'all' ||
      user.userRoles.some((ur) => {
        try {
          const json = ur.role?.permissionsJson as any;
          return json?.dataScope === 'all';
        } catch {
          return false;
        }
      });

    const where: any = {};
    if (!seesAll) {
      where.OR = [
        { targetCompanyId: user.companyId },
        { sourceCompanyId: user.companyId },
      ];
    }

    return this.prisma.crossCompanyApproval.findMany({
      where,
      orderBy: { requestedAt: 'desc' },
    });
  }

  async findOne(id: string, currentUser: any) {
    const approval = await this.prisma.crossCompanyApproval.findUnique({
      where: { id },
    });
    if (!approval) {
      throw new NotFoundException('Approval request not found');
    }
    this.assertCanAccessApproval(approval, currentUser);
    return approval;
  }

  async create(data: any, currentUser: any) {
    const sourceCompanyId =
      currentUser?.permissions?.dataScope === 'all'
        ? data.sourceCompanyId || currentUser.companyId
        : currentUser.companyId;

    if (!sourceCompanyId) {
      throw new ForbiddenException('sourceCompanyId is required');
    }

    const approval = await this.prisma.crossCompanyApproval.create({
      data: {
        workflowId: data.workflowId || null,
        actionId: data.actionId || null,
        requestType: data.requestType,
        sourceCompanyId,
        sourceCompanyName: data.sourceCompanyName,
        targetCompanyId: data.targetCompanyId,
        targetCompanyName: data.targetCompanyName,
        requestedBy: currentUser.id,
        assignedToType: data.assignedToType,
        assignedToId: data.assignedToId,
        assignedToName: data.assignedToName,
        workflowTitle: data.workflowTitle || null,
        workflowDescription: data.workflowDescription || null,
        actionTitle: data.actionTitle || null,
        actionDescription: data.actionDescription || null,
        routingNotes: data.routingNotes || null,
        status: 'pending',
      },
    });

    const targetCompanyUsers = await this.prisma.user.findMany({
      where: { companyId: data.targetCompanyId },
      include: {
        userRoles: { include: { role: true } },
      },
    });

    const targetCompanyAdmins = targetCompanyUsers.filter((user) => {
      return user.userRoles.some((ur) => ur.role.name === 'Company Admin');
    });

    const notifications = targetCompanyAdmins.map((admin) => ({
      userId: admin.id,
      companyId: data.targetCompanyId,
      type: 'approval_request',
      title: `Cross-Company Approval Request`,
      message: `${data.sourceCompanyName} is requesting approval to ${data.requestType === 'workflow_assignment' ? 'assign a workflow' : data.requestType === 'action_assignment' ? 'assign an action' : 'route a workflow'} to ${data.assignedToName}.`,
      resourceType: 'approval_request',
      resourceId: approval.id,
      read: false,
    }));

    if (notifications.length > 0) {
      await this.prisma.notification.createMany({
        data: notifications,
      });
    }

    return approval;
  }

  async update(id: string, data: any, currentUser: any) {
    const existingApproval = await this.prisma.crossCompanyApproval.findUnique({
      where: { id },
    });

    if (!existingApproval) {
      throw new NotFoundException('Approval request not found');
    }

    this.assertCanAccessApproval(existingApproval, currentUser);

    const updatedApproval = await this.prisma.crossCompanyApproval.update({
      where: { id },
      data: {
        status: data.status,
        rejectionReason: data.rejectionReason ?? null,
        reviewedBy: currentUser.id,
        reviewedAt: new Date(),
      },
    });

    if (data.status === 'approved') {
      if (existingApproval.workflowId) {
        await this.prisma.workflow.update({
          where: { id: existingApproval.workflowId },
          data: {
            approvalRequestedAt: existingApproval.requestedAt,
          },
        });
      }

      if (existingApproval.actionId) {
        await this.prisma.action.update({
          where: { id: existingApproval.actionId },
          data: {
            approvalRequestId: id,
          },
        });
      }
    }

    try {
      await this.notificationsService.create({
        userId: existingApproval.requestedBy,
        companyId: existingApproval.sourceCompanyId,
        type:
          data.status === 'approved'
            ? 'approval_request_approved'
            : 'approval_request_rejected',
        title: `Approval Request ${data.status === 'approved' ? 'Approved' : 'Rejected'}`,
        message: `Your cross-company approval request has been ${data.status === 'approved' ? 'approved' : 'rejected'}.${data.rejectionReason ? ` Reason: ${data.rejectionReason}` : ''}`,
        resourceType: 'approval_request',
        resourceId: id,
        read: false,
      });
    } catch (error) {
      console.error('Failed to create notification:', error);
    }

    return updatedApproval;
  }

  async delete(id: string, currentUser: any) {
    const existing = await this.prisma.crossCompanyApproval.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Approval request not found');
    }
    this.assertCanAccessApproval(existing, currentUser);

    return this.prisma.crossCompanyApproval.delete({
      where: { id },
    });
  }
}
