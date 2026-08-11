import { ExecutionContext } from '@nestjs/common';
import { ThrottlerOptions } from '@nestjs/throttler';
import { resolveClientIp } from '../common/client-ip';

/**
 * Rate limiting.
 *
 * The important detail is what each bucket is keyed by. Keying credential
 * endpoints on IP alone means one office behind a single NAT shares one
 * allowance: ten sign-ins in a minute and the eleventh colleague is locked out,
 * having done nothing wrong. So the credential bucket is keyed by
 * **account + IP**, and a second, looser IP-only bucket sits behind it to stop
 * one host spraying attempts across many accounts.
 */

/** Endpoints where a wrong answer is worth guessing at. */
const CREDENTIAL_PATHS = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
]);

function requestOf(context: ExecutionContext): Record<string, any> {
  return context.switchToHttp().getRequest();
}

function isCredentialRequest(context: ExecutionContext): boolean {
  const req = requestOf(context);
  // `path` excludes the query string; fall back to url for safety.
  const path = (req?.path ?? req?.url ?? '').split('?')[0];
  return CREDENTIAL_PATHS.has(path);
}

/**
 * Identify the account being attempted, so one person's mistyped password does
 * not consume their colleagues' allowance. Falls back to the IP alone when the
 * body carries no identifier (e.g. a token-only reset).
 */
function credentialTracker(req: Record<string, any>): string {
  const ip = resolveClientIp(req);
  const email = req?.body?.email;

  if (typeof email !== 'string' || !email.trim()) {
    return `ip:${ip}`;
  }

  return `ip:${ip}|account:${email.trim().toLowerCase()}`;
}

export const THROTTLERS: ThrottlerOptions[] = [
  {
    // A ceiling for the API as a whole, per client IP. Generous: one dashboard
    // page load fans out into a dozen requests, and a whole office can share an
    // IP, so this only catches a runaway client.
    name: 'default',
    ttl: 60_000,
    limit: 600,
    getTracker: (req) => resolveClientIp(req),
  },
  {
    // Guessing at one account's password. Ten a minute is plenty for a person
    // who has genuinely forgotten it; a five-minute lockout follows.
    name: 'credentials',
    ttl: 60_000,
    limit: 10,
    blockDuration: 5 * 60_000,
    skipIf: (context) => !isCredentialRequest(context),
    getTracker: credentialTracker,
  },
  {
    // Backstop against spraying: many accounts, few guesses each, one host.
    // Well above what an office of people signing in would ever produce.
    name: 'credential-burst',
    ttl: 60_000,
    limit: 100,
    skipIf: (context) => !isCredentialRequest(context),
    getTracker: (req) => resolveClientIp(req),
  },
];
