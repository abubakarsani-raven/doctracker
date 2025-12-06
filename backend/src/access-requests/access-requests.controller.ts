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

@Controller('access-requests')
@UseGuards(JwtAuthGuard)
export class AccessRequestsController {
  constructor(private accessRequestsService: AccessRequestsService) {}

  @Get()
  async findAll(@Request() req) {
    return this.accessRequestsService.findAll(req.user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.accessRequestsService.findOne(id);
  }

  @Post()
  async create(@Body() createAccessRequestDto: any, @Request() req: any) {
    return this.accessRequestsService.create(createAccessRequestDto, req.user);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateAccessRequestDto: any,
    @Request() req: any,
  ) {
    return this.accessRequestsService.update(id, updateAccessRequestDto, req.user);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.accessRequestsService.delete(id);
  }
}

