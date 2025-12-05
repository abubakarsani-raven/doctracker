"use client";

import { DashboardLayout } from "@/components/layout";

export default function DashboardLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  // Allow navigation without auth for testing with mock data
  // TODO: Add proper auth check when backend is ready
  return <DashboardLayout>{children}</DashboardLayout>;
}
