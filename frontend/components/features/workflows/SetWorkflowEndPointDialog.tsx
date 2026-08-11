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
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface SetWorkflowEndPointDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId: string;
  currentEndPoint?: string | Date | null;
  onSaved?: () => void;
}

export function SetWorkflowEndPointDialog({
  open,
  onOpenChange,
  workflowId,
  currentEndPoint,
  onSaved,
}: SetWorkflowEndPointDialogProps) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState<Date | undefined>(() =>
    currentEndPoint ? new Date(currentEndPoint) : undefined,
  );
  const [saving, setSaving] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDate(currentEndPoint ? new Date(currentEndPoint) : undefined);
      setConfirmClearOpen(false);
    }
    onOpenChange(next);
  };

  const save = async (next: Date | null) => {
    setSaving(true);
    try {
      await api.setWorkflowEndPoint(
        workflowId,
        next ? next.toISOString() : null,
      );
      await queryClient.invalidateQueries({ queryKey: ["workflows", workflowId] });
      await queryClient.invalidateQueries({ queryKey: ["workflows"] });
      toast.success(
        next
          ? `End point set to ${format(next, "PPp")}`
          : "End point cleared",
      );
      onSaved?.();
      setConfirmClearOpen(false);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || "Could not update end point");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set end point</DialogTitle>
            <DialogDescription>
              Pick when this workflow should be finished. Assignees see this as
              the deadline. Only the creator, company secretary, department head,
              group secretary, or master can change it.
            </DialogDescription>
          </DialogHeader>

          {currentEndPoint ? (
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Current:{" "}
              <span className="font-medium text-foreground">
                {format(new Date(currentEndPoint), "PPp")}
              </span>
            </p>
          ) : null}

          <div className="py-1">
            <DateTimePicker
              value={date}
              onChange={setDate}
              disabled={saving}
              dateLabel="Date"
              timeLabel="Time"
              placeholder="Pick when this workflow should end"
            />
          </div>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={saving || !currentEndPoint}
              onClick={() => setConfirmClearOpen(true)}
            >
              Clear end point
            </Button>
            <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={saving || !date}
                onClick={() => date && save(date)}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Save end point
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmClearOpen}
        onOpenChange={setConfirmClearOpen}
        title="Clear end point?"
        description="This removes the deadline from the workflow. Assignees will no longer see a finish-by date until you set one again."
        confirmLabel="Clear end point"
        variant="destructive"
        loading={saving}
        onConfirm={() => save(null)}
      />
    </>
  );
}
