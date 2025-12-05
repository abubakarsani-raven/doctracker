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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/common";
import { FileWithMetadata } from "@/components/common";
import { Upload, Folder, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useMockData } from "@/lib/contexts/MockDataContext";
import { updateWorkflowProgress } from "@/lib/workflow-utils";

interface DocumentUploadActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionId: string;
  action?: any;
  onUploadComplete?: () => void;
}

export function DocumentUploadActionDialog({
  open,
  onOpenChange,
  actionId,
  action,
  onUploadComplete,
}: DocumentUploadActionDialogProps) {
  const { folders } = useMockData();
  const [files, setFiles] = useState<FileWithMetadata[]>([]);
  const [uploading, setUploading] = useState(false);
  const [notes, setNotes] = useState("");
  const [uploadedAction, setUploadedAction] = useState<any>(null);
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);

  const targetFolder = action?.targetFolderId
    ? folders.find((f: any) => f.id === action.targetFolderId)
    : null;

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setNotes("");
    }
  }, [open]);

  const handleFilesSelected = (selectedFiles: FileWithMetadata[]) => {
    // Filter by required file type if specified
    if (action?.requiredFileType) {
      const requiredType = action.requiredFileType.toLowerCase();
      const filtered = selectedFiles.filter((file) => {
        const extension = file.file.name.split(".").pop()?.toLowerCase();
        return extension === requiredType || file.file.type.includes(requiredType);
      });
      
      if (filtered.length < selectedFiles.length) {
        toast.warning(`Some files were filtered. Only ${action.requiredFileType} files are accepted.`);
      }
      
      setFiles(filtered);
    } else {
      setFiles(selectedFiles);
    }
  };

  const handleFilesRemoved = (fileIds: string[]) => {
    setFiles((prev) => prev.filter((f) => !fileIds.includes(f.id)));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("Please select at least one file to upload");
      return;
    }

    if (!action?.targetFolderId) {
      toast.error("Target folder not specified for this action");
      return;
    }

    setUploading(true);

    try {
      // TODO: Replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Update action status
      const existingActions = JSON.parse(localStorage.getItem("actions") || "[]");
      const actionIndex = existingActions.findIndex((a: any) => a.id === actionId);

      if (actionIndex !== -1) {
        const updatedAction = {
          ...existingActions[actionIndex],
          status: "document_uploaded",
          uploadedDocumentId: `doc-${Date.now()}`,
          uploadedDocumentName: files[0].file.name,
          uploadedAt: new Date().toISOString(),
          uploadedBy: "Current User",
          uploadNotes: notes,
        };

        existingActions[actionIndex] = updatedAction;
        localStorage.setItem("actions", JSON.stringify(existingActions));
        window.dispatchEvent(new CustomEvent("actionsUpdated"));

        // Update workflow progress
        if (action?.workflowId) {
          await updateWorkflowProgress(action.workflowId);
        }

        // Create notifications for workflow chain participants
        const workflows = await api.getWorkflows();
        const workflow = workflows.find((w: any) => w.id === action?.workflowId);
        
        if (workflow) {
          const notifications = JSON.parse(localStorage.getItem("notifications") || "[]");
          const notification = {
            id: `notif-${Date.now()}`,
            type: "action_updated",
            title: "Document Uploaded for Action",
            message: `Document "${files[0].file.name}" has been uploaded for action "${action?.title}"`,
            resourceType: "action",
            resourceId: actionId,
            read: false,
            createdAt: new Date().toISOString(),
          };
          notifications.push(notification);
          localStorage.setItem("notifications", JSON.stringify(notifications));
          window.dispatchEvent(new CustomEvent("notificationsUpdated"));
        }

      }

      toast.success("Document uploaded successfully. You can mark the action as complete by clicking on it.");
      onUploadComplete?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to upload document:", error);
      toast.error("Failed to upload document. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Upload Document for Action</DialogTitle>
          <DialogDescription>
            Upload the required document for this action. It will be saved to the specified folder.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {action && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm font-medium mb-1">{action.title}</p>
              {action.description && (
                <p className="text-xs text-muted-foreground">{action.description}</p>
              )}
            </div>
          )}

          {targetFolder && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
              <div className="flex items-center gap-2">
                <Folder className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Target Folder:</p>
                  <p className="text-xs text-muted-foreground">{targetFolder.name}</p>
                </div>
              </div>
            </div>
          )}

          {action?.requiredFileType && (
            <div className="p-2 bg-yellow-50 dark:bg-yellow-950 rounded-md">
              <p className="text-xs text-yellow-800 dark:text-yellow-200">
                Required file type: {action.requiredFileType.toUpperCase()}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Upload Document *</Label>
            <FileUpload
              onFilesSelected={handleFilesSelected}
              onFilesRemoved={handleFilesRemoved}
              multiple={false}
              maxSize={100 * 1024 * 1024} // 100MB
            />
            {files.length > 0 && (
              <div className="text-xs text-muted-foreground">
                Selected: {files.map((f) => f.file.name).join(", ")}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="upload-notes">Notes (Optional)</Label>
            <Textarea
              id="upload-notes"
              placeholder="Add any notes about this upload..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={uploading}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={uploading || files.length === 0}>
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? "Uploading..." : "Upload Document"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
