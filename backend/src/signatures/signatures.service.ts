import { Injectable, NotFoundException, ForbiddenException, Inject, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService, signatureAclSource } from '../permissions/permissions.service';
import { FilesService } from '../files/files.service';
import { ObjectStorageService, OBJECT_STORAGE } from '../object-storage';
import { ActivityService } from '../activity/activity.service';
import { NotificationsService } from '../notifications/notifications.service';
import * as crypto from 'crypto';
import { PDFDocument } from 'pdf-lib';

export interface SignatureParticipant {
  email: string;
  name: string;
  userId?: string;
  signingOrder: number;
}

/** Where to stamp the signature. Coordinates are percentages of the page/document box. */
export interface SignaturePlacement {
  /** 1-based page index for PDFs. Ignored for rich-text (treated as continuous). */
  page: number;
  /** 0–100 from the left edge */
  xPercent: number;
  /** 0–100 from the top edge */
  yPercent: number;
  /** Signature image width as % of page width (default 22) */
  widthPercent?: number;
}

@Injectable()
export class SignaturesService {
  private readonly logger = new Logger(SignaturesService.name);

  constructor(
    private prisma: PrismaService,
    private permissionsService: PermissionsService,
    private filesService: FilesService,
    @Inject(OBJECT_STORAGE) private objectStorage: ObjectStorageService,
    private activityService: ActivityService,
    private notificationsService: NotificationsService,
  ) {}

  async createRequest(
    fileId: string,
    participants: SignatureParticipant[],
    createdBy: string,
    companyId: string | null,
  ) {
    await this.permissionsService.assertPermission(createdBy, 'file', fileId, 'write');

    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Masters / Group Secretaries have no home company — use the file's company.
    const requestCompanyId = companyId || file.companyId;
    if (file.companyId !== requestCompanyId) {
      throw new ForbiddenException('File does not belong to your company');
    }

    if (!participants?.length) {
      throw new BadRequestException('At least one participant is required');
    }

    // Resolve emails → userIds so ACL grants work for directory picks and
    // manual email invites of known users.
    const resolvedParticipants = await this.resolveParticipantUsers(participants);

    const requester = await this.prisma.user.findUnique({
      where: { id: createdBy },
      select: { id: true, name: true, email: true },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const signatureRequest = await tx.signatureRequest.create({
        data: {
          fileId,
          companyId: requestCompanyId,
          createdBy,
          status: 'pending',
        },
      });

      const signatureParticipants = await Promise.all(
        resolvedParticipants.map((participant, index) =>
          tx.signatureParticipant.create({
            data: {
              requestId: signatureRequest.id,
              email: participant.email,
              name: participant.name,
              userId: participant.userId,
              signingOrder: participant.signingOrder || index + 1,
              status: 'pending',
            },
          }),
        ),
      );

      try {
        await this.activityService.createActivity({
          userId: createdBy,
          companyId: requestCompanyId,
          activityType: 'signature_request_created',
          resourceType: 'file',
          resourceId: fileId,
          description: `Created signature request for ${file.fileName}`,
          metadata: {
            requestId: signatureRequest.id,
            participantCount: participants.length,
          },
        });
      } catch {
        // non-fatal
      }

      return {
        ...signatureRequest,
        participants: signatureParticipants,
      };
    });

    // Temporary document access for signers who cannot already open the file
    // (creators / company secretaries are skipped). Revoked when the request completes.
    await this.grantTemporaryAccessForRequest(
      result.id,
      fileId,
      result.participants,
      { id: createdBy, name: requester?.name, email: requester?.email },
    );

    await this.notifyParticipantsOfRequest({
      requestId: result.id,
      fileId,
      fileName: file.fileName,
      companyId: requestCompanyId,
      requester: {
        id: createdBy,
        name: requester?.name || requester?.email || 'Someone',
      },
      participants: result.participants,
    });

    return result;
  }

  /**
   * Grant read ACL to each participant who cannot already open the document.
   * Tagged with `source: signature:<requestId>` so completion can revoke safely.
   */
  private async grantTemporaryAccessForRequest(
    requestId: string,
    fileId: string,
    participants: Array<{ userId: string | null; name: string; email: string }>,
    actor: { id: string; name?: string; email?: string },
  ) {
    const source = signatureAclSource(requestId);
    for (const participant of participants) {
      if (!participant.userId) continue;
      try {
        await this.permissionsService.grantUserFileAccess(
          fileId,
          participant.userId,
          ['read'],
          actor,
          {
            source,
            subjectName: participant.name || participant.email,
            // Signature flow sends its own richer in-app + email notice.
            notify: false,
          },
        );
      } catch (err) {
        this.logger.warn(
          `Failed to grant signature access to ${participant.email} on ${fileId}: ${
            err instanceof Error ? err.message : err
          }`,
        );
      }
    }
  }

