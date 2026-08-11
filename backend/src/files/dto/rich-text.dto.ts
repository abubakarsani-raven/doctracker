import { IsString, IsOptional, IsObject } from 'class-validator';

export class RichTextContentDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  format?: 'html' | 'markdown' | 'plain';

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateRichTextDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  format?: 'html' | 'markdown' | 'plain';

  @IsOptional()
  @IsString()
  versionNotes?: string;
}