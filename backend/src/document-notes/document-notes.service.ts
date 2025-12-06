import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { WebSocketGateway } from '../websocket/websocket.gateway';

@Injectable()
export class DocumentNotesService {
  constructor(
    private prisma: PrismaService,
    private activityService: ActivityService,
    private wsGateway: WebSocketGateway,
  ) {}

  async getDocumentNotes(documentId: string, userId: string) {
    return this.prisma.documentNote.findMany({
      where: {
        documentId,
        OR: [
          { isPublic: true },
          { createdBy: userId },
        ],
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async createNote(
    documentId: string,
    data: { content: string; isPublic: boolean },
    currentUser: any,
  ) {
    const note = await this.prisma.documentNote.create({
      data: {
        documentId,
        content: data.content,
        isPublic: data.isPublic,
        createdBy: currentUser.id,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        document: {
          select: {
            companyId: true,
          },
        },
      },
    });

    // Log activity
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

    // Emit WebSocket event
    this.wsGateway.emitDocumentUpdate(documentId, { type: 'note_added', note });

    return note;
  }

  async updateNote(noteId: string, data: { content?: string; isPublic?: boolean }, currentUser: any) {
    const note = await this.prisma.documentNote.findUnique({
      where: { id: noteId },
    });
    if (!note || note.createdBy !== currentUser.id) {
      throw new Error('Note not found or unauthorized');
    }
    return this.prisma.documentNote.update({
      where: { id: noteId },
      data,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async deleteNote(noteId: string, currentUser: any) {
    const note = await this.prisma.documentNote.findUnique({
      where: { id: noteId },
    });
    if (!note || note.createdBy !== currentUser.id) {
      throw new Error('Note not found or unauthorized');
    }
    return this.prisma.documentNote.delete({
      where: { id: noteId },
    });
  }
}

