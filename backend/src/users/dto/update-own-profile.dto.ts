import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * What a user may change about themselves.
 *
 * Deliberately narrower than `UpdateUserDto`: role, status and department
 * membership are decided by someone holding `users.manage`, never by the
 * account holder. Keeping them out of this shape means the self-service
 * endpoint cannot be used to escalate.
 */
export class UpdateOwnProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;
}
