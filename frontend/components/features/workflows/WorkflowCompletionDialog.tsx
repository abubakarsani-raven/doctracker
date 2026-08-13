"use client";

import { useMemo, useState } from "react";
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

function isActionOpen(action: any): boolean {
  const status = String(action?.status || "").toLowerCase();
  return !(
    status === "completed" ||
    status === "cancelled" ||
    status === "canceled" ||
    status === "document_uploaded" ||
    status === "response_received"
  );
}

export function WorkflowCompletionDialog({
  open,
  onOpenChange,
  workflowId,
  workflow,
  onWorkflowCompleted,
}: WorkflowCompletionDialogProps) {
  const updateWorkflow = useUpdateWorkflow();
  const [forceComplete, setForceComplete] = useState(false);

  const openActions = useMemo(() => {
    const list = Array.isArray(workflow?.actions) ? workflow.actions : [];
    return list.filter(isActionOpen);
  }, [workflow]);

  const hasOpenActions = openActions.length > 0;
  const canComplete = !hasOpenActions || forceComplete;

  const handleComplete = async () => {
    if (!workflow) {
      toast.error("Workflow not found");
      return;
    }
    if (!canComplete) {
      toast.error("Resolve open actions or choose “Close anyway”");
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

      toast.success("Workflow closed");
      setForceComplete(false);
      onWorkflowCompleted?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Failed to complete workflow:", error);
      toast.error(
        error.message || "Failed to close workflow. Please try again.",
      );
    }
  };

  const title =
    workflow?.title ||
    workflow?.documentName ||
    workflow?.folderName ||
    "Untitled Workflow";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setForceComplete(false);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Close this workflow?
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Closing marks the case as finished. You do not need actions
                first — the progress bar only tracks actions if you created
                them.
              </p>
              <ol className="list-decimal space-y-1 pl-4">
                <li>Close the workflow (this step) — status becomes Closed.</li>
                <li>
                  Optionally Route → File documents to archive the case.
                </li>
              </ol>
              <p>
                The end point date is a deadline, not a close button.
              </p>
            </div>
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

          {hasOpenActions ? (
            <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <div className="flex gap-2 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="font-medium text-foreground">
                    {openActions.length} open action
                    {openActions.length === 1 ? "" : "s"}
                  </p>
                  <ul className="mt-1 list-inside list-disc text-muted-foreground">
                    {openActions.slice(0, 5).map((action: any) => (
                      <li key={action.id}>
                        {action.title || action.name || "Untitled action"}
                        {action.status ? ` (${action.status})` : ""}
                      </li>
                    ))}
                    {openActions.length > 5 ? (
                      <li>…and {openActions.length - 5} more</li>
                    ) : null}
                  </ul>
                </div>
              </div>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={forceComplete}
                  onChange={(e) => setForceComplete(e.target.checked)}
                />
                <span>
                  Close anyway — leave open actions as they are
                </span>
              </label>
            </div>
          ) : (
            <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p>
                Closing cannot be undone from this screen.
              </p>
            </div>
          )}
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
            disabled={updateWorkflow.isPending || !canComplete}
            className="w-full bg-green-600 hover:bg-green-700 sm:w-auto"
          >
            {updateWorkflow.isPending ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4 animate-spin" />
                Closing…
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {hasOpenActions && forceComplete
                  ? "Close anyway"
                  : "Yes, close workflow"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
