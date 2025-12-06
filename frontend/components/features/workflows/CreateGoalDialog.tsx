"use client";

import { useState, useEffect, useMemo } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, User, Building2, Users } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useUsers } from "@/lib/hooks/use-users";
import { useCompanies } from "@/lib/hooks/use-companies";
import { useCreateWorkflowGoal } from "@/lib/hooks/use-goals";
import { useWorkflow } from "@/lib/hooks/use-workflows";
import { Checkbox } from "@/components/ui/checkbox";

interface CreateGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId: string;
  onGoalCreated?: () => void;
}

export function CreateGoalDialog({
  open,
  onOpenChange,
  workflowId,
  onGoalCreated,
}: CreateGoalDialogProps) {
  const { data: users = [] } = useUsers();
  const { data: companies = [] } = useCompanies();
  const { data: workflow } = useWorkflow(workflowId);
  const createGoal = useCreateWorkflowGoal();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedToType, setAssignedToType] = useState<"user" | "department" | "all_participants">("all_participants");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);

  const isCreating = createGoal.isPending;

  // Get all departments
  const allDepartments = useMemo(() => {
    const depts: any[] = [];
    companies.forEach((company: any) => {
      if (company.departments) {
        company.departments.forEach((dept: any) => {
          depts.push({ ...dept, companyName: company.name });
        });
      }
    });
    return depts;
  }, [companies]);

  // Get workflow participants
  const workflowParticipants = useMemo(() => {
    if (!workflow) return [];
    const participants: any[] = [];
    
    // Add creator
    if (workflow.creator) {
      participants.push({
        id: workflow.creator.id,
        name: workflow.creator.name || workflow.creator.email,
        type: "user",
      });
    }

    // Add current assignee
    if (workflow.assignedTo) {
      if (workflow.assignedTo.type === "user") {
        const user = users.find((u: any) => u.id === workflow.assignedTo.id);
        if (user && !participants.find((p: any) => p.id === user.id)) {
          participants.push({
            id: user.id,
            name: user.name || user.email,
            type: "user",
          });
        }
      }
    }

    // Add routing history participants
    if (workflow.routingHistory) {
      workflow.routingHistory.forEach((route: any) => {
        if (route.from && route.from.type === "user") {
          const user = users.find((u: any) => u.id === route.from.id);
          if (user && !participants.find((p: any) => p.id === user.id)) {
            participants.push({
              id: user.id,
              name: user.name || user.email,
              type: "user",
            });
          }
        }
        if (route.to && route.to.type === "user") {
          const user = users.find((u: any) => u.id === route.to.id);
          if (user && !participants.find((p: any) => p.id === user.id)) {
            participants.push({
              id: user.id,
              name: user.name || user.email,
              type: "user",
            });
          }
        }
      });
    }

    return participants;
  }, [workflow, users]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setTitle("");
      setDescription("");
      setAssignedToType("all_participants");
      setSelectedUserId("");
      setSelectedDepartmentId("");
      setDueDate(undefined);
    }
  }, [open]);

  const handleCreate = async () => {
    if (!title.trim()) {
      return;
    }

    try {
      let assignedToId: string | null = null;
      let assignedToName = "";
      let assignedUsers: any[] | null = null;

      if (assignedToType === "all_participants") {
        assignedToName = "All Workflow Participants";
        assignedUsers = workflowParticipants;
      } else if (assignedToType === "user") {
        const user = users.find((u: any) => u.id === selectedUserId);
        if (user) {
          assignedToId = user.id;
          assignedToName = user.name || user.email;
          assignedUsers = [{ id: user.id, name: assignedToName, type: "user" }];
        }
      } else if (assignedToType === "department") {
        const dept = allDepartments.find((d: any) => d.id === selectedDepartmentId);
        if (dept) {
          assignedToId = dept.id;
          assignedToName = dept.name;
          assignedUsers = [{ id: dept.id, name: dept.name, type: "department" }];
        }
      }

      await createGoal.mutateAsync({
        workflowId,
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
          assignedToType,
          assignedToId,
          assignedToName,
          assignedUsers,
          dueDate: dueDate?.toISOString(),
        },
      });

      onGoalCreated?.();
      onOpenChange(false);
    } catch (error) {
      // Error is handled by the mutation hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Post-Workflow Goal</DialogTitle>
          <DialogDescription>
            Create a goal that will be visible to all workflow participants
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Goal Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Update budget template based on feedback"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description of the goal"
              rows={3}
            />
          </div>

          <div>
            <Label>Assign To</Label>
            <Select
              value={assignedToType}
              onValueChange={(value: any) => setAssignedToType(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_participants">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    All Workflow Participants
                  </div>
                </SelectItem>
                <SelectItem value="user">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Specific User
                  </div>
                </SelectItem>
                <SelectItem value="department">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Department
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {assignedToType === "user" && (
            <div>
              <Label htmlFor="user">Select User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter((u: any) => u.status === "active")
                    .map((user: any) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name || user.email}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {assignedToType === "department" && (
            <div>
              <Label htmlFor="department">Select Department</Label>
              <Select
                value={selectedDepartmentId}
                onValueChange={setSelectedDepartmentId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a department" />
                </SelectTrigger>
                <SelectContent>
                  {allDepartments.map((dept: any) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name} {dept.companyName ? `(${dept.companyName})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {assignedToType === "all_participants" && workflowParticipants.length > 0 && (
            <div className="text-sm text-muted-foreground">
              This goal will be visible to all {workflowParticipants.length} workflow participant(s)
            </div>
          )}

          <div>
            <Label>Due Date (Optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!title.trim() || isCreating}>
            {isCreating ? "Creating..." : "Create Goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

