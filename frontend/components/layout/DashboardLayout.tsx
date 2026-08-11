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
  const { collapsed } = useSidebarCollapse();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <Sidebar className="hidden md:flex" />
        <main
          className={cn(
            "flex-1 p-4 transition-[margin] duration-200 ease-out md:p-6 lg:p-8",
            collapsed ? "md:ml-16" : "md:ml-64",
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
