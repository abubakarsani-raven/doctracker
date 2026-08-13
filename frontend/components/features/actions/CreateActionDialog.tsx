"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast as sonnerToast } from "sonner";
import { useCreateAction } from "@/lib/hooks/use-actions";
import { useWorkflows } from "@/lib/hooks/use-workflows";
import { useUsers } from "@/lib/hooks/use-users";
import { useCompanies } from "@/lib/hooks/use-companies";
import { usePermissions } from "@/lib/hooks/use-permissions";
import {
  clampDateToWorkflowEnd,
  isAfterWorkflowEnd,
  workflowEndDate,
} from "@/lib/workflow-utils";

interface CreateActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateActionDialog({
  open,
  onOpenChange,
}: CreateActionDialogProps) {
  const { data: workflows = [] } = useWorkflows();
  const { data: users = [] } = useUsers();
  const { data: companies = [] } = useCompanies();
  const createAction = useCreateAction();
  const { can } = usePermissions();

  const [workflowId, setWorkflowId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignToType, setAssignToType] = useState<"user" | "department">("user");
  const [assignToId, setAssignToId] = useState("");
  const [dueDate, setDueDate] = useState<Date>();

  const creating = createAction.isPending;

  // An action always belongs to a workflow, and the server takes the action's
  // company from it — so a workflow has to be chosen before anything else.
  const openWorkflows = useMemo(
    () => workflows.filter((w: any) => w.status !== "completed"),
    [workflows],
  );

  const selectedWorkflow = useMemo(
    () => openWorkflows.find((w: any) => w.id === workflowId),
    [openWorkflows, workflowId],
  );
  const workflowEnd = workflowEndDate(selectedWorkflow);

  const activeUsers = useMemo(
    () => users.filter((u: any) => u.status === "active"),
    [users],
  );

  const departments = useMemo(() => {
    const depts: any[] = [];
    companies.forEach((company: any) => {
      (company.departments ?? []).forEach((dept: any) => {
        depts.push({ ...dept, companyName: company.name });
      });
    });
    return depts;
  }, [companies]);

  const assigneeOptions =
    assignToType === "user"
      ? activeUsers.map((u: any) => ({
          id: u.id,
          label: u.name || u.email || u.id,
        }))
      : departments.map((d: any) => ({
          id: d.id,
          label: d.companyName ? `${d.name} — ${d.companyName}` : d.name,
        }));

  const resetForm = () => {
    setWorkflowId("");
    setTitle("");
    setDescription("");
    setAssignToType("user");
    setAssignToId("");
    setDueDate(undefined);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!can("actions.assign")) {
      sonnerToast.error("Your role cannot assign actions.");
      return;
    }

    if (!title.trim()) {
      sonnerToast.error("Please enter an action title");
      return;
    }

    if (!workflowId) {
      sonnerToast.error("Please choose the workflow this action belongs to");
      return;
    }

    const assignee = assigneeOptions.find((o) => o.id === assignToId);
    if (!assignee) {
      sonnerToast.error("Please choose who this action is assigned to");
      return;
    }

    if (dueDate && isAfterWorkflowEnd(dueDate, workflowEnd)) {
      sonnerToast.error(
        workflowEnd
          ? `Action due date cannot be after the workflow end point (${format(workflowEnd, "PPp")})`
          : "Action due date cannot be after the workflow end point",
      );
      return;
    }

    try {
      await createAction.mutateAsync({
        workflowId,
        title: title.trim(),
        description: description.trim() || undefined,
        type: "regular",
        assignedTo: {
          type: assignToType,
          id: assignee.id,
          name: assignee.label,
        },
        dueDate: dueDate ? dueDate.toISOString() : undefined,
      });

      resetForm();
      onOpenChange(false);
    } catch (error: any) {
      sonnerToast.error(
        error?.message || "Failed to create action. Please try again.",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Action</DialogTitle>
          <DialogDescription>
            Create a new action item to track and assign
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workflow">Workflow *</Label>
            <Select
              value={workflowId}
              onValueChange={(next) => {
                setWorkflowId(next);
                const nextEnd = workflowEndDate(
                  openWorkflows.find((w: any) => w.id === next),
                );
                if (dueDate && nextEnd && isAfterWorkflowEnd(dueDate, nextEnd)) {
                  setDueDate(clampDateToWorkflowEnd(dueDate, nextEnd));
                }
              }}
              disabled={creating}
            >
              <SelectTrigger id="workflow">
                <SelectValue placeholder="Select the workflow this belongs to" />
              </SelectTrigger>
              <SelectContent>
                {openWorkflows.map((workflow: any) => (
                  <SelectItem key={workflow.id} value={workflow.id}>
                    {workflow.title || "Untitled Workflow"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {openWorkflows.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No open workflows. Create a workflow before adding actions.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Action Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Review contract terms"
              required
              disabled={creating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional details..."
              rows={3}
              disabled={creating}
            />
          </div>

          <div className="space-y-2">
            <Label>Assign To *</Label>
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={assignToType}
                onValueChange={(value: "user" | "department") => {
                  setAssignToType(value);
                  setAssignToId("");
                }}
                disabled={creating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="department">Department</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={assignToId}
                onValueChange={setAssignToId}
                disabled={creating}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {assigneeOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Due Date (Optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dueDate && "text-muted-foreground"
                  )}
                  disabled={creating}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={(next) =>
                    setDueDate(
                      next ? clampDateToWorkflowEnd(next, workflowEnd) : undefined,
                    )
                  }
                  disabled={workflowEnd ? { after: workflowEnd } : undefined}
                  endMonth={workflowEnd}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {workflowEnd && (
              <p className="text-xs text-muted-foreground">
                Must be on or before the workflow end point (
                {format(workflowEnd, "PPp")}).
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? "Creating..." : "Create Action"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
