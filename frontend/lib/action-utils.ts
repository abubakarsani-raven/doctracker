/**
 * Action Utility Functions
 * Helper functions for checking action visibility and permissions
 */

/**
 * Check if user is assigned to an action
 */
export function isAssignedToAction(action: any, currentUser: any): boolean {
  if (!currentUser || !action.assignedTo) return false;

  // Check if assigned to user directly
  if (action.assignedTo.type === "user" && action.assignedTo.id === currentUser.id) {
    return true;
  }

  // Check if assigned to user's department
  if (action.assignedTo.type === "department") {
    // Get department name or ID from assignedTo
    const assignedDeptName = action.assignedTo.name || action.assignedTo.id;
    
    // Check single department field (backward compatibility)
    if (currentUser.department) {
      if (currentUser.department === assignedDeptName || 
          currentUser.department.toLowerCase() === assignedDeptName.toLowerCase()) {
        return true;
      }
    }
    
    // Check departments array (new structure)
    if (currentUser.departments && Array.isArray(currentUser.departments)) {
      return currentUser.departments.some((dept: string) => 
        dept === assignedDeptName || dept.toLowerCase() === assignedDeptName.toLowerCase()
      );
    }
    
    // Check userDepartments relation if available
    if (currentUser.userDepartments && Array.isArray(currentUser.userDepartments)) {
      return currentUser.userDepartments.some((ud: any) => {
        const deptName = ud.department?.name || ud.departmentId;
        return deptName === assignedDeptName || 
               deptName?.toLowerCase() === assignedDeptName.toLowerCase();
      });
    }
  }

  return false;
}

/**
 * Check if user is part of the workflow that created the action
 */
export function isWorkflowParticipant(action: any, workflow: any, currentUser: any): boolean {
  if (!currentUser || !workflow || !action.workflowId) return false;

  // Check if user is workflow creator
  if (workflow.assignedBy === currentUser.name || workflow.assignedBy === currentUser.id) {
    return true;
  }

  // Check if user is current workflow assignee
  if (workflow.assignedTo) {
    if (workflow.assignedTo.type === "user" && workflow.assignedTo.id === currentUser.id) {
      return true;
    }
    if (workflow.assignedTo.type === "department") {
      const workflowDeptName = workflow.assignedTo.name || workflow.assignedTo.id;
      
      // Check single department field (backward compatibility)
      if (currentUser.department) {
        if (currentUser.department === workflowDeptName || 
            currentUser.department.toLowerCase() === workflowDeptName.toLowerCase()) {
          return true;
        }
      }
      
      // Check departments array
      if (currentUser.departments && Array.isArray(currentUser.departments)) {
        if (currentUser.departments.some((dept: string) => 
          dept === workflowDeptName || dept.toLowerCase() === workflowDeptName.toLowerCase()
        )) {
          return true;
        }
      }
      
      // Check userDepartments relation
      if (currentUser.userDepartments && Array.isArray(currentUser.userDepartments)) {
        if (currentUser.userDepartments.some((ud: any) => {
          const deptName = ud.department?.name || ud.departmentId;
          return deptName === workflowDeptName || 
                 deptName?.toLowerCase() === workflowDeptName.toLowerCase();
        })) {
          return true;
        }
      }
    }
  }

  // Check if user is in routing history
  if (workflow.routingHistory && Array.isArray(workflow.routingHistory)) {
    for (const route of workflow.routingHistory) {
      // Check from
      if (route.from && route.from.type === "user" && route.from.id === currentUser.id) {
        return true;
      }
      if (route.from && route.from.type === "department") {
        const fromDeptName = route.from.name || route.from.id;
        
        // Check single department field
        if (currentUser.department && 
            (currentUser.department === fromDeptName || 
             currentUser.department.toLowerCase() === fromDeptName.toLowerCase())) {
          return true;
        }
        
        // Check departments array
        if (currentUser.departments && Array.isArray(currentUser.departments)) {
          if (currentUser.departments.some((dept: string) => 
            dept === fromDeptName || dept.toLowerCase() === fromDeptName.toLowerCase()
          )) {
            return true;
          }
        }
      }
      // Check to
      if (route.to && route.to.type === "user" && route.to.id === currentUser.id) {
        return true;
      }
      if (route.to && route.to.type === "department") {
        const toDeptName = route.to.name || route.to.id;
        
        // Check single department field
        if (currentUser.department && 
            (currentUser.department === toDeptName || 
             currentUser.department.toLowerCase() === toDeptName.toLowerCase())) {
          return true;
        }
        
        // Check departments array
        if (currentUser.departments && Array.isArray(currentUser.departments)) {
          if (currentUser.departments.some((dept: string) => 
            dept === toDeptName || dept.toLowerCase() === toDeptName.toLowerCase()
          )) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Check if user can respond to an action
 * Users can respond if assigned, but NOT if they're just workflow participants
 */
export function canRespondToAction(action: any, workflow: any, currentUser: any): boolean {
  if (!currentUser) return false;

  // User can respond if they're assigned
  if (isAssignedToAction(action, currentUser)) {
    return true;
  }

  // User cannot respond if they're only a workflow participant (not assigned)
  if (workflow && isWorkflowParticipant(action, workflow, currentUser)) {
    return false;
  }

  return false;
}

/**
 * Check if user can view an action
 * Users can view if:
 * - Assigned to them or their department
 * - They're part of the workflow that created it
 */
export function canViewAction(
  action: any,
  currentUser: any,
  workflows: any[] = []
): boolean {
  if (!currentUser) return false;

  // Can view if assigned
  if (isAssignedToAction(action, currentUser)) {
    return true;
  }

  // Can view if part of workflow
  if (action.workflowId && workflows && Array.isArray(workflows)) {
    const workflow = workflows.find((w: any) => w.id === action.workflowId);
    if (workflow && isWorkflowParticipant(action, workflow, currentUser)) {
      return true;
    }
  }

  return false;
}

