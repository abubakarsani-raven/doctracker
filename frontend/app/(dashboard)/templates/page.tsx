"use client";

import { EmptyState } from "@/components/common";
import { FileText } from "lucide-react";

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
        <p className="text-muted-foreground">
          Create documents from predefined templates
        </p>
      </div>

      {/* Coming Soon State */}
      <EmptyState
        icon={FileText}
        title="Document Templates"
        description="Template management is coming soon. This feature will allow you to create and manage document templates for consistent document creation."
      />
    </div>
  );
}
