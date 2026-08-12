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
const SESSION_DRAFT_KEY = "dt_session_draft";

/**
 * Turns permission failures from the API into something the user can see.
 *
 * Without this a 403 was swallowed by whichever component made the call, and
 * the action simply appeared to do nothing. Mounted once, at the dashboard
 * layout level.
 *
 * A 401 after refresh has failed means the session is dead — hard-redirect to
 * login so stale React Query cache cannot keep the dashboard looking signed-in.
 * Before leaving, stash a lightweight draft marker so forms can restore context.
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

        try {
          sessionStorage.setItem(
            SESSION_DRAFT_KEY,
            JSON.stringify({
              path,
              at: Date.now(),
              note: "Session expired — reopen the action you were working on after signing in.",
            }),
          );
        } catch {
          // ignore quota / private mode
        }

        clearClientSession();
        toast.error("Your session has expired. Please sign in again.", {
          description: "We’ll bring you back to this page after you sign in.",
        });

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

  useEffect(() => {
    if (AUTH_PAGES.some((p) => (pathname || "").startsWith(p))) return;
    try {
      const raw = sessionStorage.getItem(SESSION_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as { note?: string; at?: number };
      sessionStorage.removeItem(SESSION_DRAFT_KEY);
      if (draft?.at && Date.now() - draft.at < 30 * 60 * 1000) {
        toast.message("Welcome back", {
          description:
            draft.note ||
            "Continue where you left off — reopen any dialog you were using.",
        });
      }
    } catch {
      // ignore
    }
  }, [pathname]);

  return null;
}
