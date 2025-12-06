import { Controller, Get, Post, Put, Param, Body, UseGuards, Request, HttpException, HttpStatus } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('workflows')
@UseGuards(JwtAuthGuard)
export class WorkflowsController {
  constructor(private workflowsService: WorkflowsService) {}

  @Get()
  async findAll(@Request() req: any) {
    return this.workflowsService.findAll(req.user?.id, req.user?.companyId);
  }

  @Get('folder/:folderId')
  async findByFolder(@Param('folderId') folderId: string) {
    try {
      return await this.workflowsService.findByFolderId(folderId);
    } catch (error: any) {
      console.error('[WorkflowsController] Error getting workflows by folder:', error);
      throw new HttpException(
        { message: error.message || 'Failed to get workflows' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('document/:documentId')
  async findByDocument(@Param('documentId') documentId: string) {
    try {
      return await this.workflowsService.findByDocumentId(documentId);
    } catch (error: any) {
      console.error('[WorkflowsController] Error getting workflows by document:', error);
      throw new HttpException(
        { message: error.message || 'Failed to get workflows' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Goals endpoints - specific routes must come before parameterized routes
  @Get('goals/my-goals')
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
  async createGoal(
    @Param('id') id: string,
    @Body() createGoalDto: any,
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
  async updateGoal(
    @Param('goalId') goalId: string,
    @Body() updateGoalDto: any,
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
  async achieveGoal(
    @Param('goalId') goalId: string,
    @Body() body: { notes?: string },
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

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.workflowsService.findOne(id, req.user);
  }

  @Post()
  async create(@Body() createWorkflowDto: any, @Request() req: any) {
    return this.workflowsService.create(createWorkflowDto, req.user);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateWorkflowDto: any, @Request() req: any) {
    return this.workflowsService.update(id, updateWorkflowDto, req.user);
  }
}
