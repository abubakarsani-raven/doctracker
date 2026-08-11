import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateWorkflowGoalDto {
  @IsString()
  @MaxLength(500)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsIn(['pending', 'in_progress', 'achieved'])
  status?: string;

  @IsIn(['user', 'department', 'all_participants'])
  assignedToType: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsString()
  @MaxLength(500)
  assignedToName: string;

  /** Array of `{ id, name, type }` — stored as JSON on the goal. */
  @IsOptional()
  @IsArray()
  assignedUsers?: any[];

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

/**
 * Goal edits. `achievedBy` / `achievedAt` are deliberately absent — those are
 * written by the achieve endpoint from the session, not accepted from a body.
 */
export class UpdateWorkflowGoalDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsIn(['pending', 'in_progress', 'achieved'])
  status?: string;

  @IsOptional()
  @IsIn(['user', 'department', 'all_participants'])
  assignedToType?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  assignedToName?: string;

  @IsOptional()
  @IsArray()
  assignedUsers?: any[];

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class AchieveWorkflowGoalDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
