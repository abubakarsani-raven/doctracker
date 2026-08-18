import { Injectable, NotFoundException, ForbiddenException, Inject, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService, signatureAclSource } from '../permissions/permissions.service';
import { FilesService } from '../files/files.service';
import { ObjectStorageService, OBJECT_STORAGE } from '../object-storage';
import { ActivityService } from '../activity/activity.service';
import { NotificationsService } from '../notifications/notifications.service';
import * as crypto from 'crypto';
import { PDFDocument } from 'pdf-lib';
import {
  isPdfFile,
  isRichTextFile,
  isSignableFile,
  UNSUPPORTED_SIGNATURE_TYPE_MESSAGE,
} from './signable-file';

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

/** How long a signer may edit or remove their own stamp after signing. */
export const SIGNATURE_EDIT_WINDOW_MS = 5 * 60 * 1000;

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
      include: { richTextDoc: { select: { id: true } } },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Fail here rather than at signing time, so nobody chases down signers for
    // a document that can never be stamped.
    if (!isSignableFile(file)) {
      throw new BadRequestException(UNSUPPORTED_SIGNATURE_TYPE_MESSAGE);
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

  private async notifyRequesterOfSignature(input: {
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
        type: 'signature_signed',
        title: 'Document signed',
        message: `${signerName} signed "${fileName}".`,
        resourceType: 'file',
        resourceId: fileId,
        read: false,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to notify requester of signature: ${
          err instanceof Error ? err.message : err
        }`,
      );
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
      .filter((p) => p.email)
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

    // Never trust client-supplied userId — resolve identity from email only.
    return participants.map((p) => ({
      ...p,
      userId: p.email
        ? byEmail.get(p.email.toLowerCase()) || undefined
        : undefined,
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
    const isParticipant = await this.prisma.signatureParticipant.findFirst({
      where: { userId, request: { fileId } },
      select: { id: true },
    });
    if (!isParticipant) {
      await this.permissionsService.assertPermission(userId, 'file', fileId, 'read');
    }

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

  // ── Saved signatures (reusable profile stamps) ──────────────────────────

  private static readonly MAX_SAVED_SIGNATURES = 8;
  private static readonly MAX_IMAGE_DATA_CHARS = 900_000; // ~675KB base64

  private assertSignatureImageData(imageData: string) {
    if (!imageData || typeof imageData !== 'string') {
      throw new BadRequestException('Signature image is required');
    }
    if (!imageData.startsWith('data:image/')) {
      throw new BadRequestException('Signature must be an image data URL');
    }
    if (imageData.length > SignaturesService.MAX_IMAGE_DATA_CHARS) {
      throw new BadRequestException('Signature image is too large');
    }
  }

  private normalizeLabel(label: string): string {
    const trimmed = (label || '').trim();
    if (!trimmed) throw new BadRequestException('Label is required');
    if (trimmed.length > 80) {
      throw new BadRequestException('Label must be 80 characters or fewer');
    }
    return trimmed;
  }

  async listSavedSignatures(userId: string) {
    return this.prisma.userSavedSignature.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        label: true,
        imageData: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async createSavedSignature(
    userId: string,
    data: { label: string; imageData: string; isDefault?: boolean },
  ) {
    const label = this.normalizeLabel(data.label);
    this.assertSignatureImageData(data.imageData);

    const count = await this.prisma.userSavedSignature.count({
      where: { userId },
    });
    if (count >= SignaturesService.MAX_SAVED_SIGNATURES) {
      throw new BadRequestException(
        `You can save up to ${SignaturesService.MAX_SAVED_SIGNATURES} signatures. Delete one first.`,
      );
    }

    const makeDefault = data.isDefault === true || count === 0;

    return this.prisma.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.userSavedSignature.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.userSavedSignature.create({
        data: {
          userId,
          label,
          imageData: data.imageData,
          isDefault: makeDefault,
        },
        select: {
          id: true,
          label: true,
          imageData: true,
          isDefault: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });
  }

  async updateSavedSignature(
    userId: string,
    id: string,
    data: { label?: string; imageData?: string; isDefault?: boolean },
  ) {
    const existing = await this.prisma.userSavedSignature.findUnique({
      where: { id },
    });
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Saved signature not found');
    }

    const nextLabel =
      data.label !== undefined ? this.normalizeLabel(data.label) : undefined;
    if (data.imageData !== undefined) {
      this.assertSignatureImageData(data.imageData);
    }

    return this.prisma.$transaction(async (tx) => {
      if (data.isDefault === true) {
        await tx.userSavedSignature.updateMany({
          where: { userId, isDefault: true, NOT: { id } },
          data: { isDefault: false },
        });
      }

      return tx.userSavedSignature.update({
        where: { id },
        data: {
          ...(nextLabel !== undefined ? { label: nextLabel } : {}),
          ...(data.imageData !== undefined
            ? { imageData: data.imageData }
            : {}),
          ...(data.isDefault !== undefined
            ? { isDefault: data.isDefault }
            : {}),
        },
        select: {
          id: true,
          label: true,
          imageData: true,
          isDefault: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });
  }

  async deleteSavedSignature(userId: string, id: string) {
    const existing = await this.prisma.userSavedSignature.findUnique({
      where: { id },
    });
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Saved signature not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userSavedSignature.delete({ where: { id } });
      if (existing.isDefault) {
        const next = await tx.userSavedSignature.findFirst({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
        });
        if (next) {
          await tx.userSavedSignature.update({
            where: { id: next.id },
            data: { isDefault: true },
          });
        }
      }
    });

    return { ok: true };
  }

  async getSavedSignatureImage(userId: string, id: string): Promise<string> {
    const row = await this.prisma.userSavedSignature.findUnique({
      where: { id },
    });
    if (!row || row.userId !== userId) {
      throw new NotFoundException('Saved signature not found');
    }
    return row.imageData;
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

    if (request.status === 'cancelled') {
      throw new ForbiddenException('This signature request was cancelled');
    }

    const participant = request.participants.find((p) => p.id === participantId);
    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    if (participant.userId && participant.userId !== user.id) {
      throw new ForbiddenException('You cannot sign for this participant');
    }

    if (
      !participant.userId &&
      participant.email?.toLowerCase() !== user.email?.toLowerCase()
    ) {
      throw new ForbiddenException('Email mismatch');
    }

    const isResign = participant.status === 'signed';

    if (request.status === 'completed' && !isResign) {
      throw new ForbiddenException('This signature request is already complete');
    }
    if (request.status !== 'pending' && request.status !== 'completed') {
      throw new ForbiddenException(
        `Cannot sign a request in status "${request.status}"`,
      );
    }

    // Later signers may already have stamped on top of this signature — editing
    // would erase their work, so only the latest signer may revise.
    if (isResign) {
      this.assertSignatureStillEditable(participant, request.participants);
    } else if (request.status !== 'pending') {
      throw new ForbiddenException(
        'This signature request is not open for signing',
      );
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
    const priorSignEvent = isResign
      ? request.events.find(
          (e) =>
            e.participantId === participantId &&
            (e.eventType === 'signature' || e.eventType === 'signature_revised'),
        )
      : null;
    const priorMeta = (priorSignEvent?.metadata ?? null) as Record<
      string,
      unknown
    > | null;

    const isPdf = isPdfFile(request.file);
    const isRichText = isRichTextFile(request.file);

    // Older requests may predate the create-time check, and a file can change
    // type via a new version — so re-check before stamping.
    if (!isPdf && !isRichText) {
      throw new BadRequestException(UNSUPPORTED_SIGNATURE_TYPE_MESSAGE);
    }

    // Restore the pre-stamp file so a corrected signature replaces the old one
    // instead of stacking a second stamp.
    if (isResign && isPdf) {
      let restorePath =
        typeof priorMeta?.preSignStoragePath === 'string'
          ? (priorMeta.preSignStoragePath as string)
          : null;
      if (!restorePath) {
        // Legacy signatures (before preSignStoragePath was stored): use the
        // version snapshot created at sign time (points at the pre-stamp file).
        const snap = await this.prisma.fileVersion.findFirst({
          where: {
            fileId: request.fileId,
            createdBy: user.id,
            createdAt: participant.signedAt
              ? {
                  gte: new Date(
                    new Date(participant.signedAt).getTime() - 60_000,
                  ),
                  lte: new Date(
                    new Date(participant.signedAt).getTime() + 60_000,
                  ),
                }
              : undefined,
          },
          orderBy: { versionNumber: 'desc' },
        });
        restorePath = snap?.storagePath ?? null;
      }
      if (!restorePath) {
        throw new BadRequestException(
          'Cannot revise this signature because the previous version is unavailable. Ask for a new signature request.',
        );
      }
      request.file.storagePath = restorePath;
    }

    const preSignStoragePath = request.file.storagePath ?? null;

    const result = await this.prisma.$transaction(async (tx) => {
      // Serialize stamps on this file so concurrent signers cannot overwrite
      // each other's PDF (lost stamp / broken hash chain).
      const lockedFiles = await tx.$queryRawUnsafe<
        Array<{ id: string; storage_path: string | null }>
      >(
        // file ids are Prisma string UUIDs stored as TEXT, not Postgres uuid
        `SELECT id, storage_path FROM files WHERE id = $1 FOR UPDATE`,
        request.fileId,
      );
      const locked = lockedFiles[0];
      if (!locked) {
        throw new BadRequestException('File not found for signing');
      }
      // Prefer the locked row's current path (unless resign restored a snapshot).
      if (!isResign || !request.file.storagePath) {
        request.file.storagePath = locked.storage_path;
      }

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
          description: isResign
            ? `Saved before signature update by ${
                participant.name || user.name || user.email || 'signer'
              }`
            : `Saved before signature by ${
                participant.name || user.name || user.email || 'signer'
              }`,
        });
      } else if (isRichText && request.file.richTextDoc) {
        contentHash = await this.stampRichText({
          tx,
          request,
          participant,
          user,
          signatureImageData,
          placement: { ...placement, widthPercent },
          replaceExisting: isResign,
          description: isResign
            ? `Saved before signature update by ${
                participant.name || user.name || user.email || 'signer'
              }`
            : `Saved before signature by ${
                participant.name || user.name || user.email || 'signer'
              }`,
        });
      } else {
        // Type says signable but the content to stamp is missing (PDF with no
        // stored object, rich text with no document row). Recording a hash here
        // would mark the request signed against an untouched document.
        throw new BadRequestException(
          'This document cannot be signed because its stored content is unavailable. Upload a new version and try again.',
        );
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
          eventType: isResign ? 'signature_revised' : 'signature',
          contentHash,
          previousHash,
          ipAddress,
          userAgent,
          metadata: {
            participantName: participant.name,
            participantEmail: participant.email,
            revised: isResign,
            preSignStoragePath: isPdf ? preSignStoragePath : undefined,
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
      let linkedActionWorkflowId: string | undefined;

      if (allSigned) {
        await tx.signatureRequest.update({
          where: { id: requestId },
          data: { status: 'completed' },
        });

        // Complete any workflow action linked to this signature request
        const linkedAction = await tx.action.findFirst({
          where: { signatureRequestId: requestId },
          select: { id: true, workflowId: true, status: true },
        });
        if (linkedAction) {
          linkedActionWorkflowId = linkedAction.workflowId;
          if (linkedAction.status !== 'completed') {
            await tx.action.update({
              where: { id: linkedAction.id },
              data: {
                status: 'completed',
                completedAt: new Date(),
                completedBy: user.id,
                resolutionNotes: 'All signatures collected',
              },
            });
          }
        }
      } else if (isResign && request.status === 'completed') {
        // Should not normally happen, but keep request pending if resign broke completion.
        await tx.signatureRequest.update({
          where: { id: requestId },
          data: { status: 'pending' },
        });

        const linkedAction = await tx.action.findFirst({
          where: { signatureRequestId: requestId },
          select: { id: true, workflowId: true },
        });
        if (linkedAction) {
          linkedActionWorkflowId = linkedAction.workflowId;
          await tx.action.update({
            where: { id: linkedAction.id },
            data: {
              status: 'in_progress',
              completedAt: null,
              completedBy: null,
            },
          });
        }
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
        linkedActionWorkflowId,
      };
    });

    const signerName =
      participant.name || user.name || user.email || 'A signer';

    // Don't spam the requester when a signer is only revising their stamp,
    // or when the requester signed their own request.
    if (!isResign && request.createdBy !== user.id) {
      if (result.allCompleted) {
        await this.notifyRequestCompleted({
          requestId,
          fileId: result.fileId,
          fileName: request.file.fileName,
          companyId: request.companyId,
          createdBy: request.createdBy,
          signerName,
        });
      } else {
        await this.notifyRequesterOfSignature({
          fileId: result.fileId,
          fileName: request.file.fileName,
          companyId: request.companyId,
          createdBy: request.createdBy,
          signerName,
        });
      }
    }

    if (result.allCompleted) {
      await this.revokeTemporaryAccessForRequest(requestId, result.fileId, {
        id: user.id,
        name: user.name,
        email: user.email,
      });
      if (result.linkedActionWorkflowId) {
        await this.refreshWorkflowProgress(result.linkedActionWorkflowId);
      }
    }

    const { fileId: _fileId, linkedActionWorkflowId: _wf, ...response } = result;
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

  /** Edit/remove only within the grace window and before a later signer stamps. */
  private assertSignatureStillEditable(
    participant: { signingOrder: number; signedAt: Date | null },
    participants: Array<{ signingOrder: number; status: string }>,
  ) {
    const laterSigned = participants.some(
      (p) =>
        p.signingOrder > participant.signingOrder && p.status === 'signed',
    );
    if (laterSigned) {
      throw new ForbiddenException(
        'Cannot change signature after a later participant has already signed',
      );
    }
    if (!participant.signedAt) {
      throw new ForbiddenException('Signature timestamp is missing');
    }
    const elapsed = Date.now() - new Date(participant.signedAt).getTime();
    if (elapsed > SIGNATURE_EDIT_WINDOW_MS) {
      throw new ForbiddenException(
        'The 5-minute window to edit or remove this signature has expired',
      );
    }
  }

  /**
   * Remove the caller's stamp and reopen their participant slot (within the
   * 5-minute edit window). Restores the pre-sign file so later signers see a
   * clean document.
   */
  async removeSignature(
    requestId: string,
    participantId: string,
    user: any,
  ) {
    const request = await this.prisma.signatureRequest.findUnique({
      where: { id: requestId },
      include: {
        file: { include: { richTextDoc: true } },
        participants: { orderBy: { signingOrder: 'asc' } },
        events: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!request) {
      throw new NotFoundException('Signature request not found');
    }

    const participant = request.participants.find((p) => p.id === participantId);
    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    if (participant.status !== 'signed') {
      throw new BadRequestException('This participant has not signed yet');
    }

    if (participant.userId && participant.userId !== user.id) {
      throw new ForbiddenException('You cannot remove this signature');
    }
    if (
      !participant.userId &&
      participant.email?.toLowerCase() !== user.email?.toLowerCase()
    ) {
      throw new ForbiddenException('Email mismatch');
    }

    this.assertSignatureStillEditable(participant, request.participants);

    const priorSignEvent = request.events.find(
      (e) =>
        e.participantId === participantId &&
        (e.eventType === 'signature' || e.eventType === 'signature_revised'),
    );
    const priorMeta = (priorSignEvent?.metadata ?? null) as Record<
      string,
      unknown
    > | null;

    const isPdf = isPdfFile(request.file);
    const isRichText = isRichTextFile(request.file);

    let restorePath: string | null =
      typeof priorMeta?.preSignStoragePath === 'string'
        ? (priorMeta.preSignStoragePath as string)
        : null;
    if (!restorePath && isPdf) {
      const snap = await this.prisma.fileVersion.findFirst({
        where: {
          fileId: request.fileId,
          createdBy: user.id,
          createdAt: participant.signedAt
            ? {
                gte: new Date(
                  new Date(participant.signedAt).getTime() - 60_000,
                ),
                lte: new Date(
                  new Date(participant.signedAt).getTime() + 60_000,
                ),
              }
            : undefined,
        },
        orderBy: { versionNumber: 'desc' },
      });
      restorePath = snap?.storagePath ?? null;
    }

    if (isPdf && !restorePath) {
      throw new BadRequestException(
        'Cannot remove this signature because the previous version is unavailable.',
      );
    }

    const wasCompleted = request.status === 'completed';

    await this.prisma.$transaction(async (tx) => {
      if (isPdf && restorePath) {
        await tx.file.update({
          where: { id: request.fileId },
          data: { storagePath: restorePath },
        });
      } else if (isRichText && request.file.richTextDoc) {
        let html = request.file.richTextDoc.htmlContent || '';
        html = html.replace(
          new RegExp(
            `<div\\s+class="dt-signature-stamp"[^>]*data-participant-id="${escapeRegExp(
              participant.id,
            )}"[^>]*>[\\s\\S]*?<\\/div>`,
            'gi',
          ),
          '',
        );
        if (participant.name) {
          html = html.replace(
            new RegExp(
              `<div\\s+class="dt-signature-stamp"[^>]*data-signer="${escapeRegExp(
                participant.name,
              )}"[^>]*>[\\s\\S]*?<\\/div>`,
              'gi',
            ),
            '',
          );
        }
        await tx.richTextDocument.update({
          where: { fileId: request.fileId },
          data: { htmlContent: html },
        });
      }

      await tx.signatureParticipant.update({
        where: { id: participantId },
        data: {
          status: 'pending',
          signedAt: null,
          signatureImageData: null,
        },
      });

      if (wasCompleted) {
        await tx.signatureRequest.update({
          where: { id: requestId },
          data: { status: 'pending' },
        });

        const linkedAction = await tx.action.findFirst({
          where: { signatureRequestId: requestId },
          select: { id: true },
        });
        if (linkedAction) {
          await tx.action.update({
            where: { id: linkedAction.id },
            data: {
              status: 'in_progress',
              completedAt: null,
              completedBy: null,
              resolutionNotes: null,
            },
          });
        }
      }

      await tx.signatureEvent.create({
        data: {
          requestId,
          participantId,
          eventType: 'signature_removed',
          contentHash: crypto
            .createHash('sha256')
            .update(
              JSON.stringify({
                requestId,
                participantId,
                removedAt: new Date().toISOString(),
              }),
            )
            .digest('hex'),
          previousHash: priorSignEvent?.contentHash ?? null,
          metadata: {
            participantName: participant.name,
            participantEmail: participant.email,
            restoredPath: restorePath,
          } as any,
        },
      });
    });

    // If completion had revoked temp ACL, restore access for remaining signers.
    if (wasCompleted) {
      await this.grantTemporaryAccessForRequest(
        requestId,
        request.fileId,
        request.participants.map((p) => ({
          userId: p.userId,
          name: p.name || p.email,
          email: p.email,
        })),
        { id: user.id, name: user.name, email: user.email },
      );
    }

    return { success: true, status: 'pending' };
  }

  private async stampPdf(args: {
    tx: any;
    request: any;
    participant: any;
    user: any;
    signatureImageData: string;
    placement: SignaturePlacement & { widthPercent: number };
    description?: string;
  }): Promise<string> {
    const { tx, request, participant, user, signatureImageData, placement, description } =
      args;

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
          description:
            description ||
            `Saved before signature by ${
              participant.name || user.name || user.email || 'signer'
            }`,
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
      throw new BadRequestException(
        error instanceof Error
          ? `Couldn’t stamp the PDF: ${error.message}`
          : 'Couldn’t stamp the PDF — storage is unavailable. Try again.',
      );
    }
  }

  private async stampRichText(args: {
    tx: any;
    request: any;
    participant: any;
    user: any;
    signatureImageData: string;
    placement: SignaturePlacement & { widthPercent: number };
    replaceExisting?: boolean;
    description?: string;
  }): Promise<string> {
    const {
      tx,
      request,
      participant,
      user,
      signatureImageData,
      placement,
      replaceExisting = false,
      description,
    } = args;
    let current = request.file.richTextDoc.htmlContent || '';

    // If we restored pre-sign HTML already, current is clean. Otherwise strip
    // any prior stamp for this participant before applying the replacement.
    if (replaceExisting) {
      current = current.replace(
        new RegExp(
          `<div\\s+class="dt-signature-stamp"[^>]*data-participant-id="${escapeRegExp(
            participant.id,
          )}"[^>]*>[\\s\\S]*?<\\/div>`,
          'gi',
        ),
        '',
      );
      // Legacy stamps (before data-participant-id) keyed by signer name.
      if (participant.name) {
        current = current.replace(
          new RegExp(
            `<div\\s+class="dt-signature-stamp"[^>]*data-signer="${escapeRegExp(
              escapeHtml(participant.name),
            )}"[^>]*>[\\s\\S]*?<\\/div>`,
            'gi',
          ),
          '',
        );
      }
    }

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
        description:
          description ||
          `Saved before signature by ${
            participant.name || user.name || user.email || 'signer'
          }`,
      },
    });

    const stamp = `
<div class="dt-signature-stamp" data-participant-id="${escapeHtml(participant.id)}" data-signer="${escapeHtml(participant.name || '')}" data-signed-at="${new Date().toISOString()}" style="position:absolute;left:${placement.xPercent}%;top:${placement.yPercent}%;width:${placement.widthPercent}%;z-index:5;pointer-events:none;">
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

  /** Keep workflow % in sync when a linked signature action completes. */
  private async refreshWorkflowProgress(workflowId: string) {
    try {
      const actions = await this.prisma.action.findMany({
        where: { workflowId },
        select: { status: true },
      });
      if (actions.length === 0) return;

      const progressed = actions.filter((a) =>
        ['completed', 'document_uploaded', 'response_received'].includes(
          a.status,
        ),
      );
      const progress = Math.round((progressed.length / actions.length) * 100);
      const allCompleted = actions.every((a) => a.status === 'completed');

      const workflow = await this.prisma.workflow.findUnique({
        where: { id: workflowId },
        select: { id: true, status: true },
      });
      if (!workflow) return;

      let newStatus = workflow.status;
      if (allCompleted && progress === 100 && workflow.status !== 'completed') {
        newStatus = 'ready_for_review';
      }

      await this.prisma.workflow.update({
        where: { id: workflowId },
        data: { progress, status: newStatus },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to refresh workflow progress for ${workflowId}: ${error}`,
      );
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
