import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAccessRequestDto {
  @IsString()
  resourceId: string;

  @IsIn(['folder', 'document'])
  resourceType: string;

  @IsString()
  @MaxLength(500)
  resourceName: string;

  @IsOptional()
  @IsIn(['company', 'department', 'division'])
  scope?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

/**
 * A reviewer supplies only the decision. Who reviewed it and when are taken
 * from the authenticated session — previously the client sent `approvedBy`
 * and `approvedAt` itself, which meant the audit fields recorded whatever the
 * caller claimed.
 */
export class UpdateAccessRequestDto {
  @IsIn(['approved', 'rejected'])
  status: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rejectionReason?: string;
}
