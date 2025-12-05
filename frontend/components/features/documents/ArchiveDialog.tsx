"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Archive, ArchiveRestore } from "lucide-react";

interface ArchiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId?: string;
  folderId?: string;
  isRestore?: boolean;
}

export function ArchiveDialog({
  open,
  onOpenChange,
  documentId,
  folderId,
  isRestore = false,
}: ArchiveDialogProps) {
  const [reason, setReason] = useState("");
  const [archiving, setArchiving] = useState(false);

  const handleArchive = async () => {
    setArchiving(true);
    try {
      // TODO: Replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success(
        isRestore
          ? "Document restored successfully"
          : "Document archived successfully"
      );
      onOpenChange(false);
      setReason("");
    } catch (error) {
      toast.error(
        isRestore ? "Failed to restore document" : "Failed to archive document"
      );
    } finally {
      setArchiving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isRestore ? (
              <>
                <ArchiveRestore className="h-5 w-5" />
                Restore Document
              </>
            ) : (
              <>
                <Archive className="h-5 w-5" />
                Archive Document
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isRestore
              ? "Restore this document from archive?"
              : "Archive this document? It will be moved to the archive and hidden from normal view."}
          </DialogDescription>
        </DialogHeader>

        {!isRestore && (
          <div className="space-y-2 py-4">
            <Label htmlFor="reason">Reason (Optional)</Label>
            <Textarea
              id="reason"
              placeholder="Enter reason for archiving..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={archiving}
          >
            Cancel
          </Button>
          <Button onClick={handleArchive} disabled={archiving}>
            {archiving
              ? isRestore
                ? "Restoring..."
                : "Archiving..."
              : isRestore
              ? "Restore"
              : "Archive"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
