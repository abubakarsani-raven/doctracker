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
import { api } from "@/lib/api";

interface ArchiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId?: string;
  folderId?: string;
  isRestore?: boolean;
  onComplete?: () => void;
}

export function ArchiveDialog({
  open,
  onOpenChange,
  documentId,
  folderId,
  isRestore = false,
  onComplete,
}: ArchiveDialogProps) {
  const [reason, setReason] = useState("");

  const handleArchive = async () => {
    if (!documentId && !folderId) {
      toast.error("No document or folder specified");
      return;
    }

    try {
      if (documentId) {
        if (isRestore) {
          await api.unarchiveDocument(documentId);
          toast.success("Document restored successfully");
        } else {
          await api.archiveDocument(documentId);
          toast.success("Document archived successfully");
        }
      } else if (folderId) {
        if (isRestore) {
          // Add unarchive folder API when available
          toast.error("Folder restore not implemented yet");
          return;
        } else {
          await api.archiveFolder(folderId);
          toast.success("Folder archived successfully");
        }
      }
      
      onComplete?.();
      onOpenChange(false);
      setReason("");
    } catch (error) {
      console.error("Error with archive operation:", error);
      toast.error(`Failed to ${isRestore ? 'restore' : 'archive'} ${documentId ? 'document' : 'folder'}`);
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
          >
            Cancel
          </Button>
          <Button onClick={handleArchive}>
            {isRestore ? "Restore" : "Archive"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
