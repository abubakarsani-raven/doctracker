import { IsString, IsOptional, IsArray, IsEnum } from 'class-validator';

export class CreateFileDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  folderId: string;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(['public', 'private', 'restricted'])
  visibility?: 'public' | 'private' | 'restricted';

  @IsOptional()
  @IsString()
  externalUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}