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
import { ApprovalRequestsService } from './approval-requests.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CapabilityGuard, RequireCapability } from '../permissions/require-capability.decorator';
import {
  CreateApprovalRequestDto,
  UpdateApprovalRequestDto,
} from './dto/approval-request.dto';

@Controller('approval-requests')
export class ApprovalRequestsController {
  constructor(private approvalRequestsService: ApprovalRequestsService) {}

  @Get()
  @RequireCapability('approvals.review')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async findAll(@Request() req) {
    return this.approvalRequestsService.findAll(req.user.id, req.user);
  }

  @Get(':id')
  @RequireCapability('approvals.review')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.approvalRequestsService.findOne(id, req.user);
  }

  @Post()
  @RequireCapability('approvals.review')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async create(
    @Body() createApprovalRequestDto: CreateApprovalRequestDto,
    @Request() req: any,
  ) {
    return this.approvalRequestsService.create(createApprovalRequestDto, req.user);
  }

  @Put(':id')
  @RequireCapability('approvals.review')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async update(
    @Param('id') id: string,
    @Body() updateApprovalRequestDto: UpdateApprovalRequestDto,
    @Request() req: any,
  ) {
    return this.approvalRequestsService.update(id, updateApprovalRequestDto, req.user);
  }

  @Delete(':id')
  @RequireCapability('approvals.review')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async delete(@Param('id') id: string, @Request() req: any) {
    return this.approvalRequestsService.delete(id, req.user);
  }
}

