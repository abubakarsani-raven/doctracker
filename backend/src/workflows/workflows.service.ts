import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WebSocketGateway } from '../websocket/websocket.gateway';
import { ActivityService } from '../activity/activity.service';

@Injectable()
export class WorkflowsService {
  constructor(
    private prisma: PrismaService,
    private wsGateway: WebSocketGateway,
    private activityService: ActivityService,
  ) {}

  /**
   * Transform workflow data to include assignedTo object and resolve names
   */
  private async transformWorkflow(workflow: any): Promise<any> {
    if (!workflow) return workflow;

    // Build assignedTo object from flat fields
    let assignedTo: any = null;
    if (workflow.assignedToType && workflow.assignedToId) {
      let assignedToName = workflow.assignedToName;

      // If assignedToName is missing or equals the ID (meaning it's an ID, not a name), look it up
      if (!assignedToName || assignedToName === workflow.assignedToId) {
        if (workflow.assignedToType === 'user') {
          const user = await this.prisma.user.findUnique({
            where: { id: workflow.assignedToId },
            select: { name: true, email: true },
          });
          assignedToName = user?.name || user?.email || workflow.assignedToId;
        } else if (workflow.assignedToType === 'department') {
          const dept = await this.prisma.department.findUnique({
            where: { id: workflow.assignedToId },
            select: { name: true },
          });
          assignedToName = dept?.name || workflow.assignedToId;
        }
      }

      assignedTo = {
        type: workflow.assignedToType,
        id: workflow.assignedToId,
        name: assignedToName || workflow.assignedToId,
      };
    }

    // Transform routing history to include proper names
    const transformedRoutingHistory = workflow.routingHistory
      ? await Promise.all(
          workflow.routingHistory.map(async (route: any) => {
            let fromName = route.fromName;
            let toName = route.toName;

            // Resolve from name if missing or equals ID
            if (route.fromType && route.fromId) {
              if (!fromName || fromName === route.fromId) {
                if (route.fromType === 'user') {
                  const user = await this.prisma.user.findUnique({
                    where: { id: route.fromId },
                    select: { name: true, email: true },
                  });
                  fromName = user?.name || user?.email || route.fromId;
                } else if (route.fromType === 'department') {
                  const dept = await this.prisma.department.findUnique({
                    where: { id: route.fromId },
                    select: { name: true },
                  });
                  fromName = dept?.name || route.fromId;
                }
              }
            }

            // Resolve to name if missing or equals ID
            if (route.toType && route.toId) {
              if (!toName || toName === route.toId) {
                if (route.toType === 'user') {
                  const user = await this.prisma.user.findUnique({
                    where: { id: route.toId },
                    select: { name: true, email: true },
                  });
                  toName = user?.name || user?.email || route.toId;
                } else if (route.toType === 'department') {
                  const dept = await this.prisma.department.findUnique({
                    where: { id: route.toId },
                    select: { name: true },
                  });
                  toName = dept?.name || route.toId;
                }
              }
            }

            return {
              ...route,
              from: route.fromType && route.fromId
                ? {
                    type: route.fromType,
                    id: route.fromId,
                    name: fromName || route.fromId,
                  }
                : null,
              to: route.toType && route.toId
                ? {
                    type: route.toType,
                    id: route.toId,
                    name: toName || route.toId,
                  }
                : null,
            };
          })
        )
      : [];

    return {
      ...workflow,
      assignedTo,
      routingHistory: transformedRoutingHistory,
    };
  }

  /**
   * Transform array of workflows
   */
  private async transformWorkflows(workflows: any[]): Promise<any[]> {
    return Promise.all(workflows.map((w) => this.transformWorkflow(w)));
  }

