/**
 * Workflow Utility Functions
 * Pure calculation functions - no API calls, no localStorage, no events
 */

import { isCompanyAdmin } from "./cross-company-utils";

/**
 * Calculate progress from actions array (pure function)
 */
export function calculateProgressFromActions(actions: any[]): number {
  if (actions.length === 0) {
    return 0;
  }

  // Count completed actions (including document_uploaded and response_received as progress)
  const completedActions = actions.filter((action: any) => {
    const status = action.status;
    return (
      status === "completed" ||
      status === "document_uploaded" ||
      status === "response_received"
    );
  });

  // Calculate progress percentage
  return Math.round((completedActions.length / actions.length) * 100);
}

/**
 * Calculate new workflow status based on progress and actions
 */
export function calculateWorkflowStatus(
  currentStatus: string,
  progress: number,
  actions: any[]
): string {
  const allCompleted =
    actions.length > 0 &&
    actions.every((action: any) => action.status === "completed");

  if (allCompleted && progress === 100 && actions.length > 0) {
    return "ready_for_review";
  } else if (progress > 0 && currentStatus === "assigned") {
    return "in_progress";
  }

  return currentStatus;
}

/**
 * Check if workflow is cross-company
 */
export function isCrossCompanyWorkflow(workflow: any): boolean {
  return workflow?.isCrossCompany === true;
}

/**
 * Check if user can view cross-company workflow
 */
export function canViewCrossCompanyWorkflow(
  workflow: any,
  currentUser: any,
  userCompanyId: string | null
): boolean {
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
        if (
          workflow.assignedTo.type === "user" &&
          workflow.assignedTo.id === currentUser.id
        ) {
          return true;
        }
        if (
          workflow.assignedTo.type === "department" &&
          currentUser.department
        ) {
          const deptName = workflow.assignedTo.name || workflow.assignedTo.id;
          return (
            currentUser.department === deptName ||
            currentUser.department.toLowerCase() === deptName.toLowerCase()
          );
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
    return (
      workflow.approvalStatus === "approved" ||
      workflow.approvalStatus === "pending"
    );
  }

  return false;
}
