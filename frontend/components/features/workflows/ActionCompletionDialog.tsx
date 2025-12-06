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
import { CheckCircle2 } from "lucide-react";
import { useUpdateAction } from "@/lib/hooks/use-actions";
import { useUpdateWorkflowProgress } from "@/lib/hooks/use-workflow-progress";
import { useCurrentUser } from "@/lib/hooks/use-users";
import { useWorkflow } from "@/lib/hooks/use-workflows";

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
  const updateAction = useUpdateAction();
  const { updateProgress } = useUpdateWorkflowProgress();
  const { data: currentUser } = useCurrentUser();
  const { data: workflow } = useWorkflow(action?.workflowId || "");

  const handleComplete = async () => {
    if (!action) {
      toast.error("Action not found");
      return;
    }

    try {
      // Update action via API
      await updateAction.mutateAsync({
        id: actionId,
        data: {
          status: "completed",
          completedAt: new Date().toISOString(),
          completedBy: currentUser?.id || currentUser?.email || "Unknown",
          resolutionNotes: completionNotes,
        },
      });

      // Update workflow progress (React Query will handle refetching)
      if (action.workflowId) {
        await updateProgress(action.workflowId);
      }

      // TODO: Create notifications via API endpoint when available
      // For now, notifications will be created by backend when action is updated

      toast.success(
        "Action marked as complete. Notifications sent to workflow participants."
      );
      setCompletionNotes("");
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
            Mark this action as completed. All participants in the workflow chain
            will be notified.
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

          <div className="space-y-2">
            <Label htmlFor="completion-notes">
              Completion Notes (Optional)
            </Label>
            <Textarea
              id="completion-notes"
              placeholder="Add notes about the completion..."
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              disabled={updateAction.isPending}
              rows={4}
            />
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
          <Button onClick={handleComplete} disabled={updateAction.isPending}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {updateAction.isPending ? "Completing..." : "Mark as Complete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
