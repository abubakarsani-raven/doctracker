import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsString()
  @MinLength(1, { message: 'Password is required' })
  password: string;

  /** Keep the session across browser restarts when true. */
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}