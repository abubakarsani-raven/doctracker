/**
 * Resolve the real client IP when the app sits behind Railway / a reverse proxy.
 *
 * Express only populates `req.ips` / a meaningful `req.ip` when `trust proxy`
 * is enabled (see main.ts). Without that, every request shares the proxy's IP
 * and rate limits collapse into a single global bucket.
 */
export function resolveClientIp(req: Record<string, any>): string {
  // Express: leftmost entry in X-Forwarded-For when trust proxy is on
  if (Array.isArray(req.ips) && req.ips.length > 0) {
    return String(req.ips[0]);
  }

  if (typeof req.ip === 'string' && req.ip.length > 0) {
    return req.ip;
  }

  // Fallback if trust proxy is misconfigured — still better than one shared key
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return String(forwarded[0]).split(',')[0].trim();
  }

  const remote =
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    req.headers?.['x-real-ip'];

  return typeof remote === 'string' && remote.length > 0 ? remote : 'unknown';
}
