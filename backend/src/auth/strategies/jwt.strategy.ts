import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { UsersService } from '../../users/users.service';
import { PermissionsService } from '../../permissions/permissions.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
    private permissionsService: PermissionsService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      // Falling back to a default here would silently accept tokens signed with
      // a well-known key, so refuse to start instead.
      throw new Error(
        'JWT_SECRET is not set. Copy backend/.env.example to backend/.env and set it.',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // Try cookie first (dt_access), then fall back to Bearer header
        (request: Request) => {
          const token = request?.cookies?.dt_access;
          return token || null;
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    const user = await this.usersService.findOne(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }

    if (user.status === 'inactive') {
      throw new UnauthorizedException('This account has been deactivated.');
    }

    // Resolve permissions from the database on every request rather than
    // trusting the token, so a role change takes effect immediately instead of
    // waiting for the old JWT to expire.
    const permissions = this.permissionsService.buildEffectivePermissions(user);

    return {
      ...user,
      role: permissions.role,
      permissions,
    };
  }
}
