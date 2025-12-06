import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ApprovalRequestsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async findAll(userId: string) {
    // Get user's company and role
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        company: true,
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get user's role (from userRoles relation)
    const userRole = user.userRoles[0]?.role?.name || 'Staff';

    // Master can see all, others see only their company's approvals
    const where: any = {};
    if (userRole !== 'Master') {
      where.OR = [
        { targetCompanyId: user.companyId },
        { sourceCompanyId: user.companyId },
      ];
    }

    const approvals = await this.prisma.crossCompanyApproval.findMany({
      where,
      orderBy: {
        requestedAt: 'desc',
      },
    });

    return approvals;
  }

  async findOne(id: string) {
    return this.prisma.crossCompanyApproval.findUnique({
      where: { id },
    });
  }

  async create(data: any, currentUser: any) {
    const approval = await this.prisma.crossCompanyApproval.create({
      data: {
        workflowId: data.workflowId || null,
        actionId: data.actionId || null,
        requestType: data.requestType,
        sourceCompanyId: data.sourceCompanyId,
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

    // Create notification for target company admins
    // Get target company admins (users with Company Admin role)
    // Note: This assumes role is stored in userRoles relation
    // If role is stored differently, adjust this query
    const targetCompanyUsers = await this.prisma.user.findMany({
      where: {
        companyId: data.targetCompanyId,
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    const targetCompanyAdmins = targetCompanyUsers.filter((user) => {
      return user.userRoles.some((ur) => ur.role.name === 'Company Admin');
    });

    // Create notifications
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
      throw new Error('Approval request not found');
    }

    const updatedApproval = await this.prisma.crossCompanyApproval.update({
      where: { id },
      data: {
        ...data,
        reviewedBy: currentUser.id,
        reviewedAt: new Date(),
      },
    });

    // Update related workflow/action if approved
    if (data.status === 'approved') {
      if (existingApproval.workflowId) {
        // Update workflow assignment
        await this.prisma.workflow.update({
          where: { id: existingApproval.workflowId },
          data: {
            approvalRequestedAt: existingApproval.requestedAt,
          },
        });
      }

      if (existingApproval.actionId) {
        // Update action assignment
        await this.prisma.action.update({
          where: { id: existingApproval.actionId },
          data: {
            approvalRequestId: id,
          },
        });
      }
    }

    // Create notification for requester
    try {
      await this.notificationsService.create({
        userId: existingApproval.requestedBy,
        companyId: existingApproval.sourceCompanyId,
        type: data.status === 'approved' ? 'approval_request_approved' : 'approval_request_rejected',
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

  async delete(id: string) {
    return this.prisma.crossCompanyApproval.delete({
      where: { id },
    });
  }
}

