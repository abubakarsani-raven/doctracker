import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WebSocketGateway } from '../websocket/websocket.gateway';
import { EmailService } from './email.service';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private wsGateway: WebSocketGateway,
    private emailService: EmailService,
  ) {}

  async findAll(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async markAsRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true, readAt: new Date() },
    });
  }

  async create(data: any) {
    const notification = await this.prisma.notification.create({
      data,
    });
    
    // Emit WebSocket event to user
    this.wsGateway.emitNotification(data.userId, notification);
    
    // Send email notification based on type
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: data.userId },
        select: { email: true },
      });

      if (user?.email) {
        // Send email based on notification type
        if (data.type === 'action_assigned') {
          // Get action details for email
          const action = await this.prisma.action.findUnique({
            where: { id: data.resourceId || '' },
          });
          if (action) {
            await this.emailService.sendActionAssignedEmail(user.email, action);
          }
        } else if (data.type === 'action_completed') {
          const action = await this.prisma.action.findUnique({
            where: { id: data.resourceId || '' },
          });
          if (action) {
            await this.emailService.sendActionCompletedEmail(user.email, action);
          }
        } else if (data.type === 'workflow_assigned' || data.type === 'workflow_routed') {
          const workflow = await this.prisma.workflow.findUnique({
            where: { id: data.resourceId || '' },
          });
          if (workflow) {
            if (data.type === 'workflow_assigned') {
              await this.emailService.sendWorkflowAssignedEmail(user.email, workflow);
            } else {
              // For routed, we'd need routing info - simplified for now
              await this.emailService.sendWorkflowRoutedEmail(user.email, workflow, {});
            }
          }
        } else if (data.type === 'access_request_approved') {
          const request = await this.prisma.accessRequest.findUnique({
            where: { id: data.resourceId || '' },
          });
          if (request) {
            await this.emailService.sendAccessRequestApprovedEmail(user.email, request);
          }
        } else if (data.type === 'access_request_rejected') {
          const request = await this.prisma.accessRequest.findUnique({
            where: { id: data.resourceId || '' },
          });
          if (request) {
            await this.emailService.sendAccessRequestRejectedEmail(user.email, request);
          }
        }
      }
    } catch (error) {
      console.error('[NotificationsService] Failed to send email:', error);
      // Don't throw - email failure shouldn't break notification creation
    }
    
    return notification;
  }
}
