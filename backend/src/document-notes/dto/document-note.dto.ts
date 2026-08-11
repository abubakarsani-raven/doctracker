import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDocumentNoteDto {
  @IsString()
  @MaxLength(10000)
  content: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class UpdateDocumentNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  content?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
