import type { NextConfig } from "next";

/**
 * Same-origin API proxy for production (Vercel → Railway).
 *
 * Safari ITP blocks third-party cookies when the browser talks to Railway
 * directly from a Vercel origin. Pointing NEXT_PUBLIC_API_URL at
 * `/api-backend` and rewriting to BACKEND_URL makes Set-Cookie bind to the
 * Vercel host (first-party).
 *
 * Locally NEXT_PUBLIC_API_URL stays an absolute localhost URL, so rewrites
 * are skipped.
 */
const nextConfig: NextConfig = {
  async rewrites() {
    const backend =
      process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "";
    if (!backend || backend.startsWith("/")) {
      return [];
    }
    const destination = `${backend.replace(/\/$/, "")}/:path*`;
    return [
      {
        source: "/api-backend/:path*",
        destination,
      },
    ];
  },
};

export default nextConfig;
