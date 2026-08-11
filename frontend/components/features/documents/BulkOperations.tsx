"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface BulkOperationsProps {
  selectedItems: string[];
  onSelectionChange: (items: string[]) => void;
  items: Array<{ id: string; name: string; type: "file" | "folder" }>;
}

export function BulkOperations({
  selectedItems,
  onSelectionChange,
  items,
}: BulkOperationsProps) {
  const [bulkAction, setBulkAction] = useState<string | null>(null);

  const handleSelectAll = () => {
    if (selectedItems.length === items.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(items.map((item) => item.id));
    }
  };

  const handleBulkAction = () => {
    // Bulk operations endpoints are not wired yet — do not fake success.
    toast.error("This action is not available yet");
  };

  if (selectedItems.length === 0) {
    return (
      <div className="flex items-center justify-between p-4 border-b">
        <span className="text-sm text-muted-foreground">
          {items.length} items
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSelectAll}
        >
          Select All
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between p-4 border-b bg-primary/5">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">
            {selectedItems.length} selected
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSelectionChange([])}
          >
            Clear Selection
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={bulkAction || ""}
            onValueChange={setBulkAction}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Bulk Actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="permissions">Change Permissions</SelectItem>
              <SelectItem value="assign">Assign</SelectItem>
              <SelectItem value="export">Export</SelectItem>
              <SelectItem value="archive">Archive</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={() => bulkAction && handleBulkAction()}
            disabled={!bulkAction}
          >
            Apply
          </Button>
        </div>
      </div>
    </>
  );
}
