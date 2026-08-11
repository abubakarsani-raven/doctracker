"use client";

import { DashboardLayout } from "@/components/layout";
import { ApiErrorListener } from "@/components/common/ApiErrorListener";
import { SessionKeepAlive } from "@/components/common/SessionKeepAlive";
import { useRealtime } from "@/lib/hooks/use-realtime";

export default function DashboardLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  // Initialize WebSocket connection
  useRealtime();

  return (
    <DashboardLayout>
      {/* Surfaces 401/403 responses as toasts instead of silent no-ops. */}
      <ApiErrorListener />
      {/* Renew the access cookie while the user is still active. */}
      <SessionKeepAlive />
      {children}
    </DashboardLayout>
  );
}
