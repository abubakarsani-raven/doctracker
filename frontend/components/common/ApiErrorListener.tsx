"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import {
  onAuthFailure,
  clearClientSession,
  type ApiError,
} from "@/lib/api-client";

const AUTH_PAGES = ["/login", "/register", "/forgot-password"];

/**
 * Turns permission failures from the API into something the user can see.
 *
 * Without this a 403 was swallowed by whichever component made the call, and
 * the action simply appeared to do nothing. Mounted once, at the dashboard
 * layout level.
 *
 * A 401 after refresh has failed means the session is dead — hard-redirect to
 * login so stale React Query cache cannot keep the dashboard looking signed-in.
 */
export function ApiErrorListener() {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    let lastForbiddenMessage = "";
    let lastForbiddenAt = 0;
    let redirecting = false;

    const handler = (error: ApiError) => {
      if (error.isUnauthorized) {
        const path = pathnameRef.current || "";
        if (AUTH_PAGES.some((p) => path.startsWith(p))) return;
        if (redirecting) return;
        redirecting = true;

        clearClientSession();
        toast.error("Your session has expired. Please sign in again.");

        // Hard navigation clears in-memory cache and stops further dashboard
        // requests. Soft router.push left the page mounted with stale data.
        const next = `/login?next=${encodeURIComponent(path || "/dashboard")}`;
        window.location.assign(next);
        return;
      }

      // Collapse parallel 403s into one toast.
      const now = Date.now();
      if (error.message === lastForbiddenMessage && now - lastForbiddenAt < 3000) {
        return;
      }
      lastForbiddenMessage = error.message;
      lastForbiddenAt = now;

      toast.error("You do not have permission to do that", {
        description: error.message,
      });
    };

    onAuthFailure(handler);
    return () => onAuthFailure(null);
  }, []);

  return null;
}
