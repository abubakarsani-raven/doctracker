import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

/** `{ type, id, name }` — the workflow's current assignee. */
export class AssigneeDto {
  @IsIn(['user', 'department'])
  type: string;

  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  name?: string;
}

export class CreateWorkflowDto {
  @IsString()
  @MaxLength(500)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsIn(['folder', 'document'])
  type: string;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  folderId?: string;

  @IsOptional()
  @IsString()
  documentId?: string;

  @IsOptional()
  @IsIn(['assigned', 'in_progress', 'ready_for_review', 'completed', 'pending'])
  status?: string;

  @IsOptional()
  @IsObject()
  assignedTo?: AssigneeDto;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsBoolean()
  isCrossCompany?: boolean;

  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected'])
  approvalStatus?: string;

  @IsOptional()
  @IsString()
  sourceCompanyId?: string;

  @IsOptional()
  @IsString()
  sourceCompanyName?: string;

  @IsOptional()
  @IsString()
  targetCompanyId?: string;

  @IsOptional()
  @IsString()
  targetCompanyName?: string;
}

export class UpdateWorkflowDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsIn(['folder', 'document'])
  type?: string;

  @IsOptional()
  @IsString()
  folderId?: string;

  @IsOptional()
  @IsString()
  documentId?: string;

  @IsOptional()
  @IsIn(['assigned', 'in_progress', 'ready_for_review', 'completed', 'pending'])
  status?: string;

  @IsOptional()
  @IsObject()
  assignedTo?: AssigneeDto;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsBoolean()
  isCrossCompany?: boolean;

  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected'])
  approvalStatus?: string;

  @IsOptional()
  @IsDateString()
  approvalRequestedAt?: string;

  @IsOptional()
  @IsString()
  approvedBy?: string;

  @IsOptional()
  @IsDateString()
  approvedAt?: string;

  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @IsOptional()
  @IsDateString()
  filedAt?: string;

  @IsOptional()
  @IsString()
  sourceCompanyId?: string;

  @IsOptional()
  @IsString()
  sourceCompanyName?: string;

  @IsOptional()
  @IsString()
  targetCompanyId?: string;

  @IsOptional()
  @IsString()
  targetCompanyName?: string;

  /** Routing entries appended by the routing sheet. */
  @IsOptional()
  @IsArray()
  routingHistory?: any[];
}

/** Set or clear the workflow end point (stored as dueDate). */
export class SetWorkflowEndPointDto {
  /** ISO date string, or null to clear. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsDateString()
  dueDate?: string | null;
}

export class GrantWorkflowFileAccessDto {
  @IsString()
  userId: string;
}

export class AttachWorkflowFileDto {
  @IsString()
  fileId: string;

  @IsOptional()
  @IsString()
  actionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
