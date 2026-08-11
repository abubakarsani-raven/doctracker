"use client";

import { EmptyState } from "@/components/common";
import { BarChart3 } from "lucide-react";

export default function AdminReportsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
        <p className="text-muted-foreground">
          Generate detailed reports and insights
        </p>
      </div>

      {/* Coming Soon State */}
      <EmptyState
        icon={BarChart3}
        title="Reports & Analytics"
        description="Advanced reporting features are coming soon. This will include document usage analytics, user activity reports, workflow performance metrics, and more."
      />
    </div>
  );
}