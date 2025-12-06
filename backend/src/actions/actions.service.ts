import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WebSocketGateway } from '../websocket/websocket.gateway';
import { ActivityService } from '../activity/activity.service';

@Injectable()
export class ActionsService {
  constructor(
    private prisma: PrismaService,
    private wsGateway: WebSocketGateway,
    private activityService: ActivityService,
  ) {}

  async findAll(userId?: string, companyId?: string) {
    try {
      const where: any = {};
      
      // Filter by company if provided
      if (companyId) {
        where.workflow = {
          companyId: companyId,
        };
      }
      
      // If userId provided, filter to actions visible to user
      if (userId) {
        try {
          const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
              id: true,
              companyId: true,
              userRoles: {
                include: {
                  role: true,
                },
              },
            },
          });
          
          if (user) {
            const userRole = user.userRoles?.[0]?.role?.name || 'Staff';
            if (userRole !== 'Master') {
              // Non-Master users see actions from their company only
              if (user.companyId) {
                where.workflow = {
                  ...where.workflow,
                  companyId: user.companyId,
                };
              }
            }
          }
        } catch (error) {
          console.error('[ActionsService] Error fetching user:', error);
          // Continue without filtering if user lookup fails
        }
      }
      
      const actions = await this.prisma.action.findMany({
        where,
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

  async findOne(id: string, currentUser?: any) {
    const action = await this.prisma.action.findUnique({
      where: { id },
      include: {
        workflow: {
          select: {
            id: true,
            title: true,
            status: true,
            companyId: true,
          },
        },
        document: true,
        creator: true,
      },
    });
    
    if (!action) {
      return null;
    }
    
    // Check access control - user must be from same company (unless Master)
    if (currentUser) {
      if (currentUser.role !== 'Master' && action.workflow?.companyId !== currentUser.companyId) {
        throw new Error('Access denied: Action belongs to a different company');
      }
    }
    
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

    // Emit WebSocket event
    this.wsGateway.emitActionUpdate(createdAction.id, createdAction);

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

  async update(id: string, data: any, currentUser?: any) {
    // Get the action to find workflowId and check access
    const existingAction = await this.prisma.action.findUnique({
      where: { id },
      include: {
        workflow: {
          select: {
            companyId: true,
            assignedBy: true,
            assignedToType: true,
            assignedToId: true,
            routingHistory: {
              select: {
                fromType: true,
                fromId: true,
                toType: true,
                toId: true,
              },
            },
          },
        },
      },
    });

    if (!existingAction) {
      throw new Error('Action not found');
    }
    
    // Check access control
    if (currentUser) {
      if (currentUser.role !== 'Master' && existingAction.workflow?.companyId !== currentUser.companyId) {
        throw new Error('Access denied: Cannot update action from different company');
      }

      // If trying to complete the action, check if user is authorized
      if (data.status === 'completed') {
        const isAuthorized = await this.canCompleteAction(existingAction, currentUser);
        if (!isAuthorized) {
          throw new Error('Access denied: Only workflow members or the assigned user can complete this action');
        }
      }
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

    // Log activity for action status changes
    try {
      if (data.status === 'completed') {
        await this.activityService.createActivity({
          userId: updatedAction.completedBy || updatedAction.createdBy,
          companyId: updatedAction.workflow?.companyId,
          activityType: 'action_completed',
          resourceType: 'action',
          resourceId: id,
          description: `Action "${updatedAction.title}" was completed`,
        });
      } else if (data.status !== undefined) {
        await this.activityService.createActivity({
          userId: updatedAction.createdBy,
          companyId: updatedAction.workflow?.companyId,
          activityType: 'action_updated',
          resourceType: 'action',
          resourceId: id,
          description: `Action "${updatedAction.title}" was updated`,
        });
      }
    } catch (error) {
      console.error('Failed to log activity:', error);
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
   * Check if user can complete an action
   * User can complete if:
   * 1. They are assigned to the action
   * 2. They are a workflow participant (creator, current assignee, or in routing history)
   */
  private async canCompleteAction(action: any, user: any): Promise<boolean> {
    if (!user || !action) return false;

    // Check if user is assigned to the action
    if (action.assignedToType === 'user' && action.assignedToId === user.id) {
      return true;
    }

    // Check if user is in the assigned department
    if (action.assignedToType === 'department' && action.assignedToId) {
      // Fetch user with departments if not already loaded
      let userWithDepts = user;
      if (!user.userDepartments) {
        userWithDepts = await this.prisma.user.findUnique({
          where: { id: user.id },
          include: {
            userDepartments: {
              include: {
                department: true,
              },
            },
          },
        });
      }

      if (userWithDepts?.userDepartments && Array.isArray(userWithDepts.userDepartments)) {
        const userDeptIds = userWithDepts.userDepartments.map((ud: any) => ud.departmentId || ud.department?.id);
        if (userDeptIds.includes(action.assignedToId)) {
          return true;
        }
      }
    }

    // Check if user is a workflow participant
    if (action.workflow) {
      const workflow = action.workflow;
      
      // Check if user is workflow creator
      if (workflow.assignedBy === user.id) {
        return true;
      }

      // Check if user is current workflow assignee
      if (workflow.assignedToType === 'user' && workflow.assignedToId === user.id) {
        return true;
      }

      // Check if user is in routing history
      if (workflow.routingHistory && Array.isArray(workflow.routingHistory)) {
        // Fetch user with departments if not already loaded
        let userWithDepts = user;
        if (!user.userDepartments) {
          userWithDepts = await this.prisma.user.findUnique({
            where: { id: user.id },
            include: {
              userDepartments: {
                include: {
                  department: true,
                },
              },
            },
          });
        }

        const userDeptIds = userWithDepts?.userDepartments 
          ? userWithDepts.userDepartments.map((ud: any) => ud.departmentId || ud.department?.id)
          : [];

        for (const route of workflow.routingHistory) {
          if (route.fromType === 'user' && route.fromId === user.id) {
            return true;
          }
          if (route.toType === 'user' && route.toId === user.id) {
            return true;
          }
          // Check department assignments in routing
          if (route.fromType === 'department' && route.fromId && userDeptIds.includes(route.fromId)) {
            return true;
          }
          if (route.toType === 'department' && route.toId && userDeptIds.includes(route.toId)) {
            return true;
          }
        }
      }
    }

    return false;
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
