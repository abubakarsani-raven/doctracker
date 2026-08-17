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
 *  - after meaningful user activity
 *
 * Every trigger goes through one throttle, so window-focus churn cannot fan out
 * into a request per focus. And when refresh is failing — a misconfigured
 * cookie domain will fail every single time, not transiently — we back off
 * exponentially instead of hammering the endpoint for the whole session.
 *
 * Cookie refresh failures are soft when a Bearer token still exists (Safari
 * often drops cross-site cookies; SameSite=Lax via /api-backend is preferred).
 */
const INTERVAL_MS = 10 * 60 * 1000;
/** Floor between refreshes while they are succeeding, whatever triggered them. */
const MIN_GAP_MS = 5 * 60 * 1000;
/** Wait after the first failure; doubles per consecutive failure. */
const FAILURE_BASE_MS = 60 * 1000;
/** Ceiling for the backoff — a broken cookie config settles here. */
const MAX_BACKOFF_MS = 30 * 60 * 1000;

export function SessionKeepAlive() {
  const lastAttempt = useRef(0);
  const failures = useRef(0);
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;

    /** How long we must wait before the next attempt is worth making. */
    const currentGap = () => {
      if (failures.current === 0) return MIN_GAP_MS;
      // 1m → 2m → 4m … so a transient blip recovers fast but a permanently
      // broken refresh stops generating a request per window focus.
      return Math.min(
        FAILURE_BASE_MS * 2 ** (failures.current - 1),
        MAX_BACKOFF_MS,
      );
    };

    const refreshQuietly = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      if (inFlight.current) return;
      const now = Date.now();
      if (now - lastAttempt.current < currentGap()) return;

      lastAttempt.current = now;
      inFlight.current = true;
      try {
        await api.refreshSession();
        failures.current = 0;
      } catch {
        // Soft failure — ApiErrorListener only hard-logs-out when Bearer is gone.
        failures.current += 1;
      } finally {
        inFlight.current = false;
      }
    };

    const intervalId = window.setInterval(refreshQuietly, INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshQuietly();
      }
    };

    const onActivity = () => {
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
