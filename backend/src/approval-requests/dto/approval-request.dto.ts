import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateApprovalRequestDto {
  @IsIn(['workflow_assignment', 'action_assignment', 'workflow_routing'])
  requestType: string;

  @IsOptional()
  @IsString()
  workflowId?: string;

  @IsOptional()
  @IsString()
  actionId?: string;

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

  @IsOptional()
  @IsIn(['user', 'department'])
  assignedToType?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsString()
  assignedToName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  workflowTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  workflowDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  actionTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  actionDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  routingNotes?: string;
}

/**
 * Only the decision travels in the body — `reviewedBy` and `reviewedAt` are
 * set from the authenticated session by the service.
 */
export class UpdateApprovalRequestDto {
  @IsIn(['approved', 'rejected'])
  status: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rejectionReason?: string;
}
