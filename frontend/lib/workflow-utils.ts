/**
 * Workflow Utility Functions
 * Helper functions for calculating workflow progress, updating status, etc.
 */

import { api } from "./api";
import { getApprovalRequestsForWorkflow, isCompanyAdmin } from "./cross-company-utils";

/**
 * Calculate progress from actions array (no API call)
 */
function calculateProgressFromActions(actions: any[]): number {
  if (actions.length === 0) {
    return 0;
  }
  
  // Count completed actions (including document_uploaded and response_received as progress)
  const completedActions = actions.filter((action: any) => {
    const status = action.status;
    return status === "completed" || 
           status === "document_uploaded" || 
           status === "response_received";
  });
  
  // Calculate progress percentage
  return Math.round((completedActions.length / actions.length) * 100);
}

/**
 * Calculate workflow progress based on actions
 */
export async function calculateWorkflowProgress(workflowId: string): Promise<number> {
  try {
    const allActions = await api.getActions();
    const localActions = JSON.parse(localStorage.getItem("actions") || "[]");
    
    // Merge and filter by workflow
    const workflowActions = [...allActions, ...localActions]
      .filter((action: any) => action.workflowId === workflowId);
    
    return calculateProgressFromActions(workflowActions);
  } catch (error) {
    console.error("Failed to calculate workflow progress:", error);
    return 0;
  }
}

/**
 * Get all actions for a workflow
 */
export async function getWorkflowActions(workflowId: string): Promise<any[]> {
  try {
    const allActions = await api.getActions();
    const localActions = JSON.parse(localStorage.getItem("actions") || "[]");
    
    // Merge and filter by workflow
    const workflowActions = [...allActions, ...localActions]
      .filter((action: any) => action.workflowId === workflowId);
    
    // Deduplicate
    return Array.from(
      new Map(workflowActions.map((a: any) => [a.id, a])).values()
    );
  } catch (error) {
    console.error("Failed to get workflow actions:", error);
    return [];
  }
}

// Track if update is in progress to prevent loops
const updateInProgress = new Set<string>();

/**
 * Update workflow progress and status based on actions
 * @param workflowId - The workflow ID
 * @param skipEventDispatch - If true, don't dispatch workflowsUpdated event (prevents loops)
 */
export async function updateWorkflowProgress(workflowId: string, skipEventDispatch = false): Promise<void> {
  // Prevent concurrent updates for the same workflow
  if (updateInProgress.has(workflowId)) {
    return;
  }
  
  updateInProgress.add(workflowId);
  
  try {
    // Get actions once - we'll calculate progress from this
    const actions = await getWorkflowActions(workflowId);
    
    // Calculate progress directly from actions (no redundant API call)
    const progress = calculateProgressFromActions(actions);
    
    // Check if all actions are completed
    const allCompleted = actions.length > 0 && actions.every((action: any) => {
      const status = action.status;
      return status === "completed";
    });
    
    // Get workflows (needed to update status)
    const workflows = await api.getWorkflows();
    const localWorkflows = JSON.parse(localStorage.getItem("workflows") || "[]");
    const allWorkflows = [...workflows, ...localWorkflows];
    const workflowIndex = allWorkflows.findIndex((w: any) => w.id === workflowId);
    
    if (workflowIndex === -1) {
      return;
    }
    
    const workflow = allWorkflows[workflowIndex];
    // Determine new status based on progress and action completion
    let newStatus = workflow.status;
    if (allCompleted && progress === 100 && actions.length > 0) {
      newStatus = "ready_for_review";
    } else if (progress > 0 && workflow.status === "assigned") {
      newStatus = "in_progress";
    }

    const updatedWorkflow = {
      ...workflow,
      progress: progress,
      status: newStatus,
    };
    
    // Update in localStorage
    const localIndex = localWorkflows.findIndex((w: any) => w.id === workflowId);
    if (localIndex !== -1) {
      localWorkflows[localIndex] = updatedWorkflow;
      localStorage.setItem("workflows", JSON.stringify(localWorkflows));
    } else {
      localWorkflows.push(updatedWorkflow);
      localStorage.setItem("workflows", JSON.stringify(localWorkflows));
    }
    
    // Only dispatch event if not skipped (prevents circular loops)
    if (!skipEventDispatch) {
      window.dispatchEvent(new CustomEvent("workflowsUpdated"));
    }
  } catch (error) {
    console.error("Failed to update workflow progress:", error);
  } finally {
    // Remove from in-progress set after a short delay to allow event to propagate
    setTimeout(() => {
      updateInProgress.delete(workflowId);
    }, 100);
  }
}

/**
 * Check if workflow is cross-company
 */
export function isCrossCompanyWorkflow(workflow: any): boolean {
  return workflow?.isCrossCompany === true;
}

/**
 * Check if workflow has pending approval
 */
export function hasPendingApproval(workflow: any): boolean {
  if (!isCrossCompanyWorkflow(workflow)) return false;
  
  const approvals = getApprovalRequestsForWorkflow(workflow.id);
  return approvals.some((a) => a.status === "pending");
}

/**
 * Check if user can view cross-company workflow
 */
export async function canViewCrossCompanyWorkflow(
  workflow: any,
  currentUser: any,
  userCompanyId: string | null
): Promise<boolean> {
  if (!isCrossCompanyWorkflow(workflow)) return true; // Not cross-company, use normal rules
  
  if (!currentUser) return false;
  
  // Master can see all
  if (currentUser.role === "Master") return true;
  
  // Check if user is Company Admin
  if (!isCompanyAdmin(currentUser)) {
    // Regular users can only see if assigned to them (after approval)
    if (workflow.approvalStatus === "approved") {
      // Check if assigned to user or their department
      if (workflow.assignedTo) {
        if (workflow.assignedTo.type === "user" && workflow.assignedTo.id === currentUser.id) {
          return true;
        }
        if (workflow.assignedTo.type === "department" && currentUser.department) {
          const deptName = workflow.assignedTo.name || workflow.assignedTo.id;
          return currentUser.department === deptName || 
                 currentUser.department.toLowerCase() === deptName.toLowerCase();
        }
      }
    }
    return false;
  }
  
  // Company Admin can see if:
  // - Workflow is from their company (source)
  // - Workflow is assigned to their company (target) and approved
  if (workflow.sourceCompanyId === userCompanyId) {
    return true; // Created by their company
  }
  
  if (workflow.targetCompanyId === userCompanyId) {
    return workflow.approvalStatus === "approved" || workflow.approvalStatus === "pending";
  }
  
  return false;
}
