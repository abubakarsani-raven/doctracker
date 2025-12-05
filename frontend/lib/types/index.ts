// Common types used across the application

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  companyId: string;
  departmentId?: string;
  divisionId?: string;
  avatar?: string;
}

export interface Company {
  id: string;
  name: string;
  createdAt: Date;
}

export interface Department {
  id: string;
  name: string;
  companyId: string;
  description?: string;
}

export interface Division {
  id: string;
  name: string;
  departmentId: string;
  description?: string;
}

export type DocumentScope = "company" | "department" | "division";

export type WorkflowStatus =
  | "assigned"
  | "in_progress"
  | "ready_for_review"
  | "returned_to_secretary"
  | "actions_added"
  | "routed_to_department"
  | "final_review"
  | "completed";

export type ActionStatus = "pending" | "in_progress" | "completed";
