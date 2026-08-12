"use client";

import { ReactNode } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import {
  SidebarCollapseProvider,
  useSidebarCollapse,
} from "./SidebarCollapse";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
}

function DashboardShell({ children }: { children: ReactNode }) {
  const { collapsed, ready } = useSidebarCollapse();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <Sidebar className="dt-sidebar hidden md:flex" />
        <main
          className={cn(
            "dt-dashboard-main flex-1 p-4 transition-[margin] duration-200 ease-out md:p-6 lg:p-8",
            // Until bootstrap is applied in React, CSS [data-sidebar] owns the margin.
            // Once ready, keep the same classes so transition still works on toggle.
            ready
              ? collapsed
                ? "md:ml-16"
                : "md:ml-64"
              : "md:ml-[var(--dt-sidebar-offset)]",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarCollapseProvider>
      <DashboardShell>{children}</DashboardShell>
    </SidebarCollapseProvider>
  );
}
