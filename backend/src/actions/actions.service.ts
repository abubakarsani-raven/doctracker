import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActionsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    try {
      const actions = await this.prisma.action.findMany({
        include: {
          workflow: {
            select: {
              id: true,
              title: true,
              status: true,
              companyId: true,
            },
          },
          document: {
            select: {
              id: true,
              fileName: true,
              fileType: true,
            },
          },
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      
      // Transform actions to include assignedTo object for frontend compatibility
      return actions.map(action => ({
        ...action,
        assignedTo: action.assignedToType && action.assignedToName ? {
          type: action.assignedToType,
          id: action.assignedToId || '',
          name: action.assignedToName,
        } : null,
      }));
    } catch (error: any) {
      console.error('[ActionsService] Error in findAll:', error);
      throw new Error(`Failed to fetch actions: ${error.message || 'Unknown error'}`);
    }
  }

  async findOne(id: string) {
    const action = await this.prisma.action.findUnique({
      where: { id },
      include: {
        workflow: {
          include: {
            company: true,
          },
        },
        document: true,
        creator: true,
      },
    });
    
    if (!action) return null;
    
    // Transform action to include assignedTo object for frontend compatibility
    return {
      ...action,
      assignedTo: action.assignedToType && action.assignedToName ? {
        type: action.assignedToType,
        id: action.assignedToId || '',
        name: action.assignedToName,
      } : null,
    };
  }

  async create(data: any, currentUser: any) {
    // Get workflow to determine companyId
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: data.workflowId },
      select: { companyId: true },
    });

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // Transform frontend data to match Prisma schema
    const actionData: any = {
      title: data.title,
      description: data.description || null,
      type: data.type || 'regular',
      status: data.status || 'pending',
      workflowId: data.workflowId,
      companyId: workflow.companyId,
      
      // Handle assignedTo transformation
      assignedToType: data.assignedTo?.type || data.assignedToType || null,
      assignedToId: data.assignedTo?.id || data.assignedToId || null,
      assignedToName: data.assignedTo?.name || data.assignedToName || null,
      
      // Handle folder/document relationships
      folderId: data.folderId || null,
      documentId: data.documentId || null,
      
      // Document upload specific fields
      targetFolderId: data.targetFolderId || null,
      requiredFileType: data.requiredFileType || null,
      
      // Request/Response specific fields
      requestDetails: data.requestDetails || null,
      
      // Cross-company fields
      sourceCompanyId: data.sourceCompanyId || null,
      sourceCompanyName: data.sourceCompanyName || null,
      targetCompanyId: data.targetCompanyId || null,
      targetCompanyName: data.targetCompanyName || null,
      isCrossCompany: data.isCrossCompany || false,
      
      // Set creator
      createdBy: currentUser.id,
      
      // Due date
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
    };

    // Validate required fields
    if (!actionData.assignedToType || !actionData.assignedToId || !actionData.assignedToName) {
      throw new Error('assignedTo (type, id, name) is required');
    }

    const createdAction = await this.prisma.action.create({
      data: actionData,
      include: {
        workflow: true,
      },
    });

    // Update workflow progress after creating action
    await this.updateWorkflowProgress(data.workflowId);

    // Create notification for assigned user
    try {
      if (actionData.assignedToType === 'user' && actionData.assignedToId) {
        await this.prisma.notification.create({
          data: {
            userId: actionData.assignedToId,
            companyId: workflow.companyId,
            type: 'action_assigned',
            title: `New Action: ${createdAction.title}`,
            message: `You have been assigned a new action: "${createdAction.title}"`,
            resourceType: 'action',
            resourceId: createdAction.id,
            read: false,
          },
        });
      } else if (actionData.assignedToType === 'department' && actionData.assignedToName) {
        // Get all users in the department
        const departmentUsers = await this.prisma.userDepartment.findMany({
          where: {
            department: {
              name: actionData.assignedToName,
            },
          },
          include: {
            user: {
              select: { id: true },
            },
          },
        });

        // Create notifications for all department users
        if (departmentUsers.length > 0) {
          const notifications = departmentUsers.map((ud: any) => ({
            userId: ud.user.id,
            companyId: workflow.companyId,
            type: 'action_assigned',
            title: `New Action: ${createdAction.title}`,
            message: `A new action has been assigned to your department: "${createdAction.title}"`,
            resourceType: 'action',
            resourceId: createdAction.id,
            read: false,
          }));

          await this.prisma.notification.createMany({
            data: notifications,
          });
        }
      }
    } catch (error) {
      console.error('[ActionsService] Failed to create notification:', error);
      // Don't throw - notification failure shouldn't break action creation
    }

    return createdAction;
  }

  async update(id: string, data: any) {
    // Get the action to find workflowId
    const existingAction = await this.prisma.action.findUnique({
      where: { id },
      select: { workflowId: true },
    });

    if (!existingAction) {
      throw new Error('Action not found');
    }

    // Transform update data to match Prisma schema
    const updateData: any = {};
    
    // Handle basic fields
    if (data.status !== undefined) updateData.status = data.status;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.completedAt !== undefined) {
      updateData.completedAt = data.completedAt ? new Date(data.completedAt) : null;
    }
    if (data.completedBy !== undefined) updateData.completedBy = data.completedBy;
    if (data.resolutionNotes !== undefined) updateData.resolutionNotes = data.resolutionNotes;
    if (data.uploadedDocumentId !== undefined) updateData.uploadedDocumentId = data.uploadedDocumentId;
    if (data.uploadedDocumentName !== undefined) updateData.uploadedDocumentName = data.uploadedDocumentName;
    if (data.uploadedAt !== undefined) {
      updateData.uploadedAt = data.uploadedAt ? new Date(data.uploadedAt) : null;
    }
    if (data.uploadedBy !== undefined) updateData.uploadedBy = data.uploadedBy;
    if (data.response !== undefined) updateData.response = data.response;
    if (data.responseData !== undefined) updateData.responseData = data.responseData;
    if (data.responseReceivedAt !== undefined) {
      updateData.responseReceivedAt = data.responseReceivedAt ? new Date(data.responseReceivedAt) : null;
    }
    if (data.respondedBy !== undefined) updateData.respondedBy = data.respondedBy;
    
    // Transform assignedTo if provided
    if (data.assignedTo !== undefined) {
      if (data.assignedTo === null) {
        updateData.assignedToType = null;
        updateData.assignedToId = null;
        updateData.assignedToName = null;
      } else if (typeof data.assignedTo === 'object') {
        updateData.assignedToType = data.assignedTo.type || null;
        updateData.assignedToId = data.assignedTo.id || null;
        updateData.assignedToName = data.assignedTo.name || null;
      }
    }

    // Update the action
    const updatedAction = await this.prisma.action.update({
      where: { id },
      data: updateData,
      include: {
        workflow: true,
      },
    });

    // Automatically update workflow progress/status when action status changes
    if (data.status !== undefined) {
      await this.updateWorkflowProgress(existingAction.workflowId);
    }

    // Transform action to include assignedTo object for frontend compatibility
    return {
      ...updatedAction,
      assignedTo: updatedAction.assignedToType && updatedAction.assignedToName ? {
        type: updatedAction.assignedToType,
        id: updatedAction.assignedToId || '',
        name: updatedAction.assignedToName,
      } : null,
    };
  }

  /**
   * Update workflow progress and status based on actions
   */
  private async updateWorkflowProgress(workflowId: string) {
    try {
      // Get all actions for this workflow
      const actions = await this.prisma.action.findMany({
        where: { workflowId },
      });

      if (actions.length === 0) {
        return; // No actions, no progress to calculate
      }

      // Calculate progress - count actions that have made progress
      const completedActions = actions.filter((action) => {
        const status = action.status;
        return (
          status === "completed" ||
          status === "document_uploaded" ||
          status === "response_received"
        );
      });

      const progress = Math.round((completedActions.length / actions.length) * 100);

      // Get current workflow
      const workflow = await this.prisma.workflow.findUnique({
        where: { id: workflowId },
      });

      if (!workflow) {
        return;
      }

      // Determine new status
      const allCompleted = actions.every((action) => action.status === "completed");
      let newStatus = workflow.status;

      // If all actions are completed and progress is 100%, ready for review
      if (allCompleted && progress === 100 && actions.length > 0) {
        // Only transition to ready_for_review if not already completed
        if (workflow.status !== "completed") {
          newStatus = "ready_for_review";
        }
      } 
      // If there's progress and workflow is still assigned, move to in_progress
      else if (progress > 0 && workflow.status === "assigned") {
        newStatus = "in_progress";
      }

      // Update workflow if status or progress changed
      if (newStatus !== workflow.status || progress !== workflow.progress) {
        await this.prisma.workflow.update({
          where: { id: workflowId },
          data: {
            progress,
            status: newStatus,
          },
        });
      }
    } catch (error) {
      console.error(`Failed to update workflow progress for workflow ${workflowId}:`, error);
      // Don't throw - workflow update failure shouldn't break action update
    }
  }
}
