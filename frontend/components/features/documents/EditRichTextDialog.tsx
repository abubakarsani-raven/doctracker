"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "./RichTextEditor";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";

interface EditRichTextDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  currentContent?: string;
  onSaved?: () => void;
}

export function EditRichTextDialog({
  open,
  onOpenChange,
  documentId,
  currentContent = "",
  onSaved,
}: EditRichTextDialogProps) {
  const [content, setContent] = useState(currentContent);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load current content when dialog opens
  useEffect(() => {
    if (open && documentId) {
      loadCurrentContent();
    }
  }, [open, documentId]);

  const loadCurrentContent = async () => {
    setLoading(true);
    try {
      const document = await api.getDocument(documentId);
      if (document?.richTextContent) {
        setContent(document.richTextContent);
      } else {
        setContent(currentContent || "");
      }
    } catch (error) {
      console.error("Failed to load document content:", error);
      setContent(currentContent || "");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!content.trim() || content === "<p></p>") {
      toast.error("Please add some content to the document");
      return;
    }

    setSaving(true);
    try {
      await api.updateRichTextDocument(documentId, content);
      toast.success("Document updated successfully");
      onSaved?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Failed to update document:", error);
      toast.error(error?.message || "Failed to update document. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setContent(currentContent);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Document</DialogTitle>
          <DialogDescription>
            Make changes to your rich text document
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <RichTextEditor
              content={content}
              onChange={setContent}
              placeholder="Start typing your document content..."
              editable={!saving}
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
