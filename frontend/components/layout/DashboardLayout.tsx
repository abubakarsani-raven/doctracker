"use client";

import { ReactNode } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <Sidebar className="hidden md:flex" />
        <MobileNav className="md:hidden" />
        <main className="flex-1 p-4 md:p-6 lg:p-8 md:ml-64">
          {children}
        </main>
      </div>
    </div>
  );
}
