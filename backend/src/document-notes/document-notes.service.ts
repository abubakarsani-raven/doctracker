import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { WebSocketGateway } from '../websocket/websocket.gateway';
import { PermissionsService } from '../permissions/permissions.service';

/**
 * Comments on a document.
 *
 * Every method authorises against the document itself: reading a comment needs
 * `read` on the document, adding one needs `write`. Without that check any
 * signed-in user could read and post on any document by id, across company
 * boundaries — the comment thread would leak what the document itself protects.
 */
@Injectable()
export class DocumentNotesService {
  constructor(
    private prisma: PrismaService,
    private activityService: ActivityService,
    private wsGateway: WebSocketGateway,
    private permissionsService: PermissionsService,
  ) {}

  async getDocumentNotes(documentId: string, userId: string) {
    await this.permissionsService.assertPermission(
      userId,
      'file',
      documentId,
      'read',
    );

    return this.prisma.documentNote.findMany({
      where: {
        documentId,
        // A private note is visible only to its author.
        OR: [{ isPublic: true }, { createdBy: userId }],
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createNote(
    documentId: string,
    data: { content: string; isPublic?: boolean },
    currentUser: any,
  ) {
    // Annotating a document is a change to it, so it takes `write` rather than
    // `read` — a read-only viewer cannot leave comments.
    await this.permissionsService.assertPermission(
      currentUser.id,
      'file',
      documentId,
      'write',
    );

    const content = data?.content?.trim();
    if (!content) {
      throw new ForbiddenException('A comment cannot be empty.');
    }

    const note = await this.prisma.documentNote.create({
      data: {
        documentId,
        content,
        isPublic: data.isPublic ?? true,
        createdBy: currentUser.id,
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
        document: {
          select: { companyId: true },
        },
      },
    });

    try {
      await this.activityService.createActivity({
        userId: currentUser.id,
        companyId: note.document.companyId,
        activityType: 'note_added',
        resourceType: 'document',
        resourceId: documentId,
        description: `Note added to document`,
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }

    this.wsGateway.emitDocumentUpdate(documentId, { type: 'note_added', note });

    return note;
  }

  async updateNote(
    noteId: string,
    data: { content?: string; isPublic?: boolean },
    currentUser: any,
  ) {
    const note = await this.prisma.documentNote.findUnique({
      where: { id: noteId },
    });

    if (!note) {
      throw new NotFoundException('Comment not found');
    }

    // Only the author edits their own words. Someone with `manage` can remove a
    // comment (below), but not rewrite it.
    if (note.createdBy !== currentUser.id) {
      throw new ForbiddenException('You can only edit your own comments.');
    }

    return this.prisma.documentNote.update({
      where: { id: noteId },
      data,
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async deleteNote(noteId: string, currentUser: any) {
    const note = await this.prisma.documentNote.findUnique({
      where: { id: noteId },
    });

    if (!note) {
      throw new NotFoundException('Comment not found');
    }

    if (note.createdBy !== currentUser.id) {
      // Anyone who can manage the document's permissions can also remove a
      // comment on it, so a thread can be moderated.
      await this.permissionsService.assertPermission(
        currentUser.id,
        'file',
        note.documentId,
        'manage',
      );
    }

    return this.prisma.documentNote.delete({ where: { id: noteId } });
  }
}
