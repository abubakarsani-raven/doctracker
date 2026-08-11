import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CreateDivisionDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class CreateDepartmentDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDivisionDto)
  divisions?: CreateDivisionDto[];
}

export class CreateCompanyDto {
  @IsString()
  @MaxLength(300)
  name: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDepartmentDto)
  departments?: CreateDepartmentDto[];
}

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  name?: string;
}
