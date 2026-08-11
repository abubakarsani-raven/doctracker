import { Controller, Get, Post, Put, Param, Body, UseGuards, Request, HttpException, HttpStatus } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CapabilityGuard, RequireCapability } from '../permissions/require-capability.decorator';
import {
  CreateWorkflowDto,
  UpdateWorkflowDto,
  AttachWorkflowFileDto,
  SetWorkflowEndPointDto,
} from './dto/workflow.dto';
import {
  CreateWorkflowGoalDto,
  UpdateWorkflowGoalDto,
  AchieveWorkflowGoalDto,
} from './dto/workflow-goal.dto';

@Controller('workflows')
export class WorkflowsController {
  constructor(private workflowsService: WorkflowsService) {}

  @Get()
  @RequireCapability('workflows.view')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async findAll(@Request() req: any) {
    try {
      return await this.workflowsService.findAll(req.user?.id, req.user?.companyId);
    } catch (error: any) {
      console.error('[WorkflowsController] Error getting workflows:', error);
      throw error;
    }
  }

  @Get('folder/:folderId')
  @RequireCapability('workflows.view')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async findByFolder(@Param('folderId') folderId: string, @Request() req: any) {
    return this.workflowsService.findByFolderId(folderId, req.user);
  }

  @Get('document/:documentId')
  @RequireCapability('workflows.view')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async findByDocument(@Param('documentId') documentId: string, @Request() req: any) {
    return this.workflowsService.findByDocumentId(documentId, req.user);
  }

  // Goals endpoints - specific routes must come before parameterized routes
  @Get('goals/my-goals')
  @RequireCapability('workflows.view')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async getMyGoals(@Request() req: any) {
    try {
      return await this.workflowsService.getUserGoals(req.user.id);
    } catch (error: any) {
      console.error('[WorkflowsController] Error getting user goals:', error);
      throw new HttpException(
        { message: error.message || 'Failed to get user goals' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id/goals')
  @RequireCapability('workflows.view')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async getGoals(@Param('id') id: string, @Request() req: any) {
    try {
      return await this.workflowsService.getGoals(id, req.user);
    } catch (error: any) {
      console.error('[WorkflowsController] Error getting goals:', error);
      throw new HttpException(
        { message: error.message || 'Failed to get goals' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/goals')
  @RequireCapability('workflows.create')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async createGoal(
    @Param('id') id: string,
    @Body() createGoalDto: CreateWorkflowGoalDto,
    @Request() req: any,
  ) {
    try {
      return await this.workflowsService.createGoal(id, createGoalDto, req.user);
    } catch (error: any) {
      console.error('[WorkflowsController] Error creating goal:', error);
      const message = error.message || 'Failed to create goal';
      const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
      throw new HttpException({ message }, status);
    }
  }

  @Put('goals/:goalId')
  @RequireCapability('workflows.edit')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async updateGoal(
    @Param('goalId') goalId: string,
    @Body() updateGoalDto: UpdateWorkflowGoalDto,
    @Request() req: any,
  ) {
    try {
      return await this.workflowsService.updateGoal(goalId, updateGoalDto, req.user);
    } catch (error: any) {
      console.error('[WorkflowsController] Error updating goal:', error);
      throw new HttpException(
        { message: error.message || 'Failed to update goal' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('goals/:goalId/achieve')
  @RequireCapability('workflows.edit')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async achieveGoal(
    @Param('goalId') goalId: string,
    @Body() body: AchieveWorkflowGoalDto,
    @Request() req: any,
  ) {
    try {
      return await this.workflowsService.achieveGoal(goalId, req.user, body.notes);
    } catch (error: any) {
      console.error('[WorkflowsController] Error achieving goal:', error);
      throw new HttpException(
        { message: error.message || 'Failed to achieve goal' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('goals/:goalId/delete')
  @RequireCapability('workflows.delete')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async deleteGoal(@Param('goalId') goalId: string, @Request() req: any) {
    try {
      return await this.workflowsService.deleteGoal(goalId, req.user);
    } catch (error: any) {
      console.error('[WorkflowsController] Error deleting goal:', error);
      throw new HttpException(
        { message: error.message || 'Failed to delete goal' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id/files')
  @RequireCapability('workflows.view')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async listFiles(@Param('id') id: string, @Request() req: any) {
    return this.workflowsService.listFiles(id, req.user);
  }

  @Post(':id/files')
  @RequireCapability('actions.complete')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async attachFile(
    @Param('id') id: string,
    @Body() body: AttachWorkflowFileDto,
    @Request() req: any,
  ) {
    return this.workflowsService.attachFile(id, body, req.user);
  }

  @Get(':id')
  @RequireCapability('workflows.view')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.workflowsService.findOne(id, req.user);
  }

  @Post()
  @RequireCapability('workflows.create')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async create(@Body() createWorkflowDto: CreateWorkflowDto, @Request() req: any) {
    return this.workflowsService.create(createWorkflowDto, req.user);
  }

  @Put(':id/end-point')
  @RequireCapability('workflows.view')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async setEndPoint(
    @Param('id') id: string,
    @Body() body: SetWorkflowEndPointDto,
    @Request() req: any,
  ) {
    return this.workflowsService.setEndPoint(id, body.dueDate ?? null, req.user);
  }

  @Put(':id')
  @RequireCapability('workflows.edit')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async update(@Param('id') id: string, @Body() updateWorkflowDto: UpdateWorkflowDto, @Request() req: any) {
    return this.workflowsService.update(id, updateWorkflowDto, req.user);
  }
}
