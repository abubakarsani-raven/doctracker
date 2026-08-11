import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { resolveClientIp } from '../../common/client-ip';

/**
 * Rate-limit by the originating client IP, not the load balancer / Railway proxy.
 */
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return resolveClientIp(req);
  }
}
