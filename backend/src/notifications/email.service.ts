import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor(private configService: ConfigService) {
    // Initialize email transporter
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = this.configService.get<number>('SMTP_PORT', 587);
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');
    const smtpFrom = this.configService.get<string>('SMTP_FROM', 'noreply@doctracker.com');

    if (smtpHost && smtpUser && smtpPass) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
    } else {
      console.warn('[EmailService] SMTP not configured, email sending disabled');
    }
  }

  async sendEmail(to: string, subject: string, html: string, text?: string) {
    if (!this.transporter) {
      console.warn('[EmailService] Cannot send email, transporter not configured');
      return;
    }

    try {
      const smtpFrom = this.configService.get<string>('SMTP_FROM', 'noreply@doctracker.com');
      
      await this.transporter.sendMail({
        from: smtpFrom,
        to,
        subject,
        html,
        text: text || this.stripHtml(html),
      });

      console.log(`[EmailService] Email sent to ${to}`);
    } catch (error) {
      console.error('[EmailService] Failed to send email:', error);
      throw error;
    }
  }

  async sendActionAssignedEmail(to: string, action: any) {
    const subject = `New Action Assigned: ${action.title}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4F46E5; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border-radius: 0 0 5px 5px; }
          .button { display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Action Assigned</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>You have been assigned a new action:</p>
            <h2>${action.title}</h2>
            ${action.description ? `<p>${action.description}</p>` : ''}
            ${action.dueDate ? `<p><strong>Due Date:</strong> ${new Date(action.dueDate).toLocaleDateString()}</p>` : ''}
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/actions/${action.id}" class="button">View Action</a>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(to, subject, html);
  }

  async sendActionCompletedEmail(to: string, action: any) {
    const subject = `Action Completed: ${action.title}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #10B981; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border-radius: 0 0 5px 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Action Completed</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>The following action has been completed:</p>
            <h2>${action.title}</h2>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/actions/${action.id}">View Action</a>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(to, subject, html);
  }

  async sendWorkflowAssignedEmail(to: string, workflow: any) {
    const subject = `New Workflow Assigned: ${workflow.title}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4F46E5; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border-radius: 0 0 5px 5px; }
          .button { display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Workflow Assigned</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>You have been assigned a new workflow:</p>
            <h2>${workflow.title}</h2>
            ${workflow.description ? `<p>${workflow.description}</p>` : ''}
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/workflows/${workflow.id}" class="button">View Workflow</a>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(to, subject, html);
  }

  async sendWorkflowRoutedEmail(to: string, workflow: any, routingInfo: any) {
    const subject = `Workflow Routed: ${workflow.title}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4F46E5; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border-radius: 0 0 5px 5px; }
          .button { display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Workflow Routed</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>The workflow "${workflow.title}" has been routed:</p>
            <p><strong>Routed to:</strong> ${routingInfo.toName || 'Unknown'}</p>
            ${routingInfo.notes ? `<p><strong>Notes:</strong> ${routingInfo.notes}</p>` : ''}
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/workflows/${workflow.id}" class="button">View Workflow</a>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(to, subject, html);
  }

  async sendAccessRequestApprovedEmail(to: string, request: any) {
    const subject = `Access Request Approved: ${request.resourceName}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #10B981; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border-radius: 0 0 5px 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Access Request Approved</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>Your access request for "${request.resourceName}" has been approved.</p>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/documents">View Documents</a>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(to, subject, html);
  }

  async sendAccessRequestRejectedEmail(to: string, request: any) {
    const subject = `Access Request Rejected: ${request.resourceName}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #EF4444; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border-radius: 0 0 5px 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Access Request Rejected</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>Your access request for "${request.resourceName}" has been rejected.</p>
            ${request.rejectionReason ? `<p><strong>Reason:</strong> ${request.rejectionReason}</p>` : ''}
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(to, subject, html);
  }

  async sendSignatureRequestedEmail(
    to: string,
    payload: {
      fileName: string;
      fileId: string;
      requesterName: string;
      participantName?: string;
    },
  ) {
    const front = this.frontendUrl();
    const subject = `Signature requested: ${payload.fileName}`;
    const greeting = payload.participantName
      ? `Hello ${this.escape(payload.participantName)},`
      : 'Hello,';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #0F766E; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border-radius: 0 0 5px 5px; }
          .button { display: inline-block; padding: 10px 20px; background-color: #0F766E; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Signature requested</h1>
          </div>
          <div class="content">
            <p>${greeting}</p>
            <p>${this.escape(payload.requesterName)} has asked you to sign <strong>${this.escape(payload.fileName)}</strong>.</p>
            <p>You have temporary access to open and sign the document. Access is removed once signing is complete.</p>
            <a href="${front}/documents/${payload.fileId}" class="button">Open document</a>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(to, subject, html);
  }

  async sendSignatureCompletedEmail(
    to: string,
    payload: {
      fileName: string;
      fileId: string;
      signerName: string;
    },
  ) {
    const front = this.frontendUrl();
    const subject = `Signing complete: ${payload.fileName}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #10B981; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border-radius: 0 0 5px 5px; }
          .button { display: inline-block; padding: 10px 20px; background-color: #10B981; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>All signatures collected</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>Everyone has signed <strong>${this.escape(payload.fileName)}</strong>.</p>
            <p>Last signer: ${this.escape(payload.signerName)}</p>
            <a href="${front}/documents/${payload.fileId}" class="button">View document</a>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(to, subject, html);
  }

  /** Fallback for notification types without a dedicated template. */
  async sendGenericNotificationEmail(
    to: string,
    payload: { title: string; message: string; href?: string },
  ) {
    const subject = payload.title;
    const button = payload.href
      ? `<a href="${payload.href}" class="button">Open</a>`
      : '';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #334155; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border-radius: 0 0 5px 5px; }
          .button { display: inline-block; padding: 10px 20px; background-color: #334155; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${this.escape(payload.title)}</h1>
          </div>
          <div class="content">
            <p>${this.escape(payload.message)}</p>
            ${button}
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(to, subject, html);
  }

  async sendPasswordResetEmail(to: string, resetUrl: string, name?: string) {
    const subject = 'Reset your DocTracker password';
    const greeting = name ? this.escape(name) : 'there';
    const safeUrl = this.escape(resetUrl);
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1e293b; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border-radius: 0 0 5px 5px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin-top: 16px; }
          .muted { color: #64748b; font-size: 13px; margin-top: 24px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password reset</h1>
          </div>
          <div class="content">
            <p>Hello ${greeting},</p>
            <p>We received a request to reset your DocTracker password. This link expires in one hour.</p>
            <p><a href="${safeUrl}" class="button">Reset password</a></p>
            <p class="muted">If you did not ask for this, you can ignore this email. Your password will stay the same.</p>
            <p class="muted">Or paste this link into your browser:<br>${safeUrl}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(to, subject, html);
  }

  /** Whether outbound SMTP is configured. */
  isConfigured(): boolean {
    return this.transporter != null;
  }

  private frontendUrl(): string {
    return (
      this.configService.get<string>('FRONTEND_URL') ||
      process.env.FRONTEND_URL ||
      'http://localhost:3001'
    );
  }

  private escape(value: string): string {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  }
}

