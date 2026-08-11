import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const ACTION_STATUSES = [
  'pending',
  'in_progress',
  'document_uploaded',
  'response_received',
  'completed',
];

export class CreateActionDto {
  @IsString()
  workflowId: string;

  @IsString()
  @MaxLength(500)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsIn(['regular', 'document_upload', 'request_response'])
  type: string;

  @IsOptional()
  @IsIn(ACTION_STATUSES)
  status?: string;

  /** `{ type, id, name }`; the flat fields below are the legacy equivalent. */
  @IsOptional()
  @IsObject()
  assignedTo?: { type: string; id: string; name: string };

  @IsOptional()
  @IsIn(['user', 'department'])
  assignedToType?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  assignedToName?: string;

  @IsOptional()
  @IsString()
  folderId?: string;

  @IsOptional()
  @IsString()
  documentId?: string;

  @IsOptional()
  @IsString()
  targetFolderId?: string;

  @IsOptional()
  @IsString()
  requiredFileType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  requestDetails?: string;

  @IsOptional()
  @IsBoolean()
  isCrossCompany?: boolean;

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
  @IsDateString()
  dueDate?: string;
}

export class UpdateActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsIn(['regular', 'document_upload', 'request_response'])
  type?: string;

  @IsOptional()
  @IsIn(ACTION_STATUSES)
  status?: string;

  @IsOptional()
  @IsObject()
  assignedTo?: { type: string; id: string; name: string };

  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @IsOptional()
  @IsString()
  completedBy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  resolutionNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  response?: string;

  @IsOptional()
  @IsObject()
  responseData?: Record<string, any>;

  @IsOptional()
  @IsDateString()
  responseReceivedAt?: string;

  @IsOptional()
  @IsString()
  respondedBy?: string;

  @IsOptional()
  @IsString()
  uploadedDocumentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  uploadedDocumentName?: string;

  @IsOptional()
  @IsDateString()
  uploadedAt?: string;

  @IsOptional()
  @IsString()
  uploadedBy?: string;

  @IsOptional()
  @IsString()
  referencedFileId?: string;

  @IsOptional()
  @IsString()
  saveToFolderId?: string;
}
