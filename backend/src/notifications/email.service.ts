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

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  }
}

