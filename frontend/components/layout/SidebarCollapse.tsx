"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "dt_sidebar_collapsed";

type SidebarCollapseContextValue = {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  toggle: () => void;
  ready: boolean;
};

const SidebarCollapseContext =
  createContext<SidebarCollapseContextValue | null>(null);

export function SidebarCollapseProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setCollapsedState(localStorage.getItem(STORAGE_KEY) === "true");
    } catch {
      // ignore
    }
    setReady(true);
  }, []);

  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // ignore
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
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
