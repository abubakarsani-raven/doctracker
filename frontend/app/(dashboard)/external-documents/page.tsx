"use client";

import { EmptyState } from "@/components/common";
import { FileText } from "lucide-react";

export default function ExternalDocumentsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">External Documents</h1>
        <p className="text-muted-foreground">
          Manage documents received from external parties
        </p>
      </div>

      {/* Coming Soon State */}
      <EmptyState
        icon={FileText}
        title="External Documents"
        description="External document management is coming soon. This feature will allow you to track and manage documents received from external parties."
      />
    </div>
  );
}
