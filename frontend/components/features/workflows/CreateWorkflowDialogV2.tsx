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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, Folder, FileText, FolderOpen } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useMockData } from "@/lib/contexts/MockDataContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface CreateWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onWorkflowCreated?: () => void;
  folderId?: string; // Optional: pre-select a folder
  documentId?: string; // Optional: pre-select a document (for document-based workflow)
}

export function CreateWorkflowDialog({
  open,
  onOpenChange,
  onWorkflowCreated,
  folderId,
  documentId,
}: CreateWorkflowDialogProps) {
  const { folders, documents, users, companies } = useMockData();
  
  // Workflow type: "folder" or "document"
  const [workflowType, setWorkflowType] = useState<"folder" | "document">(
    documentId ? "document" : "folder"
  );
  
  // Common fields
  const [workflowTitle, setWorkflowTitle] = useState("");
  const [workflowDescription, setWorkflowDescription] = useState("");
  const [assignedToType, setAssignedToType] = useState<"user" | "department">("user");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [creating, setCreating] = useState(false);

  // Folder-based workflow fields
  const [folderSource, setFolderSource] = useState<"existing" | "create" | "none">("existing");
  const [selectedFolderId, setSelectedFolderId] = useState(folderId || "");
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedFolderScope, setSelectedFolderScope] = useState<"company" | "department" | "division">("department");

  // Document-based workflow fields
  const [selectedDocumentId, setSelectedDocumentId] = useState(documentId || "");

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

  // Get accessible folders (root folders for now - simplified)
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
      setWorkflowTitle("");
      setWorkflowDescription("");
      setWorkflowType(documentId ? "document" : "folder");
      setFolderSource("existing");
      setSelectedFolderId(folderId || "");
      setNewFolderName("");
      setSelectedDocumentId(documentId || "");
      setAssignedToType("user");
      setSelectedUserId("");
      setSelectedDepartmentId("");
      setDueDate(undefined);
    } else {
      // Pre-fill if props provided
      if (documentId) {
        setWorkflowType("document");
        setSelectedDocumentId(documentId);
        const doc = documents.find((d: any) => d.id === documentId);
        if (doc) {
          setWorkflowTitle(`Review ${doc.name} and create counter document`);
        }
      } else if (folderId) {
        setWorkflowType("folder");
        setSelectedFolderId(folderId);
      }
    }
  }, [open, folderId, documentId, documents]);

  // Auto-generate title for document-based workflows
  useEffect(() => {
    if (workflowType === "document" && selectedDocumentId && !workflowTitle) {
      const doc = documents.find((d: any) => d.id === selectedDocumentId);
      if (doc) {
        setWorkflowTitle(`Review ${doc.name} and create counter document`);
        setWorkflowDescription(`Review the document "${doc.name}" and create a counter document based on it.`);
      }
    }
  }, [workflowType, selectedDocumentId, documents, workflowTitle]);

  const handleCreate = async () => {
    if (!workflowTitle.trim()) {
      toast.error("Please enter a workflow title");
      return;
    }

    if (workflowType === "folder") {
      if (folderSource === "existing" && !selectedFolderId) {
        toast.error("Please select a folder");
        return;
      }
      if (folderSource === "create" && !newFolderName.trim()) {
        toast.error("Please enter a folder name");
        return;
      }
    } else {
      if (!selectedDocumentId) {
        toast.error("Please select a document");
        return;
      }
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
      let finalFolderId: string | undefined;
      let folderName: string | undefined;
      let finalDocumentId: string | undefined;
      let documentName: string | undefined;

      if (workflowType === "folder") {
        // Handle folder-based workflow
        if (folderSource === "create") {
          // Create new folder
          const newFolder = {
            id: `folder-${Date.now()}`,
            name: newFolderName,
            description: `Folder for workflow: ${workflowTitle}`,
            scope: selectedFolderScope,
            documentCount: 0,
            modifiedAt: new Date().toISOString(),
            createdBy: "Current User",
            parentFolderId: null,
          };
          
          // Store in localStorage for now
          const existingFolders = JSON.parse(localStorage.getItem("folders") || "[]");
          existingFolders.push(newFolder);
          localStorage.setItem("folders", JSON.stringify(existingFolders));
          
          finalFolderId = newFolder.id;
          folderName = newFolder.name;
        } else if (folderSource === "existing" && selectedFolderId) {
          const selectedFolder = folders.find((f: any) => f.id === selectedFolderId);
          finalFolderId = selectedFolderId;
          folderName = selectedFolder?.name || "Unknown Folder";
        }
      } else {
        // Handle document-based workflow
        const selectedDocument = documents.find((d: any) => d.id === selectedDocumentId);
        finalDocumentId = selectedDocumentId;
        documentName = selectedDocument?.name || "Unknown Document";
        
        // Use document's folder if available
        if (selectedDocument?.folderId) {
          finalFolderId = selectedDocument.folderId;
          const docFolder = folders.find((f: any) => f.id === selectedDocument.folderId);
          folderName = docFolder?.name;
        }
      }

      const newWorkflow = {
        id: `wf-${Date.now()}`,
        title: workflowTitle,
        description: workflowDescription,
        type: workflowType,
        folderId: finalFolderId,
        folderName: folderName,
        folderPath: finalFolderId ? buildFolderPath(finalFolderId, folders) : undefined,
        documentId: finalDocumentId,
        documentName: documentName,
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

  const selectedDocument = selectedDocumentId 
    ? documents.find((d: any) => d.id === selectedDocumentId)
    : null;

  const selectedFolder = selectedFolderId
    ? folders.find((f: any) => f.id === selectedFolderId)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Workflow</DialogTitle>
          <DialogDescription>
            Create a folder-based or document-based workflow. Folder workflows apply to all documents in a folder.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Workflow Type Selection */}
          <div className="space-y-2">
            <Label>Workflow Type *</Label>
            <Tabs value={workflowType} onValueChange={(v) => setWorkflowType(v as "folder" | "document")} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="folder">
                  <Folder className="mr-2 h-4 w-4" />
                  Folder-Based
                </TabsTrigger>
                <TabsTrigger value="document">
                  <FileText className="mr-2 h-4 w-4" />
                  Document-Based
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="text-xs text-muted-foreground">
              {workflowType === "folder" 
                ? "All documents in the folder will be part of this workflow"
                : "Workflow is created from a specific document (e.g., 'Review contract and create counter contract')"
              }
            </p>
          </div>

          {/* Workflow Title */}
          <div className="space-y-2">
            <Label htmlFor="workflow-title">Workflow Title *</Label>
            <Input
              id="workflow-title"
              placeholder={
                workflowType === "folder"
                  ? "e.g., Create memo for discount sales announcement"
                  : "e.g., Review contract.pdf and create counter contract"
              }
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

          {/* Folder-Based Workflow Content */}
          {workflowType === "folder" && (
            <div className="space-y-2">
              <Label>Folder *</Label>
              <RadioGroup
                value={folderSource}
                onValueChange={(value: "existing" | "create" | "none") => {
                  setFolderSource(value);
                  if (value !== "existing") setSelectedFolderId("");
                }}
                disabled={creating}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="existing" id="existing-folder" />
                  <Label htmlFor="existing-folder" className="font-normal cursor-pointer">
                    Use existing folder
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="create" id="create-folder" />
                  <Label htmlFor="create-folder" className="font-normal cursor-pointer">
                    Create new folder
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="none" id="no-folder" />
                  <Label htmlFor="no-folder" className="font-normal cursor-pointer">
                    No folder (create later)
                  </Label>
                </div>
              </RadioGroup>

              {folderSource === "existing" && (
                <div className="space-y-2">
                  <Select
                    value={selectedFolderId}
                    onValueChange={setSelectedFolderId}
                    disabled={creating}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a folder" />
                    </SelectTrigger>
                    <SelectContent>
                      <ScrollArea className="max-h-[300px]">
                        {accessibleFolders.map((folder: any) => (
                          <SelectItem key={folder.id} value={folder.id}>
                            <div className="flex items-center gap-2">
                              <Folder className="h-4 w-4 text-yellow-500" />
                              <span>{folder.name}</span>
                              {folder.scope && (
                                <Badge variant="outline" className="text-xs">
                                  {folder.scope === "company" ? "Company" : folder.scope === "department" ? "Dept" : "Division"}
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </ScrollArea>
                    </SelectContent>
                  </Select>
                  {selectedFolderId && selectedFolder && (
                    <div className="p-2 bg-muted rounded-md text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <FolderOpen className="h-3 w-3" />
                        <span>Path: {buildFolderPath(selectedFolderId, folders)}</span>
                      </div>
                      {selectedFolder.description && (
                        <p className="mt-1">{selectedFolder.description}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {folderSource === "create" && (
                <div className="space-y-2">
                  <Input
                    placeholder="Enter folder name"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    disabled={creating}
                  />
                  <Select
                    value={selectedFolderScope}
                    onValueChange={(v: "company" | "department" | "division") => setSelectedFolderScope(v)}
                    disabled={creating}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select scope" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="company">Company-wide</SelectItem>
                      <SelectItem value="department">Department-wide</SelectItem>
                      <SelectItem value="division">Division-wide</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    A new folder will be created for this workflow. You can add documents to it later.
                  </p>
                </div>
              )}

              {folderSource === "none" && (
                <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
                  You can assign a folder later when the workflow is routed or updated
                </div>
              )}
            </div>
          )}

          {/* Document-Based Workflow Content */}
          {workflowType === "document" && (
            <div className="space-y-2">
              <Label>Document *</Label>
              <Select
                value={selectedDocumentId}
                onValueChange={setSelectedDocumentId}
                disabled={creating}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a document" />
                </SelectTrigger>
                <SelectContent>
                  <ScrollArea className="max-h-[300px]">
                    {documents.map((doc: any) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-500" />
                          <span>{doc.name}</span>
                          {doc.folderId && (
                            <span className="text-xs text-muted-foreground">
                              ({folders.find((f: any) => f.id === doc.folderId)?.name || "Unknown folder"})
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </ScrollArea>
                </SelectContent>
              </Select>
              {selectedDocument && (
                <div className="p-3 bg-muted rounded-md">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Selected Document:</p>
                    <p className="text-sm text-muted-foreground">{selectedDocument.name}</p>
                    {selectedDocument.description && (
                      <p className="text-xs text-muted-foreground">{selectedDocument.description}</p>
                    )}
                    {selectedDocument.folderId && (
                      <div className="flex items-center gap-1 mt-2">
                        <Folder className="h-3 w-3" />
                        <span className="text-xs">
                          In folder: {folders.find((f: any) => f.id === selectedDocument.folderId)?.name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                This workflow will be created based on the selected document. You can create actions like "Upload revised contract" at the end.
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
                        {user.name} ({user.email})
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
                    {allDepartments.map((dept: any) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name} ({dept.companyName})
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
            {creating ? "Creating..." : "Create Workflow"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