  private async notifyParticipantsOfRequest(input: {
    requestId: string;
    fileId: string;
    fileName: string;
    companyId: string | null;
    requester: { id: string; name: string };
    participants: Array<{
      userId: string | null;
      name: string;
      email: string;
    }>;
  }) {
    const { requestId, fileId, fileName, companyId, requester, participants } =
      input;

    for (const participant of participants) {
      const title = 'Signature requested';
      const message = `${requester.name} asked you to sign "${fileName}".`;
      const emailPayload = {
        fileName,
        fileId,
        requesterName: requester.name,
        participantName: participant.name,
      };

      try {
        if (participant.userId) {
          await this.notificationsService.create({
            userId: participant.userId,
            companyId,
            type: 'signature_requested',
            title,
            message,
            resourceType: 'file',
            resourceId: fileId,
            read: false,
            emailPayload: { ...emailPayload, requestId },
          });
        } else if (participant.email) {
          await this.notificationsService.sendEmailOnly(
            participant.email,
            'signature_requested',
            emailPayload,
          );
        }
      } catch (err) {
        this.logger.warn(
          `Failed to notify signer ${participant.email}: ${
            err instanceof Error ? err.message : err
          }`,
        );
      }
    }
  }

  private async notifyRequestCompleted(input: {
    requestId: string;
    fileId: string;
    fileName: string;
    companyId: string | null;
    createdBy: string;
    signerName: string;
  }) {
    const { fileId, fileName, companyId, createdBy, signerName } = input;
    try {
      await this.notificationsService.create({
        userId: createdBy,
        companyId,
        type: 'signature_completed',
        title: 'Signing complete',
        message: `All signatures collected for "${fileName}". Last signer: ${signerName}.`,
        resourceType: 'file',
        resourceId: fileId,
        read: false,
        emailPayload: {
          fileName,
          fileId,
          signerName,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to notify requester of completed signatures: ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
  }

  private async revokeTemporaryAccessForRequest(
    requestId: string,
    fileId: string,
    actor: { id: string; name?: string; email?: string },
  ) {
    try {
      await this.permissionsService.revokeSignatureFileAccess(
        fileId,
        requestId,
        actor,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to revoke signature access for request ${requestId}: ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
  }

  private async resolveParticipantUsers(
    participants: SignatureParticipant[],
  ): Promise<SignatureParticipant[]> {
    const emailsNeedingLookup = participants
      .filter((p) => !p.userId && p.email)
      .map((p) => p.email.toLowerCase());

    const byEmail = new Map<string, string>();
    if (emailsNeedingLookup.length) {
      const users = await this.prisma.user.findMany({
        where: {
          email: { in: emailsNeedingLookup, mode: 'insensitive' },
        },
        select: { id: true, email: true },
      });
      for (const u of users) {
        byEmail.set(u.email.toLowerCase(), u.id);
      }
    }

    return participants.map((p) => ({
      ...p,
      userId:
        p.userId ||
        (p.email ? byEmail.get(p.email.toLowerCase()) : undefined) ||
        undefined,
    }));
  }

  async getRequest(id: string, userId: string) {
    const request = await this.prisma.signatureRequest.findUnique({
      where: { id },
      include: {
        file: {
          include: { richTextDoc: true },
        },
        participants: { orderBy: { signingOrder: 'asc' } },
        events: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Signature request not found');
    }

    const isParticipant = request.participants.some((p) => p.userId === userId);
    if (!isParticipant) {
      await this.permissionsService.assertPermission(userId, 'file', request.fileId, 'read');
    }

    return request;
  }

  async listForFile(fileId: string, userId: string) {
    await this.permissionsService.assertPermission(userId, 'file', fileId, 'read');

    return this.prisma.signatureRequest.findMany({
      where: { fileId },
      include: {
        participants: { orderBy: { signingOrder: 'asc' } },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async sign(
    requestId: string,
    participantId: string,
    signatureImageData: string,
    user: any,
    placement: SignaturePlacement,
    ipAddress?: string,
    userAgent?: string,
  ) {
    this.assertPlacement(placement);

    const request = await this.prisma.signatureRequest.findUnique({
      where: { id: requestId },
      include: {
        file: {
          include: {
            richTextDoc: true,
            fileVersions: { orderBy: { versionNumber: 'desc' }, take: 1 },
          },
        },
        participants: {
          orderBy: { signingOrder: 'asc' },
        },
        events: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Signature request not found');
    }

    const participant = request.participants.find((p) => p.id === participantId);
    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    if (participant.userId && participant.userId !== user.id) {
      throw new ForbiddenException('You cannot sign for this participant');
    }

    if (!participant.userId && participant.email !== user.email) {
      throw new ForbiddenException('Email mismatch');
    }

    if (participant.status === 'signed') {
      throw new ForbiddenException('Participant has already signed');
    }

    const previousParticipants = request.participants.filter(
      (p) => p.signingOrder < participant.signingOrder,
    );
    const unsignedPrevious = previousParticipants.filter((p) => p.status !== 'signed');
    if (unsignedPrevious.length > 0) {
      throw new ForbiddenException('Previous participants must sign first');
    }

    const lastEvent = request.events[0];
    const previousHash = lastEvent ? lastEvent.contentHash : null;

    const isPdf =
      request.file.fileType === 'pdf' ||
      request.file.fileType === 'application/pdf' ||
      request.file.fileName?.toLowerCase().endsWith('.pdf');

    const isRichText =
      !!request.file.richTextDoc ||
      request.file.fileType === 'html' ||
      request.file.fileType === 'text/html';

    const result = await this.prisma.$transaction(async (tx) => {
      let contentHash: string;
      const widthPercent = placement.widthPercent ?? 22;

      if (isPdf && request.file.storagePath) {
        contentHash = await this.stampPdf({
          tx,
          request,
          participant,
          user,
          signatureImageData,
          placement: { ...placement, widthPercent },
        });
      } else if (isRichText && request.file.richTextDoc) {
        contentHash = await this.stampRichText({
          tx,
          request,
          participant,
          user,
          signatureImageData,
          placement: { ...placement, widthPercent },
        });
      } else {
        contentHash = crypto
          .createHash('sha256')
          .update(
            JSON.stringify({
              requestId,
              participantId,
              timestamp: new Date().toISOString(),
              placement,
              signatureData: signatureImageData.slice(0, 64),
            }),
          )
          .digest('hex');
      }

      await tx.signatureParticipant.update({
        where: { id: participantId },
        data: {
          status: 'signed',
          signedAt: new Date(),
          signatureImageData,
        },
      });

      await tx.signatureEvent.create({
        data: {
          requestId,
          participantId,
          eventType: 'signature',
          contentHash,
          previousHash,
          ipAddress,
          userAgent,
          metadata: {
            participantName: participant.name,
            participantEmail: participant.email,
            placement: {
              page: placement.page,
              xPercent: placement.xPercent,
              yPercent: placement.yPercent,
              widthPercent: placement.widthPercent ?? null,
            },
          } as any,
        },
      });

      const allParticipants = await tx.signatureParticipant.findMany({
        where: { requestId },
      });
      const allSigned = allParticipants.every((p) => p.status === 'signed');

      if (allSigned) {
        await tx.signatureRequest.update({
          where: { id: requestId },
          data: { status: 'completed' },
        });
      }

      try {
        await this.activityService.createActivity({
          userId: user.id,
          companyId: user.companyId || request.companyId,
          activityType: 'document_signed',
          resourceType: 'file',
          resourceId: request.fileId,
          description: `Signed document: ${request.file.fileName}`,
          metadata: {
            requestId,
            participantId,
            allCompleted: allSigned,
            placement,
          },
        });
      } catch {
        // non-fatal
      }

      return {
        success: true,
        contentHash,
        allCompleted: allSigned,
        placement,
        fileId: request.fileId,
      };
    });

    if (result.allCompleted) {
      await this.revokeTemporaryAccessForRequest(requestId, result.fileId, {
        id: user.id,
        name: user.name,
        email: user.email,
      });

      await this.notifyRequestCompleted({
        requestId,
        fileId: result.fileId,
        fileName: request.file.fileName,
        companyId: request.companyId,
        createdBy: request.createdBy,
        signerName: participant.name || user.name || user.email || 'A signer',
      });
    }

    const { fileId: _fileId, ...response } = result;
    return response;
  }

  private assertPlacement(placement: SignaturePlacement) {
    if (!placement || typeof placement.page !== 'number' || placement.page < 1) {
      throw new BadRequestException('placement.page must be a 1-based page number');
    }
    for (const key of ['xPercent', 'yPercent'] as const) {
      const v = placement[key];
      if (typeof v !== 'number' || v < 0 || v > 100) {
        throw new BadRequestException(`placement.${key} must be between 0 and 100`);
      }
    }
    if (
      placement.widthPercent !== undefined &&
      (placement.widthPercent < 5 || placement.widthPercent > 60)
    ) {
      throw new BadRequestException('placement.widthPercent must be between 5 and 60');
    }
  }

  private async stampPdf(args: {
    tx: any;
    request: any;
    participant: any;
    user: any;
    signatureImageData: string;
    placement: SignaturePlacement & { widthPercent: number };
  }): Promise<string> {
    const { tx, request, participant, user, signatureImageData, placement } = args;

    try {
      const fileStream = await this.objectStorage.getStream(request.file.storagePath);
      const fileBuffer = await this.streamToBuffer(fileStream);
      const pdfDoc = await PDFDocument.load(fileBuffer);
      const pages = pdfDoc.getPages();
      const pageIndex = Math.min(placement.page, pages.length) - 1;
      const page = pages[pageIndex];
      const { width, height } = page.getSize();

      const base64Data = signatureImageData.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
      const signatureBuffer = Buffer.from(base64Data, 'base64');
      const signatureImage = await pdfDoc.embedPng(signatureBuffer);

      const stampWidth = (placement.widthPercent / 100) * width;
      const aspect = signatureImage.height / signatureImage.width || 0.35;
      const stampHeight = stampWidth * aspect;

      // UI yPercent is from the top; PDF coords are from the bottom.
      const x = (placement.xPercent / 100) * width;
      const yFromTop = (placement.yPercent / 100) * height;
      const y = height - yFromTop - stampHeight;

      page.drawImage(signatureImage, {
        x,
        y,
        width: stampWidth,
        height: stampHeight,
      });

      const newFileContent = Buffer.from(await pdfDoc.save());
      const contentHash = crypto.createHash('sha256').update(newFileContent).digest('hex');

      const newStoragePath = await this.objectStorage.put(
        `${request.file.companyId}/${request.file.id}/signed_${Date.now()}.pdf`,
        newFileContent,
        'application/pdf',
      );

      // Snapshot the pre-sign file so Versions → Restore can roll back.
      // (Versions store historical paths; File.storagePath is always "current".)
      const lastVersion = await tx.fileVersion.findFirst({
        where: { fileId: request.fileId },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true },
      });
      const nextVersion = (lastVersion?.versionNumber ?? 0) + 1;

      await tx.fileVersion.create({
        data: {
          fileId: request.fileId,
          versionNumber: nextVersion,
          storagePath: request.file.storagePath,
          createdBy: user.id,
        },
      });

      // Cap history at 10 snapshots (same policy as manual uploads)
      const allVersions = await tx.fileVersion.findMany({
        where: { fileId: request.fileId },
        orderBy: { versionNumber: 'desc' },
        select: { id: true },
      });
      if (allVersions.length > 10) {
        await tx.fileVersion.deleteMany({
          where: { id: { in: allVersions.slice(10).map((v) => v.id) } },
        });
      }

      await tx.file.update({
        where: { id: request.fileId },
        data: {
          storagePath: newStoragePath,
          fileSize: BigInt(newFileContent.length),
        },
      });

      return contentHash;
    } catch (error) {
      console.error('PDF stamping error:', error);
      return crypto
        .createHash('sha256')
        .update(
          JSON.stringify({
            requestId: request.id,
            participantId: participant.id,
            placement,
            timestamp: new Date().toISOString(),
          }),
        )
        .digest('hex');
    }
  }

  private async stampRichText(args: {
    tx: any;
    request: any;
    participant: any;
    user: any;
    signatureImageData: string;
    placement: SignaturePlacement & { widthPercent: number };
  }): Promise<string> {
    const { tx, request, participant, user, signatureImageData, placement } = args;
    const current = request.file.richTextDoc.htmlContent || '';

    // Snapshot current HTML before stamping so rollback works
    const lastVersion = await tx.fileVersion.findFirst({
      where: { fileId: request.fileId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    await tx.fileVersion.create({
      data: {
        fileId: request.fileId,
        versionNumber: (lastVersion?.versionNumber ?? 0) + 1,
        storagePath: `rich-text-content://${Buffer.from(current).toString('base64')}`,
        createdBy: user.id,
      },
    });

    const stamp = `
<div class="dt-signature-stamp" data-signer="${escapeHtml(participant.name || '')}" data-signed-at="${new Date().toISOString()}" style="position:absolute;left:${placement.xPercent}%;top:${placement.yPercent}%;width:${placement.widthPercent}%;z-index:5;pointer-events:none;">
  <img src="${signatureImageData}" alt="Signature" style="width:100%;height:auto;display:block;" />
</div>`.trim();

    let nextHtml: string;
    if (current.includes('class="dt-richtext-signable"') || current.includes("class='dt-richtext-signable'")) {
      nextHtml = current.replace(
        /(class=["']dt-richtext-signable["'][^>]*>)/i,
        `$1${stamp}`,
      );
    } else {
      nextHtml = `<div class="dt-richtext-signable" style="position:relative;min-height:100%;">${stamp}${current}</div>`;
    }

    await tx.richTextDocument.update({
      where: { fileId: request.fileId },
      data: { htmlContent: nextHtml },
    });

    return crypto.createHash('sha256').update(nextHtml).digest('hex');
  }

  private async streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
