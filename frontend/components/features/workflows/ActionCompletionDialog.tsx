"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { useUpdateAction } from "@/lib/hooks/use-actions";
import { useUpdateWorkflowProgress } from "@/lib/hooks/use-workflow-progress";
import { useCurrentUser } from "@/lib/hooks/use-users";
import { useDocuments } from "@/lib/hooks/use-documents";
import { useWorkflow } from "@/lib/hooks/use-workflows";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FolderAtMentionTextarea } from "./FolderAtMentionTextarea";

interface ActionCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionId: string;
  action?: any;
  onActionCompleted?: () => void;
}

export function ActionCompletionDialog({
  open,
  onOpenChange,
  actionId,
  action,
  onActionCompleted,
}: ActionCompletionDialogProps) {
  const [completionNotes, setCompletionNotes] = useState("");
  const [referencedFileId, setReferencedFileId] = useState<string>("");
  const [saveToFolderId, setSaveToFolderId] = useState<string | null>(null);
  const updateAction = useUpdateAction();
  const { updateProgress } = useUpdateWorkflowProgress();
  const { data: currentUser } = useCurrentUser();
  const { data: documents = [] } = useDocuments();
  const queryClient = useQueryClient();

  const workflowId = action?.workflowId as string | undefined;
  const { data: workflow } = useWorkflow(workflowId || "");

  const isDocumentWorkflow =
    workflow?.type === "document" || (!!workflow?.documentId && workflow?.type !== "folder");
  const primaryDocumentId = (workflow?.documentId as string | undefined) || undefined;

  const { data: workflowFiles = [] } = useQuery({
    queryKey: ["workflows", workflowId, "files"],
    queryFn: async () => {
      if (!workflowId) return [];
      return (await api.getWorkflowFiles(workflowId)) as any[];
    },
    enabled: open && !!workflowId,
  });

  const filesOnWorkflow = useMemo(() => {
    const seen = new Set<string>();
    return (workflowFiles as any[])
      .filter((f) => f?.id)
      .filter((f) => {
        if (seen.has(f.id)) return false;
        seen.add(f.id);
        return true;
      })
      .map((f) => ({
        id: f.id as string,
        name: (f.name || f.fileName || "Untitled") as string,
        isPrimary: !!f.isPrimary,
      }));
  }, [workflowFiles]);

  const onWorkflowIds = useMemo(
    () => new Set(filesOnWorkflow.map((f) => f.id)),
    [filesOnWorkflow],
  );

  const primaryDoc = useMemo(() => {
    if (!primaryDocumentId) return null;
    const fromWf = filesOnWorkflow.find((f) => f.id === primaryDocumentId);
    if (fromWf) return fromWf;
    const fromDocs = (documents as any[]).find((d) => d.id === primaryDocumentId);
    if (fromDocs) {
      return {
        id: fromDocs.id as string,
        name: (fromDocs.name || fromDocs.fileName || "Primary document") as string,
        isPrimary: true,
      };
    }
    return { id: primaryDocumentId, name: "Primary document", isPrimary: true };
  }, [primaryDocumentId, filesOnWorkflow, documents]);

  const otherCompanyDocs = useMemo(() => {
    if (isDocumentWorkflow) return [];
    return documents.filter((d: any) => {
      if (!d?.id || onWorkflowIds.has(d.id)) return false;
      if (action?.companyId && d.companyId && d.companyId !== action.companyId) {
        return false;
      }
      return true;
    });
  }, [documents, action?.companyId, onWorkflowIds, isDocumentWorkflow]);

  // Document workflows may only reference the primary document.
  useEffect(() => {
    if (!open) return;
    if (isDocumentWorkflow && primaryDocumentId) {
      setReferencedFileId(primaryDocumentId);
    }
  }, [open, isDocumentWorkflow, primaryDocumentId]);

  const handleComplete = async () => {
    if (!action) {
      toast.error("Action not found");
      return;
    }

    const result = completionNotes.trim();
    if (!result) {
      toast.error("Add a result before completing this action.");
      return;
    }

    if (isDocumentWorkflow && primaryDocumentId && referencedFileId && referencedFileId !== primaryDocumentId) {
      toast.error("Document workflows can only reference the primary document.");
      return;
    }

    try {
      await updateAction.mutateAsync({
        id: actionId,
        data: {
          status: "completed",
          completedAt: new Date().toISOString(),
          completedBy: currentUser?.id || currentUser?.email || "Unknown",
          resolutionNotes: result,
          ...(referencedFileId
            ? {
                referencedFileId,
                uploadedDocumentId: referencedFileId,
                ...(saveToFolderId ? { saveToFolderId } : {}),
              }
            : {}),
        },
      });

      if (action.workflowId) {
        await updateProgress(action.workflowId);
        queryClient.invalidateQueries({
          queryKey: ["workflows", action.workflowId, "files"],
        });
      }
      if (referencedFileId) {
        queryClient.invalidateQueries({ queryKey: ["documents"] });
        queryClient.invalidateQueries({ queryKey: ["folders"] });
      }

      toast.success(
        referencedFileId
          ? saveToFolderId
            ? "Action completed. File linked and saved to the folder."
            : "Action completed. Result and file are on the workflow."
          : "Action completed. Your result is now on the workflow.",
      );
      setCompletionNotes("");
      setReferencedFileId("");
      setSaveToFolderId(null);
      onActionCompleted?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Failed to complete action:", error);
      toast.error(error.message || "Failed to complete action. Please try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Complete Action</DialogTitle>
          <DialogDescription>
            {isDocumentWorkflow
              ? "Record the outcome. This document workflow can only reference its primary document. Type @ to save it into a folder."
              : "Record the outcome. Optionally reference a file from Files Added (or another document). Type @ to save it into a folder."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {action && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm font-medium mb-1">{action.title}</p>
              {action.description && (
                <p className="text-sm text-muted-foreground">
                  {action.description}
                </p>
              )}
            </div>
          )}

          <FolderAtMentionTextarea
            value={completionNotes}
            onChange={setCompletionNotes}
            saveToFolderId={saveToFolderId}
            onSaveToFolderChange={(folder) =>
              setSaveToFolderId(folder?.id ?? null)
            }
            disabled={updateAction.isPending}
            hint={
              referencedFileId
                ? "Type @ to choose a folder for the referenced document."
                : "Select a file below, then type @ to save it into a folder."
            }
          />

          <div className="space-y-2">
            <Label>Reference a file (optional)</Label>
            {isDocumentWorkflow ? (
              <Select
                value={referencedFileId || "__none__"}
                onValueChange={(v) =>
                  setReferencedFileId(v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="None — notes only" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None — notes only</SelectItem>
                  {primaryDoc && (
                    <SelectItem value={primaryDoc.id}>
                      {primaryDoc.name} (primary)
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            ) : (
              <Select
                value={referencedFileId || "__none__"}
                onValueChange={(v) =>
                  setReferencedFileId(v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="None — notes only" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None — notes only</SelectItem>
                  {filesOnWorkflow.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Files Added on this workflow</SelectLabel>
                      {filesOnWorkflow.map((doc) => (
                        <SelectItem key={doc.id} value={doc.id}>
                          {doc.name}
                          {doc.isPrimary ? " (primary)" : ""}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {otherCompanyDocs.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Other documents</SelectLabel>
                      {otherCompanyDocs.map((doc: any) => (
                        <SelectItem key={doc.id} value={doc.id}>
                          {doc.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">
              {isDocumentWorkflow
                ? "Only the workflow’s primary document can be referenced."
                : "Referenced files open from Action Results and appear under Files Added."}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateAction.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleComplete}
            disabled={updateAction.isPending || !completionNotes.trim()}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {updateAction.isPending ? "Completing..." : "Mark as Complete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
