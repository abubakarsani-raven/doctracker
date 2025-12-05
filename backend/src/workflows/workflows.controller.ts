import { Controller, Get, Post, Put, Param, Body, UseGuards } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('workflows')
@UseGuards(JwtAuthGuard)
export class WorkflowsController {
  constructor(private workflowsService: WorkflowsService) {}

  @Get()
  async findAll() {
    return this.workflowsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.workflowsService.findOne(id);
  }

  @Post()
  async create(@Body() createWorkflowDto: any) {
    return this.workflowsService.create(createWorkflowDto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateWorkflowDto: any) {
    return this.workflowsService.update(id, updateWorkflowDto);
  }
}
