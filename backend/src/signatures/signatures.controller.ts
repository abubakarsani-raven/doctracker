import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  Ip,
  Headers,
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
      signatureImageData: string;
      placement: SignaturePlacement;
    },
    @Request() req: any,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.signaturesService.sign(
      requestId,
      participantId,
      body.signatureImageData,
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
