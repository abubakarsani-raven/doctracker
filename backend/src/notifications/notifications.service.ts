import { Injectable, Inject, forwardRef, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { WebSocketGateway } from '../websocket/websocket.gateway';
import { EmailService } from './email.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => WebSocketGateway))
    private wsGateway: WebSocketGateway,
    private emailService: EmailService,
    private configService: ConfigService,
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

  async create(data: {
    userId: string;
    companyId?: string | null;
    type: string;
    title: string;
    message: string;
    resourceType?: string | null;
    resourceId?: string | null;
    read?: boolean;
    /** Extra context for email templates (not persisted). */
    emailPayload?: Record<string, unknown>;
  }) {
    const { emailPayload, ...persist } = data;

    const notification = await this.prisma.notification.create({
      data: {
        userId: persist.userId,
        companyId: persist.companyId ?? null,
        type: persist.type,
        title: persist.title,
        message: persist.message,
        resourceType: persist.resourceType ?? null,
        resourceId: persist.resourceId ?? null,
        read: persist.read ?? false,
      },
    });

    // Emit WebSocket event to user
    try {
      this.wsGateway.emitNotification(data.userId, notification);
    } catch (error) {
      this.logger.warn(
        `WebSocket notify failed: ${error instanceof Error ? error.message : error}`,
      );
    }

    // Send email notification based on type
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: data.userId },
        select: { email: true },
      });

      if (user?.email) {
        await this.dispatchEmail(user.email, data, emailPayload);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to send email for ${data.type}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }

    return notification;
  }

  /**
   * Email-only notice for invitees who are not (yet) platform users.
   * No in-app row is created.
   */
  async sendEmailOnly(
    to: string,
    type: string,
    emailPayload: Record<string, unknown>,
  ) {
    try {
      if (type === 'signature_requested') {
        await this.emailService.sendSignatureRequestedEmail(to, {
          fileName: String(emailPayload.fileName || 'Document'),
          fileId: String(emailPayload.fileId || ''),
          requesterName: String(emailPayload.requesterName || 'Someone'),
          participantName: emailPayload.participantName
            ? String(emailPayload.participantName)
            : undefined,
        });
        return;
      }
      if (type === 'signature_completed') {
        await this.emailService.sendSignatureCompletedEmail(to, {
          fileName: String(emailPayload.fileName || 'Document'),
          fileId: String(emailPayload.fileId || ''),
          signerName: String(emailPayload.signerName || 'A signer'),
        });
        return;
      }
      await this.emailService.sendGenericNotificationEmail(to, {
        title: String(emailPayload.title || 'DocTracker notification'),
        message: String(emailPayload.message || ''),
        href: emailPayload.href ? String(emailPayload.href) : undefined,
      });
    } catch (error) {
      this.logger.warn(
        `Email-only send failed to ${to}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }

  private frontendUrl(): string {
    return (
      this.configService.get<string>('FRONTEND_URL') ||
      process.env.FRONTEND_URL ||
      'http://localhost:3001'
    );
  }

  private async dispatchEmail(
    email: string,
    data: {
      type: string;
      title: string;
      message: string;
      resourceType?: string | null;
      resourceId?: string | null;
    },
    emailPayload?: Record<string, unknown>,
  ) {
    const front = this.frontendUrl();

    if (data.type === 'action_assigned') {
      const action = await this.prisma.action.findUnique({
        where: { id: data.resourceId || '' },
      });
      if (action) {
        await this.emailService.sendActionAssignedEmail(email, action);
      }
      return;
    }

    if (data.type === 'action_completed') {
      const action = await this.prisma.action.findUnique({
        where: { id: data.resourceId || '' },
      });
      if (action) {
        await this.emailService.sendActionCompletedEmail(email, action);
      }
      return;
    }

    if (data.type === 'workflow_assigned' || data.type === 'workflow_routed') {
      const workflow = await this.prisma.workflow.findUnique({
        where: { id: data.resourceId || '' },
      });
      if (workflow) {
        if (data.type === 'workflow_assigned') {
          await this.emailService.sendWorkflowAssignedEmail(email, workflow);
        } else {
          await this.emailService.sendWorkflowRoutedEmail(email, workflow, {});
        }
      }
      return;
    }

    if (data.type === 'access_request_approved') {
      const request = await this.prisma.accessRequest.findUnique({
        where: { id: data.resourceId || '' },
      });
      if (request) {
        await this.emailService.sendAccessRequestApprovedEmail(email, request);
      }
      return;
    }

    if (data.type === 'access_request_rejected') {
      const request = await this.prisma.accessRequest.findUnique({
        where: { id: data.resourceId || '' },
      });
      if (request) {
        await this.emailService.sendAccessRequestRejectedEmail(email, request);
      }
      return;
    }

    if (data.type === 'signature_requested') {
      await this.emailService.sendSignatureRequestedEmail(email, {
        fileName: String(emailPayload?.fileName || 'Document'),
        fileId: String(emailPayload?.fileId || data.resourceId || ''),
        requesterName: String(emailPayload?.requesterName || 'Someone'),
        participantName: emailPayload?.participantName
          ? String(emailPayload.participantName)
          : undefined,
      });
      return;
    }

    if (data.type === 'signature_completed') {
      await this.emailService.sendSignatureCompletedEmail(email, {
        fileName: String(emailPayload?.fileName || 'Document'),
        fileId: String(emailPayload?.fileId || data.resourceId || ''),
        signerName: String(emailPayload?.signerName || 'A signer'),
      });
      return;
    }

    // permission_granted / permission_revoked / everything else
    const href =
      data.resourceType === 'file' && data.resourceId
        ? `${front}/documents/${data.resourceId}`
        : data.resourceType === 'folder' && data.resourceId
          ? `${front}/documents/folder/${data.resourceId}`
          : undefined;

    await this.emailService.sendGenericNotificationEmail(email, {
      title: data.title,
      message: data.message,
      href,
    });
  }
}
