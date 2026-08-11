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
import { CapabilityGuard, RequireCapability } from '../permissions/require-capability.decorator';
import {
  CreateDocumentNoteDto,
  UpdateDocumentNoteDto,
} from './dto/document-note.dto';

@Controller('document-notes')
export class DocumentNotesController {
  constructor(private documentNotesService: DocumentNotesService) {}

  @Get('document/:documentId')
  @RequireCapability('documents.view')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async getDocumentNotes(@Param('documentId') documentId: string, @Request() req) {
    return this.documentNotesService.getDocumentNotes(documentId, req.user.id);
  }

  @Post('document/:documentId')
  @RequireCapability('documents.edit')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async createNote(
    @Param('documentId') documentId: string,
    @Body() body: CreateDocumentNoteDto,
    @Request() req: any,
  ) {
    return this.documentNotesService.createNote(documentId, body, req.user);
  }

  @Put(':id')
  @RequireCapability('documents.edit')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async updateNote(
    @Param('id') id: string,
    @Body() body: UpdateDocumentNoteDto,
    @Request() req: any,
  ) {
    return this.documentNotesService.updateNote(id, body, req.user);
  }

  @Delete(':id')
  @RequireCapability('documents.edit')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async deleteNote(@Param('id') id: string, @Request() req: any) {
    return this.documentNotesService.deleteNote(id, req.user);
  }
}

