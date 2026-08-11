import { ArrayMaxSize, IsArray, IsString, MaxLength } from 'class-validator';

export class CreateTagDto {
  @IsString()
  @MaxLength(100)
  name: string;
}

export class SetDocumentTagsDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  tagIds: string[];
}
