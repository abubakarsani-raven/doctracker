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

@Controller('approval-requests')
@UseGuards(JwtAuthGuard)
export class ApprovalRequestsController {
  constructor(private approvalRequestsService: ApprovalRequestsService) {}

  @Get()
  async findAll(@Request() req) {
    return this.approvalRequestsService.findAll(req.user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.approvalRequestsService.findOne(id);
  }

  @Post()
  async create(@Body() createApprovalRequestDto: any, @Request() req: any) {
    return this.approvalRequestsService.create(createApprovalRequestDto, req.user);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateApprovalRequestDto: any,
    @Request() req: any,
  ) {
    return this.approvalRequestsService.update(id, updateApprovalRequestDto, req.user);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.approvalRequestsService.delete(id);
  }
}

