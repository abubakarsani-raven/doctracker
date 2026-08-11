import { Controller, Get, Post, Put, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ActionsService } from './actions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CapabilityGuard, RequireCapability } from '../permissions/require-capability.decorator';
import { CreateActionDto, UpdateActionDto } from './dto/action.dto';

@Controller('actions')
export class ActionsController {
  constructor(private actionsService: ActionsService) {}

  @Get()
  @RequireCapability('workflows.view')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async findAll(@Request() req: any) {
    return this.actionsService.findAll(req.user?.id, req.user?.companyId);
  }

  @Get(':id')
  @RequireCapability('workflows.view')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.actionsService.findOne(id, req.user);
  }

  @Post()
  @RequireCapability('actions.assign')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async create(@Body() createActionDto: CreateActionDto, @Request() req: any) {
    return this.actionsService.create(createActionDto, req.user);
  }

  @Put(':id')
  @RequireCapability('actions.complete')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async update(@Param('id') id: string, @Body() updateActionDto: UpdateActionDto, @Request() req: any) {
    return this.actionsService.update(id, updateActionDto, req.user);
  }
}
