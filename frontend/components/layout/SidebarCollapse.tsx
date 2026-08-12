"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export const SIDEBAR_STORAGE_KEY = "dt_sidebar_collapsed";
export const SIDEBAR_COOKIE_KEY = "dt_sidebar_collapsed";

type SidebarCollapseContextValue = {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  toggle: () => void;
  ready: boolean;
};

const SidebarCollapseContext =
  createContext<SidebarCollapseContextValue | null>(null);

function readCookieCollapsed(): boolean | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${SIDEBAR_COOKIE_KEY}=([^;]*)`),
  );
  if (!match) return null;
  return match[1] === "1" || match[1] === "true";
}

function readStoredCollapsed(): boolean {
  if (typeof document !== "undefined") {
    const fromDom = document.documentElement.dataset.sidebar;
    if (fromDom === "collapsed") return true;
    if (fromDom === "expanded") return false;
  }
  const fromCookie = readCookieCollapsed();
  if (fromCookie !== null) return fromCookie;
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/** Keep html[data-sidebar] + cookie + localStorage in sync (font-scale pattern). */
export function applySidebarCollapsed(collapsed: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.sidebar = collapsed
    ? "collapsed"
    : "expanded";
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
  } catch {
    // ignore
  }
  try {
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `${SIDEBAR_COOKIE_KEY}=${collapsed ? "1" : "0"};path=/;max-age=${maxAge};SameSite=Lax`;
  } catch {
    // ignore
  }
}

export function SidebarCollapseProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const next = readStoredCollapsed();
    setCollapsedState(next);
    applySidebarCollapsed(next);
    setReady(true);
  }, []);

  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next);
    applySidebarCollapsed(next);
  }, []);

  const toggle = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      applySidebarCollapsed(next);
      return next;
    });
  }, []);

  return (
    <SidebarCollapseContext.Provider
      value={{ collapsed, setCollapsed, toggle, ready }}
    >
      {children}
    </SidebarCollapseContext.Provider>
  );
}

export function useSidebarCollapse() {
  const ctx = useContext(SidebarCollapseContext);
  if (!ctx) {
    return {
      collapsed: false,
      setCollapsed: () => {},
      toggle: () => {},
      ready: true,
    };
  }
  return ctx;
}
