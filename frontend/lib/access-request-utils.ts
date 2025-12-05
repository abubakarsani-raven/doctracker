/**
 * Access Request Utilities
 * Handles document/folder access requests with role-based approval
 */

export interface AccessRequest {
  id: string;
  resourceId: string;
  resourceType: "folder" | "document";
  resourceName: string;
  scope?: "company" | "department" | "division";
  requestedBy: string;
  requestedByName: string;
  reason?: string;
  status: "pending" | "approved" | "rejected";
  approvedBy?: string;
  approvedByName?: string;
  rejectedBy?: string;
  rejectedByName?: string;
  rejectionReason?: string;
  approvedAt?: string;
  rejectedAt?: string;
  createdAt: string;
  updatedAt: string;
  companyId?: string;
  departmentId?: string;
}

/**
 * Determine who can approve an access request based on scope
 */
export function getApproversForScope(
  scope: "company" | "department" | "division" | undefined
): string[] {
  if (scope === "company") {
    // Company-wide: Company Admin, Department Secretary (Company Secretary)
    return ["Company Admin", "Department Secretary"];
  }
  
  // Department/Division scope: Department Head, Manager, Company Admin, Department Secretary
  return ["Department Head", "Manager", "Company Admin", "Department Secretary"];
}

/**
 * Check if a user can approve an access request
 */
export function canApproveAccessRequest(
  request: AccessRequest,
  currentUser: any
): boolean {
  if (!currentUser) return false;

  // Master can approve everything
  if (currentUser.role === "Master") return true;

  const approvers = getApproversForScope(request.scope);
  
  // Check if user's role is in the approvers list
  return approvers.includes(currentUser.role);
}

/**
 * Create an access request
 */
export function createAccessRequest(data: {
  resourceId: string;
  resourceType: "folder" | "document";
  resourceName: string;
  scope?: "company" | "department" | "division";
  reason: string;
  requestedBy: string;
  requestedByName: string;
  companyId?: string;
  departmentId?: string;
}): AccessRequest {
  const request: AccessRequest = {
    id: `access-req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ...data,
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Save to localStorage
  const existing = JSON.parse(localStorage.getItem("accessRequests") || "[]");
  existing.push(request);
  localStorage.setItem("accessRequests", JSON.stringify(existing));

  // Create notification for approvers
  const notifications = JSON.parse(localStorage.getItem("notifications") || "[]");
  const approvers = getApproversForScope(data.scope);
  
  // Get all users to find approvers
  const users = JSON.parse(localStorage.getItem("users") || "[]");
  const approverUsers = users.filter((u: any) => 
    approvers.includes(u.role) && u.status === "active"
  );

  approverUsers.forEach((approver: any) => {
    notifications.push({
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: "access_request",
      title: "New Access Request",
      message: `${data.requestedByName} requested access to ${data.resourceType}: ${data.resourceName}`,
      resourceType: "access_request",
      resourceId: request.id,
      read: false,
      createdAt: new Date().toISOString(),
    });
  });

  localStorage.setItem("notifications", JSON.stringify(notifications));
  window.dispatchEvent(new CustomEvent("notificationsUpdated"));
  window.dispatchEvent(new CustomEvent("accessRequestsUpdated"));

  return request;
}

/**
 * Get all access requests
 */
export function getAccessRequests(): AccessRequest[] {
  return JSON.parse(localStorage.getItem("accessRequests") || "[]");
}

/**
 * Get pending access requests that a user can approve
 */
export function getPendingAccessRequestsForApprover(
  currentUser: any
): AccessRequest[] {
  const allRequests = getAccessRequests();
  return allRequests.filter(
    (request) =>
      request.status === "pending" && canApproveAccessRequest(request, currentUser)
  );
}

/**
 * Approve an access request
 */
export function approveAccessRequest(
  requestId: string,
  approvedBy: string,
  approvedByName: string
): boolean {
  const requests = getAccessRequests();
  const request = requests.find((r) => r.id === requestId);

  if (!request || request.status !== "pending") {
    return false;
  }

  request.status = "approved";
  request.approvedBy = approvedBy;
  request.approvedByName = approvedByName;
  request.approvedAt = new Date().toISOString();
  request.updatedAt = new Date().toISOString();

  localStorage.setItem("accessRequests", JSON.stringify(requests));
  
  // Create notification for requester
  const notifications = JSON.parse(localStorage.getItem("notifications") || "[]");
  notifications.push({
    id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: "access_request_approved",
    title: "Access Request Approved",
    message: `Your access request for ${request.resourceType}: ${request.resourceName} has been approved`,
    resourceType: request.resourceType,
    resourceId: request.resourceId,
    read: false,
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem("notifications", JSON.stringify(notifications));
  
  window.dispatchEvent(new CustomEvent("accessRequestsUpdated"));
  window.dispatchEvent(new CustomEvent("notificationsUpdated"));

  return true;
}

/**
 * Reject an access request
 */
export function rejectAccessRequest(
  requestId: string,
  rejectedBy: string,
  rejectedByName: string,
  rejectionReason: string
): boolean {
  const requests = getAccessRequests();
  const request = requests.find((r) => r.id === requestId);

  if (!request || request.status !== "pending") {
    return false;
  }

  request.status = "rejected";
  request.rejectedBy = rejectedBy;
  request.rejectedByName = rejectedByName;
  request.rejectionReason = rejectionReason;
  request.rejectedAt = new Date().toISOString();
  request.updatedAt = new Date().toISOString();

  localStorage.setItem("accessRequests", JSON.stringify(requests));
  
  // Create notification for requester
  const notifications = JSON.parse(localStorage.getItem("notifications") || "[]");
  notifications.push({
    id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: "access_request_rejected",
    title: "Access Request Rejected",
    message: `Your access request for ${request.resourceType}: ${request.resourceName} has been rejected`,
    resourceType: request.resourceType,
    resourceId: request.resourceId,
    read: false,
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem("notifications", JSON.stringify(notifications));
  
  window.dispatchEvent(new CustomEvent("accessRequestsUpdated"));
  window.dispatchEvent(new CustomEvent("notificationsUpdated"));

  return true;
}

/**
 * Check if user has access to a resource (either has permission or approved request)
 */
export function hasAccessToResource(
  resourceId: string,
  resourceType: "folder" | "document",
  currentUser: any,
  hasPermission: boolean // Whether user has permission based on role/scope
): boolean {
  if (!currentUser) return false;

  // If user has permission, they have access
  if (hasPermission) return true;

  // Master has access to everything
  if (currentUser.role === "Master") return true;

  // Check approved access requests
  const requests = getAccessRequests();
  const approvedRequest = requests.find(
    (r) =>
      r.resourceId === resourceId &&
      r.resourceType === resourceType &&
      r.requestedBy === currentUser.id &&
      r.status === "approved"
  );

  return !!approvedRequest;
}

/**
 * Check if user has a pending request for a resource
 */
export function hasPendingRequest(
  resourceId: string,
  resourceType: "folder" | "document",
  currentUser: any
): boolean {
  if (!currentUser) return false;

  const requests = getAccessRequests();
  return requests.some(
    (r) =>
      r.resourceId === resourceId &&
      r.resourceType === resourceType &&
      r.requestedBy === currentUser.id &&
      r.status === "pending"
  );
}
