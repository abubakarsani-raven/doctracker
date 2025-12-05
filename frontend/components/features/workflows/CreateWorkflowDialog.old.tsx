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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, FileText, Upload, Plus } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useMockData } from "@/lib/contexts/MockDataContext";

interface CreateWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onWorkflowCreated?: () => void;
}

export function CreateWorkflowDialog({
  open,
  onOpenChange,
  onWorkflowCreated,
}: CreateWorkflowDialogProps) {
  const { documents, users, companies } = useMockData();
  const [workflowTitle, setWorkflowTitle] = useState("");
  const [workflowDescription, setWorkflowDescription] = useState("");
  const [documentSource, setDocumentSource] = useState<"existing" | "create" | "none">("existing");
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [assignedToType, setAssignedToType] = useState<"user" | "department">("user");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [creating, setCreating] = useState(false);

  // Get all departments
  const allDepartments: any[] = [];
  companies.forEach((company: any) => {
    if (company.departments) {
      company.departments.forEach((dept: any) => {
        allDepartments.push({ ...dept, companyName: company.name });
      });
    }
  });

  // Filter users by current user's context
  const accessibleUsers = users.filter((u: any) => u.status === "active");

  useEffect(() => {
    if (!open) {
      // Reset form when dialog closes
      setWorkflowTitle("");
      setWorkflowDescription("");
      setDocumentSource("existing");
      setSelectedDocumentId("");
      setAssignedToType("user");
      setSelectedUserId("");
      setSelectedDepartmentId("");
      setDueDate(undefined);
    }
  }, [open]);

  const handleCreate = async () => {
    if (!workflowTitle.trim()) {
      toast.error("Please enter a workflow title");
      return;
    }

    if (documentSource === "existing" && !selectedDocumentId) {
      toast.error("Please select a document");
      return;
    }

    if (assignedToType === "user" && !selectedUserId) {
      toast.error("Please select a user to assign to");
      return;
    }

    if (assignedToType === "department" && !selectedDepartmentId) {
      toast.error("Please select a department to assign to");
      return;
    }

    setCreating(true);

    try {
      // TODO: Replace with actual API call
      // For now, we'll add to mock data via context or localStorage
      const newWorkflow = {
        id: `wf-${Date.now()}`,
        title: workflowTitle,
        description: workflowDescription,
        documentId: documentSource === "existing" ? selectedDocumentId : undefined,
        documentName: documentSource === "existing" 
          ? documents.find((d: any) => d.id === selectedDocumentId)?.name || "New Document"
          : workflowTitle,
        status: "assigned",
        assignedTo: assignedToType === "user"
          ? {
              type: "user",
              id: selectedUserId,
              name: accessibleUsers.find((u: any) => u.id === selectedUserId)?.name || "",
            }
          : {
              type: "department",
              id: selectedDepartmentId,
              name: allDepartments.find((d: any) => d.id === selectedDepartmentId)?.name || "",
            },
        assignedBy: "Current User", // TODO: Get from context
        assignedAt: new Date().toISOString(),
        progress: 0,
        dueDate: dueDate?.toISOString(),
        currentState: "Assigned",
        routingHistory: [],
      };

      // Get existing workflows from localStorage or initialize
      const existingWorkflows = JSON.parse(localStorage.getItem("workflows") || "[]");
      existingWorkflows.push(newWorkflow);
      localStorage.setItem("workflows", JSON.stringify(existingWorkflows));

      // Dispatch event to update context
      window.dispatchEvent(new CustomEvent("workflowsUpdated"));

      toast.success("Workflow created successfully");
      onWorkflowCreated?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create workflow:", error);
      toast.error("Failed to create workflow. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Workflow</DialogTitle>
          <DialogDescription>
            Create a new workflow and assign it to a user or department
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Workflow Title */}
          <div className="space-y-2">
            <Label htmlFor="workflow-title">Workflow Title *</Label>
            <Input
              id="workflow-title"
              placeholder="e.g., Create memo for discount sales announcement"
              value={workflowTitle}
              onChange={(e) => setWorkflowTitle(e.target.value)}
              disabled={creating}
            />
          </div>

          {/* Workflow Description */}
          <div className="space-y-2">
            <Label htmlFor="workflow-description">Description</Label>
            <Textarea
              id="workflow-description"
              placeholder="Add details about this workflow..."
              value={workflowDescription}
              onChange={(e) => setWorkflowDescription(e.target.value)}
              disabled={creating}
              rows={3}
            />
          </div>

          {/* Document Source */}
          <div className="space-y-2">
            <Label>Document</Label>
            <RadioGroup
              value={documentSource}
              onValueChange={(value: "existing" | "create" | "none") => setDocumentSource(value)}
              disabled={creating}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="existing" id="existing" />
                <Label htmlFor="existing" className="font-normal cursor-pointer">
                  Use existing document
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="create" id="create" />
                <Label htmlFor="create" className="font-normal cursor-pointer">
                  Create new document
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="none" id="none" />
                <Label htmlFor="none" className="font-normal cursor-pointer">
                  No document (create later)
                </Label>
              </div>
            </RadioGroup>

            {documentSource === "existing" && (
              <Select
                value={selectedDocumentId}
                onValueChange={setSelectedDocumentId}
                disabled={creating}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a document" />
                </SelectTrigger>
                <SelectContent>
                  {documents.map((doc: any) => (
                    <SelectItem key={doc.id} value={doc.id}>
                      {doc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {documentSource === "create" && (
              <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
                Document will be created when the workflow is assigned
              </div>
            )}
          </div>

          {/* Assignment Type */}
          <div className="space-y-2">
            <Label>Assign To</Label>
            <RadioGroup
              value={assignedToType}
              onValueChange={(value: "user" | "department") => setAssignedToType(value)}
              disabled={creating}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="user" id="assign-user" />
                <Label htmlFor="assign-user" className="font-normal cursor-pointer">
                  Individual User
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="department" id="assign-dept" />
                <Label htmlFor="assign-dept" className="font-normal cursor-pointer">
                  Department
                </Label>
              </div>
            </RadioGroup>

            {assignedToType === "user" && (
              <Select
                value={selectedUserId}
                onValueChange={setSelectedUserId}
                disabled={creating}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {accessibleUsers.map((user: any) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {assignedToType === "department" && (
              <Select
                value={selectedDepartmentId}
                onValueChange={setSelectedDepartmentId}
                disabled={creating}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a department" />
                </SelectTrigger>
                <SelectContent>
                  {allDepartments.map((dept: any) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name} ({dept.companyName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Due Date */}
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
                  onSelect={setDueDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? "Creating..." : "Create Workflow"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
