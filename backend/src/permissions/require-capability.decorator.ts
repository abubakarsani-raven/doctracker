import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Capability, EffectivePermissions } from './capabilities';

export const REQUIRED_CAPABILITIES_KEY = 'requiredCapabilities';

/**
 * Declare which capabilities a route needs. The user must hold *all* of them.
 *
 *   @RequireCapability('users.manage')
 *   @UseGuards(JwtAuthGuard, CapabilityGuard)
 *   async updateUser() { ... }
 *
 * This gates the *kind* of action. Access to a specific folder or file is a
 * separate question — use `PermissionsService.assertPermission` for that.
 */
export const RequireCapability = (...capabilities: Capability[]) =>
  SetMetadata(REQUIRED_CAPABILITIES_KEY, capabilities);

@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Capability[]>(
      REQUIRED_CAPABILITIES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as
      | { permissions?: EffectivePermissions }
      | undefined;

    if (!user) {
      throw new UnauthorizedException();
    }

    const held = user.permissions?.capabilities ?? [];
    const missing = required.filter((capability) => !held.includes(capability));

    if (missing.length > 0) {
      throw new ForbiddenException(
        `Your role does not allow this action (missing: ${missing.join(', ')}).`,
      );
    }

    return true;
  }
}
