import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  Ip,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import {
  SignaturesService,
  SignatureParticipant,
  SignaturePlacement,
} from './signatures.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CapabilityGuard, RequireCapability } from '../permissions/require-capability.decorator';

@Controller('signatures')
export class SignaturesController {
  constructor(private readonly signaturesService: SignaturesService) {}

  // ── Saved signatures (must be declared before parameterized request routes) ──

  @Get('saved')
  @UseGuards(JwtAuthGuard)
  async listSaved(@Request() req: any) {
    return this.signaturesService.listSavedSignatures(req.user.id);
  }

  @Post('saved')
  @UseGuards(JwtAuthGuard)
  async createSaved(
    @Request() req: any,
    @Body()
    body: {
      label: string;
      imageData: string;
      isDefault?: boolean;
    },
  ) {
    return this.signaturesService.createSavedSignature(req.user.id, body);
  }

  @Patch('saved/:id')
  @UseGuards(JwtAuthGuard)
  async updateSaved(
    @Request() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      label?: string;
      imageData?: string;
      isDefault?: boolean;
    },
  ) {
    return this.signaturesService.updateSavedSignature(req.user.id, id, body);
  }

  @Delete('saved/:id')
  @UseGuards(JwtAuthGuard)
  async deleteSaved(@Request() req: any, @Param('id') id: string) {
    return this.signaturesService.deleteSavedSignature(req.user.id, id);
  }

  @Post('requests')
  @RequireCapability('documents.request_signature')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async createSignatureRequest(
    @Request() req: any,
    @Body()
    body: {
      fileId: string;
      participants: SignatureParticipant[];
    },
  ) {
    return this.signaturesService.createRequest(
      body.fileId,
      body.participants,
      req.user.id,
      req.user.companyId ?? null,
    );
  }

  @Get('requests/:id')
  @UseGuards(JwtAuthGuard)
  async getSignatureRequest(@Param('id') id: string, @Request() req: any) {
    return this.signaturesService.getRequest(id, req.user.id);
  }

  @Post('requests/:requestId/participants/:participantId/sign')
  @RequireCapability('documents.sign')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async signDocument(
    @Param('requestId') requestId: string,
    @Param('participantId') participantId: string,
    @Body()
    body: {
      signatureImageData?: string;
      savedSignatureId?: string;
      placement: SignaturePlacement;
    },
    @Request() req: any,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    let imageData = body.signatureImageData;
    if (
      (!imageData || !imageData.startsWith('data:image/')) &&
      body.savedSignatureId
    ) {
      imageData = await this.signaturesService.getSavedSignatureImage(
        req.user.id,
        body.savedSignatureId,
      );
    }
    if (!imageData) {
      throw new BadRequestException(
        'Provide signatureImageData or savedSignatureId',
      );
    }

    return this.signaturesService.sign(
      requestId,
      participantId,
      imageData,
      req.user,
      body.placement,
      ip,
      userAgent,
    );
  }

  @Get('requests/file/:fileId')
  @UseGuards(JwtAuthGuard)
  async getFileSignatureRequests(
    @Param('fileId') fileId: string,
    @Request() req: any,
  ) {
    return this.signaturesService.listForFile(fileId, req.user.id);
  }
}
