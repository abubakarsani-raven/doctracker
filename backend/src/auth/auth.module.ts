import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ThrottlerBehindProxyGuard } from './guards/throttler-behind-proxy.guard';
import { UsersModule } from '../users/users.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { ActivityModule } from '../activity/activity.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { THROTTLERS } from './throttle-config';

@Module({
  imports: [
    UsersModule,
    PermissionsModule,
    ActivityModule,
    NotificationsModule,
    PassportModule,
    // Buckets are keyed by real client IP (not the Railway/proxy hop), and
    // credential endpoints additionally by account — see throttle-config.ts.
    // Requires `trust proxy` in main.ts so Express fills req.ip / req.ips.
    ThrottlerModule.forRoot({ throttlers: THROTTLERS }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          // A hard-coded fallback would mean anyone could mint valid tokens
          // against a misconfigured deployment, so refuse to boot.
          throw new Error(
            'JWT_SECRET is not set. Copy backend/.env.example to backend/.env and set it.',
          );
        }

        return {
          secret,
          signOptions: {
            expiresIn: (configService.get<string>('JWT_EXPIRES_IN') ||
              '15m') as any,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    {
      provide: APP_GUARD,
      useClass: ThrottlerBehindProxyGuard,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
