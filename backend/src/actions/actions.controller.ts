import { Controller, Get, Post, Put, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ActionsService } from './actions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('actions')
@UseGuards(JwtAuthGuard)
export class ActionsController {
  constructor(private actionsService: ActionsService) {}

  @Get()
  async findAll(@Request() req: any) {
    return this.actionsService.findAll(req.user?.id, req.user?.companyId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.actionsService.findOne(id, req.user);
  }

  @Post()
  async create(@Body() createActionDto: any, @Request() req: any) {
    return this.actionsService.create(createActionDto, req.user);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateActionDto: any, @Request() req: any) {
    return this.actionsService.update(id, updateActionDto, req.user);
  }
}
