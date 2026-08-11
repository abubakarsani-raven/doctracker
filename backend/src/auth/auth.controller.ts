import {
  Controller,
  Get,
  Post,
  Body,
  Request,
  Response,
  UnauthorizedException,
  UseGuards,
  Logger,
  HttpException,
  ServiceUnavailableException,
  Res,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/password-reset.dto';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    try {
      const result = await this.authService.login(loginDto.email, loginDto.password);
      
      // Set cookie options
      const isProduction = this.configService.get('NODE_ENV') === 'production';
      const cookieOptions = {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' as const : 'lax' as const,
        path: '/',
      };

      // Set access token cookie (15 minutes)
      res.cookie('dt_access', result.access_token, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      // Set refresh token cookie (7 days)
      res.cookie('dt_refresh', result.refresh_token, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Set CSRF token cookie (not httpOnly so JS can read it)
      res.cookie('dt_csrf', result.csrfToken, {
        secure: isProduction,
        sameSite: isProduction ? 'none' as const : 'lax' as const,
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Return user and CSRF token (access_token included for backward compatibility)
      return {
        user: result.user,
        csrfToken: result.csrfToken,
        access_token: result.access_token, // Temporary backward compatibility
      };
    } catch (error) {
      // Deliberate responses (deactivated account, bad credentials) pass
      // through unchanged; only unexpected failures get flattened, so a
      // database outage is not reported to the user as "wrong password".
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        `Login errored for ${loginDto.email}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  /**
   * The current session, including resolved capabilities. The frontend calls
   * this on load so the UI is driven by the server's permission decision rather
   * than by its own copy of the role rules.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Request() req: any) {
    return this.authService.toSessionUser(req.user, req.user.permissions);
  }

  /**
   * Logout - clear cookies and revoke refresh token
   */
  @Post('logout')
  async logout(
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    try {
      // Revoke refresh token if present
      const refreshToken = req.cookies?.dt_refresh;
      if (refreshToken) {
        await this.authService.revokeRefreshToken(refreshToken);
      }
    } catch (error) {
      this.logger.warn('Error revoking refresh token during logout', error);
    }

    // Clear all auth cookies
    const cookieOptions = {
      path: '/',
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: this.configService.get('NODE_ENV') === 'production' ? 'none' as const : 'lax' as const,
    };

    res.clearCookie('dt_access', cookieOptions);
    res.clearCookie('dt_refresh', cookieOptions);
    res.clearCookie('dt_csrf', { ...cookieOptions, httpOnly: false });

    return { message: 'Logged out successfully' };
  }

  /**
   * Refresh access token using refresh token
   */
  @Post('refresh')
  async refresh(
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    const refreshToken = req.cookies?.dt_refresh;
    
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    try {
      const result = await this.authService.refresh(refreshToken);
      
      // Set cookie options
      const isProduction = this.configService.get('NODE_ENV') === 'production';
      const cookieOptions = {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' as const : 'lax' as const,
        path: '/',
      };

      // Set new access token cookie
      res.cookie('dt_access', result.access_token, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      // Set new refresh token cookie
      res.cookie('dt_refresh', result.refresh_token, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Set new CSRF token cookie
      res.cookie('dt_csrf', result.csrfToken, {
        secure: isProduction,
        sameSite: isProduction ? 'none' as const : 'lax' as const,
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return {
        user: result.user,
        csrfToken: result.csrfToken,
      };
    } catch (error) {
      this.logger.warn(`Token refresh failed: ${error.message}`);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Get current CSRF token
   */
  @Get('csrf')
  async getCSRFToken(@Req() req: ExpressRequest) {
    const csrfToken = req.cookies?.dt_csrf;
    
    if (!csrfToken) {
      throw new UnauthorizedException('CSRF token not found');
    }

    return { csrfToken };
  }

  /**
   * Password reset - create reset token and email a link
   */
  @Post('forgot-password')
  // Tighter than the shared credential bucket: a reset email is worth more to
  // an attacker than a password guess, and nobody needs five a minute.
  @Throttle({ credentials: { limit: 5, ttl: 60_000 } })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  /**
   * Password reset - set a new password with a valid token
   */
  @Post('reset-password')
  @Throttle({ credentials: { limit: 5, ttl: 60_000 } })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  /**
   * User registration - not available; accounts are invite-only.
   */
  @Post('register')
  @Throttle({ credentials: { limit: 3, ttl: 60_000 } })
  async register(@Body() dto: { email: string; password: string; name: string; companyName?: string }) {
    this.logger.log(`Registration attempted for: ${dto.email}`);
    throw new ServiceUnavailableException(
      'Self-registration is not available. Ask an administrator for an invite.',
    );
  }
}
