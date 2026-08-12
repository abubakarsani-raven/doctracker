"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FolderOpen } from "lucide-react";

interface AddToFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  currentFolderId?: string;
  onAdded?: () => void;
}

/** Gated until move-to-folder API is wired — no multi-step fake form. */
export function AddToFolderDialog({
  open,
  onOpenChange,
}: AddToFolderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Add to folder
          </DialogTitle>
          <DialogDescription>
            Moving documents between folders is coming soon. Upload into the
            target folder or ask an admin to reorganize files for now.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
