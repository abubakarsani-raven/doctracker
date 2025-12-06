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
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { useUpdateWorkflow } from "@/lib/hooks/use-workflows";
import { useCurrentUser } from "@/lib/hooks/use-users";

interface WorkflowCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId: string;
  workflow?: any;
  onWorkflowCompleted?: () => void;
}

export function WorkflowCompletionDialog({
  open,
  onOpenChange,
  workflowId,
  workflow,
  onWorkflowCompleted,
}: WorkflowCompletionDialogProps) {
  const updateWorkflow = useUpdateWorkflow();
  const { data: currentUser } = useCurrentUser();

  const handleComplete = async () => {
    if (!workflow) {
      toast.error("Workflow not found");
      return;
    }

    try {
      // Update workflow status to completed
      await updateWorkflow.mutateAsync({
        id: workflowId,
        data: {
          status: "completed",
          completedAt: new Date().toISOString(),
        },
      });

      toast.success("Workflow marked as completed successfully");
      onWorkflowCompleted?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Failed to complete workflow:", error);
      toast.error(error.message || "Failed to complete workflow. Please try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Complete Workflow
          </DialogTitle>
          <DialogDescription>
            Mark this workflow as completed. This action will finalize the workflow
            and it will be moved to the completed section.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {workflow && (
            <div className="rounded-lg border p-3 bg-muted/50">
              <p className="text-sm font-medium mb-1">Workflow Summary</p>
              <p className="text-sm text-muted-foreground">
                {workflow.title || workflow.documentName || workflow.folderName || "Untitled Workflow"}
              </p>
              {workflow.description && (
                <p className="text-xs text-muted-foreground mt-1">{workflow.description}</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateWorkflow.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleComplete}
            disabled={updateWorkflow.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            {updateWorkflow.isPending ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4 animate-spin" />
                Completing...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Mark as Complete
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
