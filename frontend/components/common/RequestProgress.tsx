"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

/**
 * Thin top bar for in-flight navigations and React Query work.
 * Covers the gap where client pages otherwise give no feedback while a
 * route change or save is still running.
 */
function RequestProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [navigating, setNavigating] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetching = useIsFetching({
    // Only first-load waits — warm-cache refetches stay silent.
    predicate: (query) =>
      query.state.fetchStatus === "fetching" && query.state.status === "pending",
  });
  const mutating = useIsMutating();
  const networkBusy = fetching > 0 || mutating > 0;

  // Queries are already in flight when React hydrates, but none were running
  // during the server render — so `active` differed between the two and React
  // reported a hydration mismatch. Stay inert until after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const active = mounted && (navigating || networkBusy);

  // Any same-origin link click starts the nav indicator; the route effect clears it.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (
          url.pathname === window.location.pathname &&
          url.search === window.location.search
        ) {
          return;
        }
      } catch {
        return;
      }

      setNavigating(true);
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    // Brief delay so a fast transition still flashes the bar.
    hideTimer.current = setTimeout(() => setNavigating(false), 180);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [pathname, searchParams]);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-100 h-0.5 overflow-hidden"
      aria-hidden={!active}
      role="presentation"
    >
      <div
        className={cn(
          "h-full origin-left bg-scope-company transition-[transform,opacity] duration-300 ease-out",
          active
            ? "animate-request-progress opacity-100"
            : "scale-x-0 opacity-0",
        )}
      />
      <span className="sr-only" aria-live="polite">
        {active ? "Loading" : ""}
      </span>
    </div>
  );
}

export function RequestProgress() {
  return (
    <Suspense fallback={null}>
      <RequestProgressInner />
    </Suspense>
  );
}
