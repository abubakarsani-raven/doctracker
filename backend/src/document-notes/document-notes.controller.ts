import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { DocumentNotesService } from './document-notes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('document-notes')
@UseGuards(JwtAuthGuard)
export class DocumentNotesController {
  constructor(private documentNotesService: DocumentNotesService) {}

  @Get('document/:documentId')
  async getDocumentNotes(@Param('documentId') documentId: string, @Request() req) {
    return this.documentNotesService.getDocumentNotes(documentId, req.user.id);
  }

  @Post('document/:documentId')
  async createNote(
    @Param('documentId') documentId: string,
    @Body() body: { content: string; isPublic: boolean },
    @Request() req: any,
  ) {
    return this.documentNotesService.createNote(documentId, body, req.user);
  }

  @Put(':id')
  async updateNote(
    @Param('id') id: string,
    @Body() body: { content?: string; isPublic?: boolean },
    @Request() req: any,
  ) {
    return this.documentNotesService.updateNote(id, body, req.user);
  }

  @Delete(':id')
  async deleteNote(@Param('id') id: string, @Request() req: any) {
    return this.documentNotesService.deleteNote(id, req.user);
  }
}

