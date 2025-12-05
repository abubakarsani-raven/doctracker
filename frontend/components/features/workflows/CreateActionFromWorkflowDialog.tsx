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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, User, Building2, Upload, MessageSquare, CheckCircle2, Folder } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useMockData } from "@/lib/contexts/MockDataContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  isCompanyAdmin,
  getUserCompanyId,
  getDepartmentCompanyId,
  getUserCompanyIdByUserId,
  createApprovalRequest,
  isCrossCompanyAssignment,
  getCompanyName,
} from "@/lib/cross-company-utils";

interface CreateActionFromWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId: string;
  workflow?: any;
  onActionCreated?: () => void;
}

export function CreateActionFromWorkflowDialog({
  open,
  onOpenChange,
  workflowId,
  workflow,
  onActionCreated,
}: CreateActionFromWorkflowDialogProps) {
  const { folders, users, companies } = useMockData();
  
  // Action type selection
  const [actionType, setActionType] = useState<"regular" | "document_upload" | "request_response">("regular");
  
  // Common fields
  const [actionTitle, setActionTitle] = useState("");
  const [actionDescription, setActionDescription] = useState("");
  const [assignedToType, setAssignedToType] = useState<"user" | "department">("user");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [creating, setCreating] = useState(false);

  // Document upload action fields
  const [targetFolderId, setTargetFolderId] = useState<string>("");
  const [requiredFileType, setRequiredFileType] = useState<string>("");

  // Request/response action fields
  const [requestDetails, setRequestDetails] = useState("");

  // Cross-company fields
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("same-company");
  const { currentUser } = useMockData();
  const isAdmin = currentUser && isCompanyAdmin(currentUser);

  // Get all departments
  const allDepartments: any[] = [];
  companies.forEach((company: any) => {
    if (company.departments) {
      company.departments.forEach((dept: any) => {
        allDepartments.push({ ...dept, companyName: company.name });
      });
    }
  });

  // Filter users based on selected company
  const accessibleUsers = useMemo(() => {
    if (!isAdmin || !selectedCompanyId || selectedCompanyId === "same-company") {
      return users.filter((u: any) => u.status === "active");
    }
    const selectedCompany = companies.find((c: any) => c.id === selectedCompanyId);
    if (!selectedCompany) return users.filter((u: any) => u.status === "active");
    
    const companyDeptIds = selectedCompany.departments?.map((d: any) => d.id) || [];
    const companyDeptNames = selectedCompany.departments?.map((d: any) => d.name) || [];
    return users.filter((u: any) => {
      if (u.status !== "active") return false;
      return companyDeptIds.includes(u.department) || 
             companyDeptNames.includes(u.department) ||
             companyDeptIds.some((deptId: string) => {
               const dept = selectedCompany.departments?.find((d: any) => d.id === deptId);
               return u.department === dept?.name;
             });
    });
  }, [users, selectedCompanyId, isAdmin, companies]);

  // Filter departments based on selected company
  const accessibleDepartments = useMemo(() => {
    if (!isAdmin || !selectedCompanyId || selectedCompanyId === "same-company") {
      return allDepartments;
    }
    return allDepartments.filter((d: any) => {
      const deptCompany = companies.find((c: any) => 
        c.departments?.some((dept: any) => dept.id === d.id)
      );
      return deptCompany?.id === selectedCompanyId;
    });
  }, [allDepartments, selectedCompanyId, isAdmin, companies]);

  // Get accessible folders (for document upload actions)
  const accessibleFolders = useMemo(() => {
    return folders.filter((f: any) => !f.parentFolderId);
  }, [folders]);

  // Build folder path helper
  const buildFolderPath = (folderId: string, allFolders: any[]): string => {
    const folder = allFolders.find((f: any) => f.id === folderId);
    if (!folder) return "";
    
    if (folder.parentFolderId) {
      const parentPath = buildFolderPath(folder.parentFolderId, allFolders);
      return parentPath ? `${parentPath} / ${folder.name}` : folder.name;
    }
    return folder.name;
  };

  useEffect(() => {
    if (!open) {
      // Reset form when dialog closes
      setActionTitle("");
      setActionDescription("");
      setActionType("regular");
      setAssignedToType("user");
      setSelectedUserId("");
      setSelectedDepartmentId("");
      setDueDate(undefined);
      setTargetFolderId("");
      setRequiredFileType("");
      setRequestDetails("");
      setSelectedCompanyId("same-company");
      
      // Pre-select workflow folder if available
      if (workflow?.folderId) {
        setTargetFolderId(workflow.folderId);
      }
    } else if (workflow?.folderId && actionType === "document_upload") {
      // Pre-select workflow folder for document upload actions
      setTargetFolderId(workflow.folderId);
    }
  }, [open, workflow, actionType]);

  // Auto-generate titles based on action type
  useEffect(() => {
    if (actionType === "document_upload" && !actionTitle) {
      setActionTitle("Upload revised document");
    } else if (actionType === "request_response" && !actionTitle && !requestDetails) {
      setActionTitle("Request information");
    }
  }, [actionType, actionTitle, requestDetails]);

  const handleCreate = async () => {
    if (!actionTitle.trim()) {
      toast.error("Please enter an action title");
      return;
    }

    if (actionType === "document_upload" && !targetFolderId) {
      toast.error("Please select a target folder for the uploaded document");
      return;
    }

    if (actionType === "request_response" && !requestDetails.trim()) {
      toast.error("Please enter request details");
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
      // Get current user and their company
      const currentUserStr = localStorage.getItem("mockCurrentUser");
      const currentUserData = currentUserStr ? JSON.parse(currentUserStr) : currentUser;
      const sourceCompanyId = workflow?.sourceCompanyId || (await getUserCompanyId(currentUserData));

      // Determine target company
      let targetCompanyId: string | null = null;
      let targetCompanyName: string | null = null;
      
      if (assignedToType === "department") {
        targetCompanyId = await getDepartmentCompanyId(selectedDepartmentId);
        if (targetCompanyId) {
          targetCompanyName = await getCompanyName(targetCompanyId);
        }
      } else if (assignedToType === "user") {
        targetCompanyId = await getUserCompanyIdByUserId(selectedUserId);
        if (targetCompanyId) {
          targetCompanyName = await getCompanyName(targetCompanyId);
        }
      }

      // Use selected company if admin selected one
      if (isAdmin && selectedCompanyId && selectedCompanyId !== "same-company") {
        targetCompanyId = selectedCompanyId;
        targetCompanyName = await getCompanyName(selectedCompanyId);
      }

      // Check if cross-company
      const isCrossCompany = isCrossCompanyAssignment(sourceCompanyId, targetCompanyId);

      // Find user or department name with multiple fallbacks
      const assignedTo = assignedToType === "user"
        ? {
            type: "user" as const,
            id: selectedUserId,
            name: accessibleUsers.find((u: any) => u.id === selectedUserId)?.name || 
                  users.find((u: any) => u.id === selectedUserId)?.name || 
                  `User (${selectedUserId})`,
          }
        : {
            type: "department" as const,
            id: selectedDepartmentId,
            name: (selectedCompanyId && selectedCompanyId !== "same-company" ? accessibleDepartments : allDepartments).find((d: any) => d.id === selectedDepartmentId)?.name || 
                  allDepartments.find((d: any) => d.id === selectedDepartmentId)?.name || 
                  `Department (${selectedDepartmentId})`,
          };

      const newAction: any = {
        id: `action-${Date.now()}`,
        title: actionTitle,
        description: actionDescription,
        type: actionType,
        status: isCrossCompany ? "pending" : "pending", // Pending until approved if cross-company
        workflowId: workflowId,
        folderId: workflow?.folderId,
        documentId: workflow?.documentId,
        documentName: workflow?.documentName || workflow?.title || "",
        
        // Document upload action specific
        targetFolderId: actionType === "document_upload" ? targetFolderId : undefined,
        requiredFileType: actionType === "document_upload" && requiredFileType ? requiredFileType : undefined,
        
        // Request/response action specific
        requestDetails: actionType === "request_response" ? requestDetails : undefined,
        
        assignedTo,
        createdBy: currentUserData?.name || currentUserData?.id || "Current User",
        createdAt: new Date().toISOString(),
        dueDate: dueDate?.toISOString(),
        
        // Cross-company fields
        sourceCompanyId: sourceCompanyId || undefined,
        targetCompanyId: targetCompanyId || undefined,
        isCrossCompany,
        approvalStatus: isCrossCompany ? "pending" : undefined,
        approvalRequestId: undefined, // Will be set when approval request is created
      };

      // If cross-company, create approval request
      if (isCrossCompany && isAdmin && targetCompanyId && sourceCompanyId) {
        const sourceCompanyName = workflow?.sourceCompanyName || (await getCompanyName(sourceCompanyId)) || "Unknown Company";

        const approvalRequest = createApprovalRequest({
          actionId: newAction.id,
          requestType: "action_assignment",
          sourceCompanyId,
          sourceCompanyName,
          targetCompanyId,
          targetCompanyName: targetCompanyName || "Unknown Company",
          requestedBy: currentUserData?.id || currentUserData?.name || "Unknown",
          assignedTo,
          actionTitle: actionTitle,
          actionDescription: actionDescription,
        });

        // Link approval request to action
        newAction.approvalRequestId = approvalRequest.id;

        // Create notification for target company admin
        const notifications = JSON.parse(localStorage.getItem("notifications") || "[]");
        notifications.push({
          id: `notif-${Date.now()}`,
          type: "cross_company_approval_request",
          title: "Cross-Company Action Approval Request",
          message: `${sourceCompanyName} has requested to assign an action to ${assignedTo.name} in your company.`,
          resourceType: "approval_request",
          resourceId: approvalRequest.id,
          read: false,
          createdAt: new Date().toISOString(),
        });
        localStorage.setItem("notifications", JSON.stringify(notifications));
        window.dispatchEvent(new CustomEvent("notificationsUpdated"));

        toast.success(`Action created. Approval requested from ${targetCompanyName}.`);
      } else {
        // Same-company assignment - create notification for assignee
        const notifications = JSON.parse(localStorage.getItem("notifications") || "[]");
        const notification = {
          id: `notif-${Date.now()}`,
          type: actionType === "request_response" ? "action_request" : "action_assigned",
          title: actionType === "request_response" ? "Information Request" : "New Action Assigned",
          message: actionType === "request_response"
            ? `You have received a request: "${actionTitle}"`
            : `You have been assigned a new action: "${actionTitle}"`,
          resourceType: "action",
          resourceId: newAction.id,
          read: false,
          createdAt: new Date().toISOString(),
        };
        notifications.push(notification);
        localStorage.setItem("notifications", JSON.stringify(notifications));
        window.dispatchEvent(new CustomEvent("notificationsUpdated"));
        toast.success("Action created successfully");
      }

      // Get existing actions from localStorage or initialize
      const existingActions = JSON.parse(localStorage.getItem("actions") || "[]");
      existingActions.push(newAction);
      localStorage.setItem("actions", JSON.stringify(existingActions));

      // Dispatch event to update context
      window.dispatchEvent(new CustomEvent("actionsUpdated"));

      onActionCreated?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create action:", error);
      toast.error("Failed to create action. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const selectedFolder = targetFolderId
    ? folders.find((f: any) => f.id === targetFolderId)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Action from Workflow</DialogTitle>
          <DialogDescription>
            Create an action item linked to this workflow. Choose the action type based on what needs to be done.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Action Type Selection */}
          <div className="space-y-2">
            <Label>Action Type *</Label>
            <Tabs value={actionType} onValueChange={(v) => setActionType(v as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="regular">
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Regular
                </TabsTrigger>
                <TabsTrigger value="document_upload">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Document
                </TabsTrigger>
                <TabsTrigger value="request_response">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Request/Response
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="text-xs text-muted-foreground">
              {actionType === "regular" && "Standard action that requires completion"}
              {actionType === "document_upload" && "Action requires uploading a document (e.g., 'Upload revised contract')"}
              {actionType === "request_response" && "Interactive action to request information from another department"}
            </p>
          </div>

          {/* Action Title */}
          <div className="space-y-2">
            <Label htmlFor="action-title">Action Title *</Label>
            <Input
              id="action-title"
              placeholder={
                actionType === "document_upload"
                  ? "e.g., Upload revised contract"
                  : actionType === "request_response"
                  ? "e.g., Request total budget from Accounts department"
                  : "e.g., Issue company-wide notice about discount sales"
              }
              value={actionTitle}
              onChange={(e) => setActionTitle(e.target.value)}
              disabled={creating}
            />
          </div>

          {/* Action Description */}
          <div className="space-y-2">
            <Label htmlFor="action-description">Description</Label>
            <Textarea
              id="action-description"
              placeholder="Add details about this action..."
              value={actionDescription}
              onChange={(e) => setActionDescription(e.target.value)}
              disabled={creating}
              rows={3}
            />
          </div>

          {/* Linked Workflow Info */}
          {workflow && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm font-medium mb-1">Linked to Workflow:</p>
              <p className="text-sm text-muted-foreground">
                {workflow.folderName || workflow.documentName || workflow.title || "Untitled Workflow"}
              </p>
              {workflow.folderPath && (
                <p className="text-xs text-muted-foreground mt-1">Folder: {workflow.folderPath}</p>
              )}
            </div>
          )}

          {/* Document Upload Action Specific Fields */}
          {actionType === "document_upload" && (
            <div className="space-y-4 p-4 border rounded-md bg-muted/50">
              <div className="space-y-2">
                <Label htmlFor="target-folder">Target Folder *</Label>
                <Select
                  value={targetFolderId}
                  onValueChange={setTargetFolderId}
                  disabled={creating}
                >
                  <SelectTrigger id="target-folder">
                    <SelectValue placeholder="Select folder to save uploaded document" />
                  </SelectTrigger>
                  <SelectContent>
                    <ScrollArea className="max-h-[200px]">
                      {accessibleFolders.map((folder: any) => (
                        <SelectItem key={folder.id} value={folder.id}>
                          <div className="flex items-center gap-2">
                            <Folder className="h-4 w-4 text-yellow-500" />
                            <span>{folder.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>
                {selectedFolder && (
                  <p className="text-xs text-muted-foreground">
                    Document will be saved to: {buildFolderPath(targetFolderId, folders)}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="file-type">Required File Type (Optional)</Label>
                <Input
                  id="file-type"
                  placeholder="e.g., PDF, DOCX, or leave empty for any"
                  value={requiredFileType}
                  onChange={(e) => setRequiredFileType(e.target.value)}
                  disabled={creating}
                />
              </div>
            </div>
          )}

          {/* Request/Response Action Specific Fields */}
          {actionType === "request_response" && (
            <div className="space-y-4 p-4 border rounded-md bg-muted/50">
              <div className="space-y-2">
                <Label htmlFor="request-details">Request Details *</Label>
                <Textarea
                  id="request-details"
                  placeholder="e.g., Please provide the total budget for this year. We need this information to proceed with the marketing campaign planning."
                  value={requestDetails}
                  onChange={(e) => setRequestDetails(e.target.value)}
                  disabled={creating}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  The assigned party will receive this request and can respond with the information needed. The workflow will continue once they respond.
                </p>
              </div>
            </div>
          )}

          {/* Company Selection (for Company Admin) */}
          {isAdmin && (
            <div className="space-y-2">
              <Label>Target Company (Optional - for cross-company actions)</Label>
              <Select
                value={selectedCompanyId || "same-company"}
                onValueChange={(value) => {
                  setSelectedCompanyId(value);
                  setSelectedUserId("");
                  setSelectedDepartmentId("");
                }}
                disabled={creating}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  <ScrollArea className="max-h-[200px]">
                    <SelectItem value="same-company">Same Company</SelectItem>
                    {companies.map((company: any) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </ScrollArea>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select a different company to create a cross-company action (requires approval)
              </p>
            </div>
          )}

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
                  <ScrollArea className="max-h-[200px]">
                    {accessibleUsers.map((user: any) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center gap-2">
                          <span>{user.name}</span>
                          <span className="text-muted-foreground">({user.email})</span>
                          {user.department && (
                            <Badge variant="outline" className="text-xs">
                              {user.department}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </ScrollArea>
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
                  <ScrollArea className="max-h-[200px]">
                    {(selectedCompanyId && selectedCompanyId !== "same-company" ? accessibleDepartments : allDepartments).map((dept: any) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        <div className="flex items-center gap-2">
                          <span>{dept.name}</span>
                          {dept.companyName && (
                            <Badge variant="outline" className="text-xs">
                              {dept.companyName}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </ScrollArea>
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
            {creating ? "Creating..." : "Create Action"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
