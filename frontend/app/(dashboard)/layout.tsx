"use client";

import { DashboardLayout } from "@/components/layout";
import { useRealtime } from "@/lib/hooks/use-realtime";

export default function DashboardLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  // Initialize WebSocket connection
  useRealtime();

  // Allow navigation without auth for testing with mock data
  // TODO: Add proper auth check when backend is ready
  return <DashboardLayout>{children}</DashboardLayout>;
}
