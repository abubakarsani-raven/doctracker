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
import { api } from "@/lib/api";
import { updateWorkflowProgress } from "@/lib/workflow-utils";

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
  const [completing, setCompleting] = useState(false);

  const handleComplete = async () => {
    setCompleting(true);

    try {
      // Get existing actions from localStorage
      const existingActions = JSON.parse(localStorage.getItem("actions") || "[]");
      const actionIndex = existingActions.findIndex((a: any) => a.id === actionId);

      if (actionIndex === -1) {
        toast.error("Action not found");
        return;
      }

      // Update action status
      const updatedAction = {
        ...existingActions[actionIndex],
        status: "completed",
        completedAt: new Date().toISOString(),
        completedBy: "Current User", // TODO: Get from context
        resolutionNotes: completionNotes,
      };

      existingActions[actionIndex] = updatedAction;
      localStorage.setItem("actions", JSON.stringify(existingActions));

      // Create notifications for workflow chain participants
      const workflows = await api.getWorkflows();
      const workflow = workflows.find((w: any) => w.id === action?.workflowId);
      
      if (workflow) {
        const notifications = JSON.parse(localStorage.getItem("notifications") || "[]");
        
        // Notify workflow creator
        const creatorNotification = {
          id: `notif-${Date.now()}-1`,
          type: "action_completed",
          title: "Action Completed",
          message: `Action "${action?.title || updatedAction.title}" has been completed`,
          resourceType: "action",
          resourceId: actionId,
          read: false,
          createdAt: new Date().toISOString(),
        };
        notifications.push(creatorNotification);

        // Notify workflow assignee
        if (workflow.assignedTo) {
          const assigneeNotification = {
            id: `notif-${Date.now()}-2`,
            type: "action_completed",
            title: "Action Completed",
            message: `Action "${action?.title || updatedAction.title}" has been completed in workflow "${workflow.documentName || workflow.title}"`,
            resourceType: "action",
            resourceId: actionId,
            read: false,
            createdAt: new Date().toISOString(),
          };
          notifications.push(assigneeNotification);
        }

        localStorage.setItem("notifications", JSON.stringify(notifications));
        window.dispatchEvent(new CustomEvent("notificationsUpdated"));
      }

      // Dispatch event to update context
      window.dispatchEvent(new CustomEvent("actionsUpdated"));

      // Update workflow progress
      if (action?.workflowId) {
        await updateWorkflowProgress(action.workflowId);
      }

      toast.success("Action marked as complete. Notifications sent to workflow participants.");
      setCompletionNotes("");
      onActionCompleted?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to complete action:", error);
      toast.error("Failed to complete action. Please try again.");
    } finally {
      setCompleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Complete Action</DialogTitle>
          <DialogDescription>
            Mark this action as completed. All participants in the workflow chain will be notified.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {action && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm font-medium mb-1">{action.title}</p>
              {action.description && (
                <p className="text-sm text-muted-foreground">{action.description}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="completion-notes">Completion Notes (Optional)</Label>
            <Textarea
              id="completion-notes"
              placeholder="Add notes about the completion..."
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              disabled={completing}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={completing}>
            Cancel
          </Button>
          <Button onClick={handleComplete} disabled={completing}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {completing ? "Completing..." : "Mark as Complete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
