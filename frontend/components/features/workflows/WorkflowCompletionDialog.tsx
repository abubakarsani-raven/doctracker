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
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useUpdateWorkflow } from "@/lib/hooks/use-workflows";

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

  const handleComplete = async () => {
    if (!workflow) {
      toast.error("Workflow not found");
      return;
    }

    try {
      await updateWorkflow.mutateAsync({
        id: workflowId,
        data: {
          status: "completed",
          completedAt: new Date().toISOString(),
        },
      });

      toast.success("Workflow marked as completed");
      onWorkflowCompleted?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Failed to complete workflow:", error);
      toast.error(
        error.message || "Failed to complete workflow. Please try again.",
      );
    }
  };

  const title =
    workflow?.title ||
    workflow?.documentName ||
    workflow?.folderName ||
    "Untitled Workflow";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Complete workflow?
          </DialogTitle>
          <DialogDescription>
            This finalizes the workflow and moves it to Completed. Open actions
            stay as they are — make sure everything that needed doing is done.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-lg border bg-muted/50 p-3">
            <p className="mb-1 text-sm font-medium">Workflow</p>
            <p className="text-sm text-muted-foreground">{title}</p>
            {workflow?.description ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {workflow.description}
              </p>
            ) : null}
          </div>

          <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p>
              Completing cannot be undone from this screen. Only reopen the
              workflow if your organization allows status changes later.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateWorkflow.isPending}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleComplete}
            disabled={updateWorkflow.isPending}
            className="w-full bg-green-600 hover:bg-green-700 sm:w-auto"
          >
            {updateWorkflow.isPending ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4 animate-spin" />
                Completing…
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Yes, mark complete
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