  async findAll(userId?: string, companyId?: string) {
    try {
      const where: any = {};
      
      // Filter by company if provided
      if (companyId) {
        where.companyId = companyId;
      }
      
      // If userId provided, filter to workflows visible to user
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
              // Non-Master users see workflows from their company only
              if (user.companyId) {
                where.companyId = user.companyId;
              }
            }
          }
        } catch (error) {
          console.error('[WorkflowsService] Error fetching user:', error);
          // Continue without filtering if user lookup fails
        }
      }
      
      const workflows = await this.prisma.workflow.findMany({
        where,
        include: {
          company: {
            select: {
              id: true,
              name: true,
            },
          },
          document: {
            select: {
              id: true,
              fileName: true,
              fileType: true,
            },
          },
          actions: {
            select: {
              id: true,
              title: true,
              status: true,
              type: true,
            },
          },
          routingHistory: true,
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
      return this.transformWorkflows(workflows);
    } catch (error: any) {
      console.error('[WorkflowsService] Error in findAll:', error);
      throw new Error(`Failed to fetch workflows: ${error.message || 'Unknown error'}`);
    }
  }

  async findByFolderId(folderId: string) {
    const workflows = await this.prisma.workflow.findMany({
      where: { folderId },
      include: {
        company: true,
        document: true,
        creator: true,
        routingHistory: {
          orderBy: {
            routedAt: 'asc',
          },
        },
        actions: {
          select: {
            id: true,
            status: true,
            title: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return this.transformWorkflows(workflows);
  }

  async findByDocumentId(documentId: string) {
    const workflows = await this.prisma.workflow.findMany({
      where: { documentId },
      include: {
        company: true,
        document: true,
        creator: true,
        routingHistory: {
          orderBy: {
            routedAt: 'asc',
          },
        },
        actions: {
          select: {
            id: true,
            status: true,
            title: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return this.transformWorkflows(workflows);
  }

  async findOne(id: string, currentUser?: any) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
      include: {
        company: true,
        document: true,
        actions: true,
        routingHistory: {
          orderBy: {
            routedAt: 'asc',
          },
        },
        creator: true,
        goals: {
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            creator: true,
          },
        },
      },
    });
    
    if (!workflow) {
      return null;
    }
    
    // Check access control - user must be from same company (unless Master)
    if (currentUser) {
      if (currentUser.role !== 'Master' && workflow.companyId !== currentUser.companyId) {
        throw new Error('Access denied: Workflow belongs to a different company');
      }
    }
    
    return this.transformWorkflow(workflow);
  }

  async create(data: any, currentUser: any) {
    // Handle assignedTo transformation - resolve name if not provided
    let assignedToType = data.assignedTo?.type || null;
    let assignedToId = data.assignedTo?.id || null;
    let assignedToName = data.assignedTo?.name || null;
    
    // Resolve name from database if not provided or if name equals ID
    if (assignedToType && assignedToId && (!assignedToName || assignedToName === assignedToId)) {
      if (assignedToType === 'user') {
        const user = await this.prisma.user.findUnique({
          where: { id: assignedToId },
          select: { name: true, email: true },
        });
        assignedToName = user?.name || user?.email || assignedToId;
      } else if (assignedToType === 'department') {
        const dept = await this.prisma.department.findUnique({
          where: { id: assignedToId },
          select: { name: true },
        });
        assignedToName = dept?.name || assignedToId;
      }
    }

    // Transform frontend data to match Prisma schema
    const workflowData: any = {
      title: data.title,
      description: data.description || null,
      type: data.type,
      status: data.status || 'assigned',
      progress: data.progress || 0,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      
      // Set creator (assignedBy connects to creator relation)
      assignedBy: currentUser.id,
      
      // Handle assignedTo with resolved name
      assignedToType,
      assignedToId,
      assignedToName,
      
      // Cross-company fields
      sourceCompanyId: data.sourceCompanyId || null,
      sourceCompanyName: data.sourceCompanyName || null,
      targetCompanyId: data.targetCompanyId || null,
      targetCompanyName: data.targetCompanyName || null,
      isCrossCompany: data.isCrossCompany || false,
      approvalStatus: data.approvalStatus || null,
      approvalRequestedAt: data.approvalStatus === 'pending' ? new Date() : null,
      
      // Handle folder/document relationships
      folderId: data.folderId || null,
      documentId: data.documentId || null,
    };

    // Determine companyId - prioritize from data, then sourceCompanyId, then user, then from folder/document
    let companyId = data.companyId || data.sourceCompanyId;
    
    if (!companyId && currentUser?.companyId) {
      companyId = currentUser.companyId;
    }
    
    // If still no companyId, try to get it from folder or document
    if (!companyId) {
      if (data.folderId) {
        const folder = await this.prisma.folder.findUnique({
          where: { id: data.folderId },
          select: { companyId: true },
        });
        if (folder) {
          companyId = folder.companyId;
        }
      } else if (data.documentId) {
        const document = await this.prisma.file.findUnique({
          where: { id: data.documentId },
          select: { companyId: true },
        });
        if (document) {
          companyId = document.companyId;
        }
      }
    }
    
    // If still no companyId, use user's company as fallback
    if (!companyId && currentUser?.companyId) {
      companyId = currentUser.companyId;
    }
    
    // companyId is required - throw error if still missing
    if (!companyId) {
      throw new Error('Company ID is required for workflow creation');
    }
    
    workflowData.companyId = companyId;
    
    // Ensure sourceCompanyId matches companyId if not explicitly set
    if (!workflowData.sourceCompanyId) {
      workflowData.sourceCompanyId = companyId;
    }

    const workflow = await this.prisma.workflow.create({
      data: workflowData,
      include: {
        company: true,
        document: true,
        creator: true,
        routingHistory: true,
      },
    });
    const transformed = this.transformWorkflow(workflow);
    
    // Emit WebSocket event
    this.wsGateway.emitWorkflowUpdate(workflow.id, transformed);
    
    // Log activity
    try {
      await this.activityService.createActivity({
        userId: currentUser.id,
        companyId: workflow.companyId,
        activityType: 'workflow_created',
        resourceType: 'workflow',
        resourceId: workflow.id,
        description: `Workflow "${workflow.title}" was created`,
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
    
    return transformed;
  }

  async update(id: string, data: any, currentUser?: any) {
    // Transform frontend data to match Prisma schema
    const updateData: any = {};

    // Handle basic fields
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.progress !== undefined) updateData.progress = data.progress;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.folderId !== undefined) updateData.folderId = data.folderId;
    if (data.documentId !== undefined) updateData.documentId = data.documentId;

    // Transform assignedTo object to separate fields and resolve name
    if (data.assignedTo !== undefined) {
      if (data.assignedTo === null) {
        updateData.assignedToType = null;
        updateData.assignedToId = null;
        updateData.assignedToName = null;
      } else if (typeof data.assignedTo === 'object') {
        let assignedToType = data.assignedTo.type || null;
        let assignedToId = data.assignedTo.id || data.assignedTo.name || null;
        let assignedToName = data.assignedTo.name || null;
        
        // Resolve name from database if not provided or if name equals ID
        if (assignedToType && assignedToId && (!assignedToName || assignedToName === assignedToId)) {
          if (assignedToType === 'user') {
            const user = await this.prisma.user.findUnique({
              where: { id: assignedToId },
              select: { name: true, email: true },
            });
            assignedToName = user?.name || user?.email || assignedToId;
          } else if (assignedToType === 'department') {
            const dept = await this.prisma.department.findUnique({
              where: { id: assignedToId },
              select: { name: true },
            });
            assignedToName = dept?.name || assignedToId;
          }
        }
        
        updateData.assignedToType = assignedToType;
        updateData.assignedToId = assignedToId;
        updateData.assignedToName = assignedToName;
      }
    }

    // Handle cross-company fields
    if (data.sourceCompanyId !== undefined) updateData.sourceCompanyId = data.sourceCompanyId;
    if (data.sourceCompanyName !== undefined) updateData.sourceCompanyName = data.sourceCompanyName;
    if (data.targetCompanyId !== undefined) updateData.targetCompanyId = data.targetCompanyId;
    if (data.targetCompanyName !== undefined) updateData.targetCompanyName = data.targetCompanyName;
    if (data.isCrossCompany !== undefined) updateData.isCrossCompany = data.isCrossCompany;
    if (data.approvalStatus !== undefined) updateData.approvalStatus = data.approvalStatus;
    if (data.approvalRequestedAt !== undefined) {
      updateData.approvalRequestedAt = data.approvalRequestedAt ? new Date(data.approvalRequestedAt) : null;
    }
    if (data.approvedBy !== undefined) updateData.approvedBy = data.approvedBy;
    if (data.approvedAt !== undefined) {
      updateData.approvedAt = data.approvedAt ? new Date(data.approvedAt) : null;
    }
    
    // Handle workflow completion
    if (data.status === 'completed' && !data.completedAt) {
      // Automatically set completedAt when status is set to completed
      updateData.completedAt = new Date();
    } else if (data.completedAt !== undefined) {
      updateData.completedAt = data.completedAt ? new Date(data.completedAt) : null;
    }

    // Handle filing workflow
    if (data.filedAt !== undefined) {
      // Add filedAt to update (will work after migration)
      (updateData as any).filedAt = data.filedAt ? new Date(data.filedAt) : null;
      
      // When filing, create notifications for participants about goals
      if (data.filedAt) {
        await this.notifyParticipantsAboutGoals(id);
      }
    }

    // Handle routingHistory - create new routing entries if provided
    if (data.routingHistory && Array.isArray(data.routingHistory)) {
      // Get existing routing history to determine which entries are new
      const existingWorkflow = await this.prisma.workflow.findUnique({
        where: { id },
        include: {
          routingHistory: {
            orderBy: { routedAt: 'asc' },
          },
        },
      });

      const existingCount = existingWorkflow?.routingHistory?.length || 0;
      const newEntries = data.routingHistory.slice(existingCount);

      if (newEntries.length > 0) {
        // Look up names from IDs if not provided
        const routingEntries = await Promise.all(
          newEntries.map(async (entry: any) => {
            let fromName = entry.from?.name || entry.fromName;
            let toName = entry.to?.name || entry.toName;
            const fromType = entry.from?.type || entry.fromType || 'unknown';
            const toType = entry.to?.type || entry.toType || 'user';
            const fromId = entry.from?.id || entry.fromId;
            const toId = entry.to?.id || entry.toId;

            // Look up from name if missing or equals ID
            if (fromId && fromType === 'user' && (!fromName || fromName === fromId)) {
              const fromUser = await this.prisma.user.findUnique({
                where: { id: fromId },
                select: { name: true, email: true },
              });
              fromName = fromUser?.name || fromUser?.email || 'Unknown User';
            } else if (fromId && fromType === 'department' && (!fromName || fromName === fromId)) {
              const fromDept = await this.prisma.department.findUnique({
                where: { id: fromId },
                select: { name: true },
              });
              fromName = fromDept?.name || 'Unknown Department';
            } else if (!fromName) {
              // Use current workflow assignee as fallback
              const currentWorkflow = await this.prisma.workflow.findUnique({
                where: { id },
                select: { assignedToName: true, assignedToType: true },
              });
              if (currentWorkflow?.assignedToName) {
                fromName = currentWorkflow.assignedToName;
              } else {
                fromName = 'Unknown';
              }
            }

            // Look up to name if missing or equals ID
            if (toId && toType === 'user' && (!toName || toName === toId)) {
              const toUser = await this.prisma.user.findUnique({
                where: { id: toId },
                select: { name: true, email: true },
              });
              toName = toUser?.name || toUser?.email || 'Unknown User';
            } else if (toId && toType === 'department' && (!toName || toName === toId)) {
              const toDept = await this.prisma.department.findUnique({
                where: { id: toId },
                select: { name: true },
              });
              toName = toDept?.name || 'Unknown Department';
            } else if (!toName) {
              toName = 'Unknown';
            }

            return {
              fromType,
              fromId,
              fromName,
              toType,
              toId,
              toName,
              routingType: entry.routingType || 'manual',
              routingNotes: entry.notes || entry.routingNotes || null,
              routedBy: entry.routedBy || 'System',
              routedAt: entry.routedAt ? new Date(entry.routedAt) : new Date(),
              isCrossCompany: entry.isCrossCompany || entry.routingType === 'cross_company' || false,
              sourceCompanyId: entry.sourceCompanyId || null,
              targetCompanyId: entry.targetCompanyId || null,
            };
          })
        );

        updateData.routingHistory = {
          create: routingEntries,
        };
      }
    }
    
    // Check access control before updating
    const existingWorkflow = await this.prisma.workflow.findUnique({
      where: { id },
      select: { companyId: true },
    });
    
    if (!existingWorkflow) {
      throw new Error('Workflow not found');
    }
    
    if (currentUser) {
      if (currentUser.role !== 'Master' && existingWorkflow.companyId !== currentUser.companyId) {
        throw new Error('Access denied: Cannot update workflow from different company');
      }
    }

    const workflow = await this.prisma.workflow.update({
      where: { id },
      data: updateData,
      include: {
        company: true,
        document: true,
        creator: true,
        routingHistory: {
          orderBy: {
            routedAt: 'asc',
          },
        },
      },
    });
    const transformed = this.transformWorkflow(workflow);
    
    // Emit WebSocket event
    this.wsGateway.emitWorkflowUpdate(id, transformed);
    
    // Log activity
    try {
      await this.activityService.createActivity({
        userId: currentUser?.id || workflow.assignedBy,
        companyId: workflow.companyId,
        activityType: 'workflow_updated',
        resourceType: 'workflow',
        resourceId: id,
        description: `Workflow "${workflow.title}" was updated`,
        metadata: { status: data.status, progress: data.progress },
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
    
    return transformed;
  }

  // Goals methods
  async getGoals(workflowId: string, currentUser: any = null) {
    const goals = await this.prisma.workflowGoal.findMany({
      where: { workflowId },
      include: {
        creator: true,
        workflow: {
          select: {
            id: true,
            title: true,
            status: true,
            assignedBy: true,
            assignedToType: true,
            assignedToId: true,
            routingHistory: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // If user is provided, filter to only show goals they have access to
    if (currentUser) {
      return goals.filter(goal => this.canUserAccessGoal(goal, currentUser));
    }

    return goals;
  }

  /**
   * Get all goals for a specific user (across all workflows they participated in)
   */
  async getUserGoals(userId: string) {
    // Get user info with departments
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { 
        id: true, 
        userDepartments: {
          include: {
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return [];
    }

    // Get user's department names
    const userDepartmentNames = user.userDepartments.map(
      (ud) => ud.department.name
    );
    const userDepartmentIds = user.userDepartments.map(
      (ud) => ud.department.id
    );

    // Get all workflows the user participated in
    const workflows = await this.prisma.workflow.findMany({
      where: {
        OR: [
          { assignedBy: userId },
          { assignedToType: 'user', assignedToId: userId },
          {
            routingHistory: {
              some: {
                OR: [
                  { fromType: 'user', fromId: userId },
                  { toType: 'user', toId: userId },
                ],
              },
            },
          },
        ],
      },
      select: { id: true },
    });

    const workflowIds = workflows.map(w => w.id);

    // Get all goals from these workflows
    const allGoals = await this.prisma.workflowGoal.findMany({
      where: {
        workflowId: { in: workflowIds },
      },
      include: {
        creator: true,
        workflow: {
          select: {
            id: true,
            title: true,
            status: true,
            completedAt: true,
            // filedAt: true, // Will be available after migration
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Filter to only goals assigned to this user, their department, or all participants
    return allGoals.filter(goal => {
      // All participants can see it
      if (goal.assignedToType === 'all_participants') return true;
      
      // Assigned to specific user
      if (goal.assignedToType === 'user' && goal.assignedToId === userId) return true;
      
      // Assigned to department - check if user's department matches
      if (goal.assignedToType === 'department') {
        const goalDeptName = goal.assignedToName || goal.assignedToId;
        // Check if user is in the department by name or ID
        if (userDepartmentNames.some(name => 
          name === goalDeptName || name.toLowerCase() === goalDeptName?.toLowerCase()
        ) || userDepartmentIds.includes(goalDeptName)) {
          return true;
        }
      }
      
      // Check assignedUsers array
      if (goal.assignedUsers && Array.isArray(goal.assignedUsers)) {
        return (goal.assignedUsers as any[]).some((u: any) => {
          if (u.id === userId) return true;
          if (u.type === 'department') {
            const deptName = u.name || u.id;
            return userDepartmentNames.some(name => 
              name === deptName || name.toLowerCase() === deptName?.toLowerCase()
            ) || userDepartmentIds.includes(deptName);
          }
          return false;
        });
      }
      
      return false;
    });
  }

  /**
   * Check if user can access a goal
   */
  private canUserAccessGoal(goal: any, user: any): boolean {
    // Creator can always access
    if (goal.createdBy === user.id) return true;

    // Check if assigned to all participants
    if (goal.assignedToType === 'all_participants') {
      // Check if user is a workflow participant
      return this.isWorkflowParticipant(goal.workflow, user);
    }

    // Check if assigned to specific user
    if (goal.assignedToType === 'user' && goal.assignedToId === user.id) {
      return true;
    }

    // Check assignedUsers array
    if (goal.assignedUsers && Array.isArray(goal.assignedUsers)) {
      return (goal.assignedUsers as any[]).some((u: any) => u.id === user.id);
    }

    return false;
  }

  /**
   * Check if user is a workflow participant
   */
  private isWorkflowParticipant(workflow: any, user: any): boolean {
    // Creator
    if (workflow.assignedBy === user.id) return true;

    // Current assignee
    if (workflow.assignedToType === 'user' && workflow.assignedToId === user.id) {
      return true;
    }

    // In routing history
    if (workflow.routingHistory && Array.isArray(workflow.routingHistory)) {
      for (const route of workflow.routingHistory) {
        if (route.fromType === 'user' && route.fromId === user.id) return true;
        if (route.toType === 'user' && route.toId === user.id) return true;
      }
    }

    return false;
  }

  async createGoal(workflowId: string, data: any, currentUser: any) {
    // Get workflow to determine companyId
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { companyId: true, status: true },
    });

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // Only allow creating goals for workflows that are ready_for_review or completed
    if (workflow.status !== 'ready_for_review' && workflow.status !== 'completed') {
      throw new Error('Goals can only be created for workflows that are ready for review or completed');
    }

    // Validate required fields
    if (!data.assignedToType) {
      throw new Error('assignedToType is required');
    }
    if (!data.assignedToName) {
      throw new Error('assignedToName is required');
    }

    const goalData: any = {
      workflowId,
      companyId: workflow.companyId,
      title: data.title,
      description: data.description || null,
      status: data.status || 'pending',
      assignedToType: data.assignedToType,
      assignedToId: data.assignedToId || null,
      assignedToName: data.assignedToName || 'Unknown',
      assignedUsers: data.assignedUsers || null, // Prisma handles Json type automatically
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      createdBy: currentUser.id,
    };

    return this.prisma.workflowGoal.create({
      data: goalData,
      include: {
        creator: true,
        workflow: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });
  }

  async updateGoal(goalId: string, data: any, currentUser?: any) {
    // Check access control
    const goal = await this.prisma.workflowGoal.findUnique({
      where: { id: goalId },
      include: {
        workflow: {
          select: { companyId: true },
        },
      },
    });
    
    if (!goal) {
      throw new Error('Goal not found');
    }
    
    if (currentUser) {
      if (currentUser.role !== 'Master' && goal.workflow.companyId !== currentUser.companyId) {
        throw new Error('Access denied: Cannot update goal from different company');
      }
    }
    
    return this.prisma.workflowGoal.update({
      where: { id: goalId },
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
      include: {
        creator: true,
        workflow: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });
  }

  async achieveGoal(goalId: string, currentUser: any, notes?: string) {
    return this.prisma.workflowGoal.update({
      where: { id: goalId },
      data: {
        status: 'achieved',
        achievedAt: new Date(),
        achievedBy: currentUser.id,
        achievementNotes: notes || null,
      },
      include: {
        creator: true,
        workflow: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });
  }

  async deleteGoal(goalId: string, currentUser?: any) {
    // Check access control
    const goal = await this.prisma.workflowGoal.findUnique({
      where: { id: goalId },
      include: {
        workflow: {
          select: { companyId: true },
        },
      },
    });
    
    if (!goal) {
      throw new Error('Goal not found');
    }
    
    if (currentUser) {
      if (currentUser.role !== 'Master' && goal.workflow.companyId !== currentUser.companyId) {
        throw new Error('Access denied: Cannot delete goal from different company');
      }
    }
    
    return this.prisma.workflowGoal.delete({
      where: { id: goalId },
    });
  }

  /**
   * Remove staff permissions from document, keeping only secretary access
   */
  private async removeStaffPermissionsFromDocument(documentId: string, secretaryId: string) {
    try {
      // Get all file-folder links for this document
      const fileFolderLinks = await this.prisma.fileFolderLink.findMany({
        where: { fileId: documentId },
      });

      // Update permissions to remove staff access (keep only secretary)
      for (const link of fileFolderLinks) {
        let permissions: any = {};
        
        if (link.permissionsJson && typeof link.permissionsJson === 'object') {
          permissions = link.permissionsJson as any;
        }

        // Remove all user permissions except secretary
        if (permissions.users && Array.isArray(permissions.users)) {
          permissions.users = permissions.users.filter((userPerm: any) => 
            userPerm.userId === secretaryId
          );
        }

        // Remove all department permissions (staff access)
        if (permissions.departments && Array.isArray(permissions.departments)) {
          permissions.departments = [];
        }

        // Update the link with new permissions
        // FileFolderLink has composite primary key [fileId, folderId]
        // Using updateMany since we're filtering by both fields which uniquely identify the record
        await this.prisma.fileFolderLink.updateMany({
          where: {
            fileId: link.fileId,
            folderId: link.folderId,
          },
          data: {
            permissionsJson: permissions,
          },
        });
      }
    } catch (error) {
      console.error('Failed to remove staff permissions from document:', error);
      // Don't throw - permission removal failure shouldn't break workflow routing
    }
  }

  /**
   * Notify workflow participants about goals when workflow is filed
   */
  private async notifyParticipantsAboutGoals(workflowId: string) {
    try {
      // Get workflow with goals and participants
      const workflow = await this.prisma.workflow.findUnique({
        where: { id: workflowId },
        include: {
          goals: {
            where: { status: { not: 'achieved' } }, // Only notify about pending goals
          },
          routingHistory: true,
          creator: true,
        },
      });

      if (!workflow || !workflow.goals || workflow.goals.length === 0) {
        return; // No goals to notify about
      }

      // Collect all participant user IDs
      const participantIds = new Set<string>();

      // Add creator
      if (workflow.assignedBy) {
        participantIds.add(workflow.assignedBy);
      }

      // Add current assignee if it's a user
      if (workflow.assignedToType === 'user' && workflow.assignedToId) {
        participantIds.add(workflow.assignedToId);
      }

      // Add users from routing history
      if (workflow.routingHistory) {
        workflow.routingHistory.forEach((route: any) => {
          if (route.fromType === 'user' && route.fromId) {
            participantIds.add(route.fromId);
          }
          if (route.toType === 'user' && route.toId) {
            participantIds.add(route.toId);
          }
        });
      }

      // Create notifications for each participant about each goal
      const notifications = [];
      for (const participantId of Array.from(participantIds)) {
        for (const goal of workflow.goals) {
          // Check if goal is assigned to this participant or all participants
          const isAssignedToParticipant = 
            goal.assignedToType === 'all_participants' ||
            (goal.assignedToType === 'user' && goal.assignedToId === participantId) ||
            (goal.assignedUsers && Array.isArray(goal.assignedUsers) && 
             (goal.assignedUsers as any[]).some((u: any) => u.id === participantId));

          if (isAssignedToParticipant) {
            notifications.push({
              userId: participantId,
              companyId: workflow.companyId,
              type: 'goal_reminder',
              title: `Goal Reminder: ${goal.title}`,
              message: `You have a pending goal in workflow "${workflow.title}". View workflow to track progress.`,
              resourceType: 'workflow',
              resourceId: workflowId, // Link to workflow, not just goal
              read: false,
            });
          }
        }
      }

      // Bulk create notifications
      if (notifications.length > 0) {
        await this.prisma.notification.createMany({
          data: notifications,
        });
      }
    } catch (error) {
      console.error('Failed to notify participants about goals:', error);
      // Don't throw - notification failure shouldn't break workflow filing
    }
  }
}
