import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { PermissionsService } from '../permissions/permissions.service';
import { ActivityService } from '../activity/activity.service';
import { EmailService } from '../notifications/email.service';

/** Same generic reply whether or not the account exists (anti-enumeration). */
const FORGOT_PASSWORD_MESSAGE =
  'If an account with that email exists, a password reset link has been sent.';

/** Refresh lifetime when "Remember me" is off (browser session safety net). */
export const SESSION_REFRESH_MS = 12 * 60 * 60 * 1000; // 12 hours
/** Refresh lifetime when "Remember me" is on. */
export const REMEMBER_REFRESH_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const ACCESS_TOKEN_MS = 15 * 60 * 1000; // 15 minutes

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private permissionsService: PermissionsService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
    private activityService: ActivityService,
    private emailService: EmailService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmailForAuth(email);

    if (!user) {
      this.logger.warn(`User not found: ${email}`);
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      this.logger.warn(`Invalid password for user: ${email}`);
      return null;
    }

    if (user.status === 'inactive') {
      this.logger.warn(`Deactivated account attempted login: ${email}`);
      throw new UnauthorizedException('This account has been deactivated.');
    }

    const { passwordHash, ...result } = user;
    return result;
  }

  async login(email: string, password: string, rememberMe = false) {
    const user = await this.validateUser(email, password);

    if (!user) {
      this.logger.warn(`Login failed for: ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const permissions = this.permissionsService.buildEffectivePermissions(user);

    // Create short-lived access token (15 minutes)
    const accessToken = this.jwtService.sign(
      {
        email: user.email,
        sub: user.id,
      },
      { expiresIn: '15m' }
    );

    const refreshTtlMs = rememberMe ? REMEMBER_REFRESH_MS : SESSION_REFRESH_MS;
    const refreshToken = this.generateRefreshToken();
    const refreshTokenHash = this.hashRefreshToken(refreshToken);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: new Date(Date.now() + refreshTtlMs),
        rememberMe,
      },
    });

    // Generate CSRF token
    const csrfToken = this.generateCSRFToken();

    this.logger.log(
      `Login successful for: ${email} (role: ${permissions.role}, rememberMe: ${rememberMe})`,
    );

    // Record login activity
    try {
      await this.activityService.createActivity({
        userId: user.id,
        companyId: user.companyId,
        activityType: 'login',
        description: `User logged in`,
      });
    } catch (error) {
      this.logger.error(`Failed to record login activity for user ${user.id}:`, error);
      // Don't fail login if activity recording fails
    }

    return {
      access_token: accessToken, // Keep for backward compatibility temporarily
      refresh_token: refreshToken,
      csrfToken,
      rememberMe,
      user: this.toSessionUser(user, permissions),
    };
  }

  /** The shape the frontend stores as the current session. */
  toSessionUser(user: any, permissions: any) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar ?? null,
      status: user.status,
      companyId: user.companyId ?? null,
      company: user.company ?? null,
      role: permissions.role,
      roles: permissions.roles,
      department: user.department ?? null,
      departments: user.departments ?? [],
      departmentIds: permissions.departmentIds,
      division: user.division ?? null,
      divisions: user.divisions ?? [],
      divisionIds: permissions.divisionIds,
      permissions,
    };
  }

  /**
   * Generate a cryptographically secure refresh token
   */
  private generateRefreshToken(): string {
    return crypto.randomBytes(48).toString('base64url');
  }

  /**
   * Generate a CSRF token
   */
  private generateCSRFToken(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Hash a refresh token for secure storage
   */
  private hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Refresh access token using a valid refresh token
   */
  async refresh(refreshToken: string) {
    const tokenHash = this.hashRefreshToken(refreshToken);
    
    let storedToken;
    try {
      storedToken = await this.prisma.refreshToken.findFirst({
        where: {
          tokenHash,
          revokedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
        include: {
          user: {
            include: {
              company: true,
              userRoles: { include: { role: true } },
              userDepartments: true,
              userDivisions: true,
            },
          },
        },
      });
    } catch (error) {
      this.logger.error('Failed to look up refresh token', error as Error);
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!storedToken || storedToken.user.status !== 'active') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Rebuild the same shape login uses so capabilities stay correct
    const user = await this.usersService.findOne(storedToken.userId);
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const permissions = this.permissionsService.buildEffectivePermissions(user);

    // Create new access token
    const accessToken = this.jwtService.sign(
      {
        email: user.email,
        sub: user.id,
      },
      { expiresIn: '15m' }
    );

    // Rotate refresh token - revoke old and create new (keep remember-me preference)
    const rememberMe = Boolean(storedToken.rememberMe);
    const refreshTtlMs = rememberMe ? REMEMBER_REFRESH_MS : SESSION_REFRESH_MS;
    const newRefreshToken = this.generateRefreshToken();
    const newTokenHash = this.hashRefreshToken(newRefreshToken);

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: newTokenHash,
        expiresAt: new Date(Date.now() + refreshTtlMs),
        rememberMe,
      },
    });

    // Generate new CSRF token
    const csrfToken = this.generateCSRFToken();

    this.logger.log(`Token refreshed for user: ${user.email}`);

    return {
      access_token: accessToken,
      refresh_token: newRefreshToken,
      csrfToken,
      rememberMe,
      user: this.toSessionUser(user, permissions),
    };
  }

  /**
   * Revoke a refresh token (logout)
   */
  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const tokenHash = this.hashRefreshToken(refreshToken);
    
    try {
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { revokedAt: new Date() },
      });
    } catch (error) {
      // Fallback if RefreshToken model doesn't exist yet
      await (this.prisma as any).refreshToken.updateMany({
        where: { tokenHash },
        data: { revokedAt: new Date() },
      });
    }
  }

  /**
   * Revoke all refresh tokens for a user (global logout)
   */
  async revokeAllRefreshTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Start password reset. Always returns the same message so callers cannot
   * probe which emails exist. Creates a one-hour single-use token when the
   * account is eligible.
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const normalised = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        email: { equals: normalised, mode: 'insensitive' },
      },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
      },
    });

    // Inactive accounts get no email — still the same public response.
    if (user && user.status !== 'inactive') {
      // Invalidate previous unused tokens for this user.
      await this.prisma.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });

      const rawToken = crypto.randomBytes(32).toString('base64url');
      const tokenHash = this.hashRefreshToken(rawToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') ||
        'http://localhost:3001';
      const resetUrl = `${frontendUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(rawToken)}`;

      try {
        if (this.emailService.isConfigured()) {
          await this.emailService.sendPasswordResetEmail(
            user.email,
            resetUrl,
            user.name || undefined,
          );
        } else {
          // Local/dev without SMTP: surface the link in logs so reset still works.
          this.logger.warn(
            `SMTP not configured — password reset link for ${user.email}: ${resetUrl}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to send password reset email to ${user.email}`,
          error as Error,
        );
        // Still return the generic success message; do not leak delivery failure.
      }
    } else if (!user) {
      this.logger.debug(`Password reset requested for unknown email`);
    } else {
      this.logger.debug(
        `Password reset skipped for inactive account: ${normalised}`,
      );
    }

    return { message: FORGOT_PASSWORD_MESSAGE };
  }

  /**
   * Complete password reset with a valid single-use token.
   */
  async resetPassword(
    rawToken: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    if (!rawToken || !newPassword || newPassword.length < 8) {
      throw new BadRequestException(
        'Password must be at least 8 characters.',
      );
    }

    const tokenHash = this.hashRefreshToken(rawToken);
    const stored = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          select: { id: true, email: true, status: true },
        },
      },
    });

    if (!stored || !stored.user) {
      throw new BadRequestException(
        'This reset link is invalid or has expired. Request a new one.',
      );
    }

    if (stored.user.status === 'inactive') {
      throw new BadRequestException(
        'This account has been deactivated. Contact an administrator.',
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: stored.user.id },
        data: {
          passwordHash,
          // Invited users set their password via this flow.
          status:
            stored.user.status === 'invited' ? 'active' : stored.user.status,
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      }),
      // Burn any other outstanding reset tokens for this user.
      this.prisma.passwordResetToken.updateMany({
        where: {
          userId: stored.user.id,
          usedAt: null,
          id: { not: stored.id },
        },
        data: { usedAt: new Date() },
      }),
    ]);

    await this.revokeAllRefreshTokens(stored.user.id);

    this.logger.log(`Password reset completed for ${stored.user.email}`);

    try {
      await this.activityService.createActivity({
        userId: stored.user.id,
        activityType: 'password_reset',
        description: 'Password was reset via email link',
      });
    } catch {
      // Non-fatal
    }

    return { message: 'Password updated. You can sign in with your new password.' };
  }
}
