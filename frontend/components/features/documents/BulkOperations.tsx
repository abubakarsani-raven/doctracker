"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckSquare, Square, MoreVertical } from "lucide-react";

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
  const [performingAction, setPerformingAction] = useState(false);

  const handleSelectAll = () => {
    if (selectedItems.length === items.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(items.map((item) => item.id));
    }
  };

  const handleToggleItem = (itemId: string) => {
    if (selectedItems.includes(itemId)) {
      onSelectionChange(selectedItems.filter((id) => id !== itemId));
    } else {
      onSelectionChange([...selectedItems, itemId]);
    }
  };

  const handleBulkAction = async (action: string) => {
    setPerformingAction(true);
    try {
      // TODO: Replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success(`${action} completed for ${selectedItems.length} items`);
      onSelectionChange([]);
      setBulkAction(null);
    } catch (error) {
      toast.error(`Failed to ${action.toLowerCase()} items`);
    } finally {
      setPerformingAction(false);
    }
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
            onClick={() => bulkAction && handleBulkAction(bulkAction)}
            disabled={!bulkAction || performingAction}
          >
            Apply
          </Button>
        </div>
      </div>
    </>
  );
}
