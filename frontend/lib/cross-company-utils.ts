/**
 * Cross-Company Collaboration Utility Functions
 * Helper functions for cross-company workflow and action management
 */

import { api } from "./api";

export interface CrossCompanyApprovalRequest {
  id: string;
  workflowId?: string; // For workflow assignments/routing
  actionId?: string; // For action assignments
  requestType: "workflow_assignment" | "action_assignment" | "workflow_routing";
  sourceCompanyId: string;
  sourceCompanyName: string;
  targetCompanyId: string;
  targetCompanyName: string;
  requestedBy: string; // User ID who requested
  requestedAt: string;
  assignedTo: {
    type: "user" | "department";
    id: string;
    name: string;
  };
  status: "pending" | "approved" | "rejected";
  reviewedBy?: string; // User ID who reviewed (target company admin)
  reviewedAt?: string;
  rejectionReason?: string;
  workflowTitle?: string;
  workflowDescription?: string;
  actionTitle?: string;
  actionDescription?: string;
  routingNotes?: string;
}

/**
 * Get all approval requests
 */
export function getApprovalRequests(): CrossCompanyApprovalRequest[] {
  try {
    const stored = localStorage.getItem("crossCompanyApprovals");
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Failed to get approval requests:", error);
    return [];
  }
}

/**
 * Save approval requests
 */
export function saveApprovalRequests(requests: CrossCompanyApprovalRequest[]): void {
  try {
    localStorage.setItem("crossCompanyApprovals", JSON.stringify(requests));
    // Dispatch event for UI updates
    window.dispatchEvent(new CustomEvent("approvalRequestsUpdated"));
  } catch (error) {
    console.error("Failed to save approval requests:", error);
  }
}

/**
 * Create a new approval request
 */
export function createApprovalRequest(
  request: Omit<CrossCompanyApprovalRequest, "id" | "requestedAt" | "status">
): CrossCompanyApprovalRequest {
  const newRequest: CrossCompanyApprovalRequest = {
    ...request,
    id: `approval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    requestedAt: new Date().toISOString(),
    status: "pending",
  };

  const requests = getApprovalRequests();
  requests.push(newRequest);
  saveApprovalRequests(requests);

  return newRequest;
}

/**
 * Update approval request status
 */
export function updateApprovalRequest(
  requestId: string,
  updates: {
    status: "approved" | "rejected";
    reviewedBy: string;
    rejectionReason?: string;
  }
): CrossCompanyApprovalRequest | null {
  const requests = getApprovalRequests();
  const index = requests.findIndex((r) => r.id === requestId);

  if (index === -1) {
    return null;
  }

  const updated: CrossCompanyApprovalRequest = {
    ...requests[index],
    ...updates,
    reviewedAt: new Date().toISOString(),
  };

  requests[index] = updated;
  saveApprovalRequests(requests);

  return updated;
}

/**
 * Get approval requests for a specific workflow
 */
export function getApprovalRequestsForWorkflow(
  workflowId: string
): CrossCompanyApprovalRequest[] {
  const requests = getApprovalRequests();
  return requests.filter(
    (r) => r.workflowId === workflowId && (r.requestType === "workflow_assignment" || r.requestType === "workflow_routing")
  );
}

/**
 * Get approval requests for a specific action
 */
export function getApprovalRequestsForAction(
  actionId: string
): CrossCompanyApprovalRequest[] {
  const requests = getApprovalRequests();
  return requests.filter(
    (r) => r.actionId === actionId && r.requestType === "action_assignment"
  );
}

/**
 * Get pending approval requests for a company (target company)
 */
export function getPendingApprovalsForCompany(companyId: string): CrossCompanyApprovalRequest[] {
  const requests = getApprovalRequests();
  return requests.filter(
    (r) => r.targetCompanyId === companyId && r.status === "pending"
  );
}

/**
 * Get pending approval requests created by a company (source company)
 */
export function getPendingApprovalsFromCompany(companyId: string): CrossCompanyApprovalRequest[] {
  const requests = getApprovalRequests();
  return requests.filter(
    (r) => r.sourceCompanyId === companyId && r.status === "pending"
  );
}

/**
 * Check if user is Company Admin
 */
export function isCompanyAdmin(user: any): boolean {
  return user?.role === "Company Admin" || user?.role === "Master";
}

/**
 * Get user's company ID
 */
export async function getUserCompanyId(user: any): Promise<string | null> {
  if (!user) return null;

  // Check if user has companyId directly
  if (user.companyId) {
    return user.companyId;
  }

  // Try to find user's company from companies list
  try {
    const companies = await api.getCompanies();
    // Look for company that contains this user's department
    for (const company of companies) {
      if (company.departments) {
        for (const dept of company.departments) {
          // Check if user's department matches
          if (user.department && (dept.id === user.department || dept.name === user.department)) {
            return company.id;
          }
        }
      }
    }
  } catch (error) {
    console.error("Failed to get user company:", error);
  }

  return null;
}

/**
 * Get company name by ID
 */
export async function getCompanyName(companyId: string): Promise<string | null> {
  try {
    const companies = await api.getCompanies();
    const company = companies.find((c: any) => c.id === companyId);
    return company?.name || null;
  } catch (error) {
    console.error("Failed to get company name:", error);
    return null;
  }
}

/**
 * Check if assignment is cross-company
 */
export function isCrossCompanyAssignment(
  sourceCompanyId: string | null,
  targetCompanyId: string | null
): boolean {
  if (!sourceCompanyId || !targetCompanyId) return false;
  return sourceCompanyId !== targetCompanyId;
}

/**
 * Get department company ID
 */
export async function getDepartmentCompanyId(departmentId: string): Promise<string | null> {
  try {
    const companies = await api.getCompanies();
    for (const company of companies) {
      if (company.departments) {
        const dept = company.departments.find((d: any) => d.id === departmentId || d.name === departmentId);
        if (dept) {
          return company.id;
        }
      }
    }
  } catch (error) {
    console.error("Failed to get department company:", error);
  }
  return null;
}

/**
 * Get user company ID by user ID
 */
export async function getUserCompanyIdByUserId(userId: string): Promise<string | null> {
  try {
    const users = await api.getUsers();
    const user = users.find((u: any) => u.id === userId);
    if (!user) return null;
    return await getUserCompanyId(user);
  } catch (error) {
    console.error("Failed to get user company by ID:", error);
    return null;
  }
}
