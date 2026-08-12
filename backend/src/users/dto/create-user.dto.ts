import { IsEmail, IsString, IsOptional, IsArray, MinLength, IsBoolean } from 'class-validator';

export class CreateUserDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsString()
  @MinLength(1, { message: 'Name is required' })
  name: string;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password?: string;

  @IsOptional()
  @IsString()
  roleId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  departmentIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  divisionIds?: string[];

  @IsOptional()
  @IsString()
  status?: string;

  /** Target company when the caller is Master (no home company). */
  @IsOptional()
  @IsString()
  companyId?: string;
}

export class InviteUserDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsString()
  @MinLength(1, { message: 'Name is required' })
  name: string;

  @IsOptional()
  @IsString()
  roleId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  departmentIds?: string[];

  /** Target company when the caller is Master (no home company). */
  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;
}