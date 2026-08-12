"use client";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface BulkOperationsProps {
  selectedItems: string[];
  onSelectionChange: (items: string[]) => void;
  items: Array<{ id: string; name: string; type: "file" | "folder" }>;
}

/** Gated until bulk APIs are wired — selection chrome only, no fake actions. */
export function BulkOperations({
  selectedItems,
  onSelectionChange,
  items,
}: BulkOperationsProps) {
  if (selectedItems.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 p-4">
      <span className="text-sm font-medium">
        {selectedItems.length} of {items.length} selected
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSelectionChange([])}
        >
          Clear selection
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            toast.message("Coming soon", {
              description:
                "Bulk permissions, export, archive, and delete are not available yet.",
            })
          }
        >
          Bulk actions (coming soon)
        </Button>
      </div>
    </div>
  );
}
