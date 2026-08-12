"use client";

import { useEffect, useRef } from "react";
import { api } from "@/lib/api";

/**
 * Keeps the short-lived access cookie fresh while the user is still in the app.
 *
 * Access tokens expire after 15 minutes. Without a background refresh, a user
 * who spends that long on one screen (signing, reading, drafting) gets bounced
 * to login on the next click. We refresh:
 *  - every 10 minutes while the tab is visible
 *  - when the tab becomes visible again
 *  - after meaningful user activity (throttled to once per 5 minutes)
 *
 * Cookie refresh failures are soft when a Bearer token still exists (Safari
 * often drops cross-site cookies; SameSite=Lax via /api-backend is preferred).
 */
const INTERVAL_MS = 10 * 60 * 1000;
const ACTIVITY_THROTTLE_MS = 5 * 60 * 1000;

export function SessionKeepAlive() {
  const lastActivityRefresh = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const refreshQuietly = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        await api.refreshSession();
      } catch {
        // Soft failure — ApiErrorListener only hard-logs-out when Bearer is gone.
      }
    };

    const intervalId = window.setInterval(refreshQuietly, INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshQuietly();
      }
    };

    const onActivity = () => {
      const now = Date.now();
      if (now - lastActivityRefresh.current < ACTIVITY_THROTTLE_MS) return;
      lastActivityRefresh.current = now;
      void refreshQuietly();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointerdown", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity, { passive: true });

    // Prime once shortly after mount so a long first screen still stays warm.
    const bootId = window.setTimeout(refreshQuietly, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.clearTimeout(bootId);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
    };
  }, []);

  return null;
}
