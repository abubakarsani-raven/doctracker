import {
  Injectable,
  NestMiddleware,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class CSRFMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CSRFMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    // Skip CSRF protection for non-mutating methods
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return next();
    }

    // Skip CSRF for credential bootstrap endpoints (no session cookie yet)
    const skipPaths = [
      '/auth/login',
      '/auth/refresh',
      '/auth/forgot-password',
      '/auth/reset-password',
    ];
    if (skipPaths.some((path) => req.path === path || req.path.endsWith(path))) {
      return next();
    }

    // Cookie-session CSRF (double-submit). Bearer-only API clients are exempt
    // because they do not automatically attach cookies from a browser context.
    const authHeader = req.headers.authorization;
    const hasBearer =
      typeof authHeader === 'string' &&
      authHeader.toLowerCase().startsWith('bearer ') &&
      authHeader.length > 7;
    const hasAccessCookie = Boolean(req.cookies?.dt_access);

    if (hasBearer && !hasAccessCookie) {
      return next();
    }

    // Get CSRF token from header and cookie
    const headerToken = req.headers['x-csrf-token'] as string;
    const cookieToken = req.cookies?.dt_csrf;

    if (!headerToken || !cookieToken) {
      this.logger.warn(`CSRF token missing: header=${!!headerToken}, cookie=${!!cookieToken}, path=${req.path}`);
      throw new ForbiddenException('CSRF token missing');
    }

    if (headerToken !== cookieToken) {
      this.logger.warn(`CSRF token mismatch for path: ${req.path}`);
      throw new ForbiddenException('CSRF token mismatch');
    }

    next();
  }
}