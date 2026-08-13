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
import { AccessRequestsService } from './access-requests.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CapabilityGuard, RequireCapability } from '../permissions/require-capability.decorator';
import {
  CreateAccessRequestDto,
  UpdateAccessRequestDto,
} from './dto/access-request.dto';

@Controller('access-requests')
export class AccessRequestsController {
  constructor(private accessRequestsService: AccessRequestsService) {}

  @Get()
  @RequireCapability('access_requests.create')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async findAll(@Request() req) {
    return this.accessRequestsService.findAll(req.user.id);
  }

  @Get(':id')
  @RequireCapability('access_requests.create')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.accessRequestsService.findOne(id, req.user);
  }

  @Post()
  @RequireCapability('access_requests.create')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async create(
    @Body() createAccessRequestDto: CreateAccessRequestDto,
    @Request() req: any,
  ) {
    return this.accessRequestsService.create(createAccessRequestDto, req.user);
  }

  @Put(':id')
  @RequireCapability('access_requests.review')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async update(
    @Param('id') id: string,
    @Body() updateAccessRequestDto: UpdateAccessRequestDto,
    @Request() req: any,
  ) {
    return this.accessRequestsService.update(id, updateAccessRequestDto, req.user);
  }

  @Delete(':id')
  @RequireCapability('access_requests.create')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async delete(@Param('id') id: string, @Request() req: any) {
    // Previously this took no user at all, so anyone signed in could withdraw
    // anyone else's request.
    return this.accessRequestsService.delete(id, req.user);
  }
}

