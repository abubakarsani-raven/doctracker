"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Send, ArrowRight, ArrowLeft, Plus, User, Building2, Crown } from "lucide-react";
import { api } from "@/lib/api";
import { Separator } from "@/components/ui/separator";
import { CreateActionFromWorkflowDialog } from "./CreateActionFromWorkflowDialog";
import { 
  isCompanyAdmin, 
  getUserCompanyId, 
  getDepartmentCompanyId, 
  getUserCompanyIdByUserId, 
  createApprovalRequest, 
  isCrossCompanyAssignment,
  getCompanyName 
} from "@/lib/cross-company-utils";
import { useMockData } from "@/lib/contexts/MockDataContext";

interface WorkflowRoutingSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId: string;
}

export function WorkflowRoutingSheet({
  open,
  onOpenChange,
  workflowId,
}: WorkflowRoutingSheetProps) {
  const [routingType, setRoutingType] = useState<
    "secretary" | "department" | "individual" | "department_head" | "original_sender" | "actions"
  >("secretary");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedIndividual, setSelectedIndividual] = useState("");
  const [notes, setNotes] = useState("");
  const [routing, setRouting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [workflow, setWorkflow] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [originalSender, setOriginalSender] = useState<string>("");
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [companies, setCompanies] = useState<any[]>([]);
  const { currentUser } = useMockData();
  const isAdmin = currentUser && isCompanyAdmin(currentUser);

  useEffect(() => {
    if (open && workflowId) {
      loadWorkflowData();
    }
  }, [open, workflowId]);

  const loadWorkflowData = async () => {
    setLoading(true);
    try {
      const [workflowsData, usersData, companiesData] = await Promise.all([
        api.getWorkflows(),
        api.getUsers(),
        api.getCompanies(),
      ]);

      setCompanies(companiesData);

      // Merge with local workflows
      const localWorkflows = JSON.parse(localStorage.getItem("workflows") || "[]");
      const allWorkflows = [...workflowsData, ...localWorkflows];
      
      const currentWorkflow = allWorkflows.find((w: any) => w.id === workflowId);
      setWorkflow(currentWorkflow);
      
      if (currentWorkflow?.assignedBy) {
        setOriginalSender(currentWorkflow.assignedBy);
      }

      // Get users in the current department if workflow is assigned to a department
      if (currentWorkflow?.assignedTo?.type === "department") {
        const deptUsers = usersData.filter(
          (u: any) => u.department && u.status === "active"
        );
        setUsers(deptUsers);
      } else if (currentWorkflow?.assignedTo?.type === "user") {
        // If assigned to user, get all users from their department
        const assignedUser = usersData.find((u: any) => u.id === currentWorkflow.assignedTo.id);
        if (assignedUser?.department) {
          const deptUsers = usersData.filter(
            (u: any) => u.department === assignedUser.department && u.status === "active"
          );
          setUsers(deptUsers);
        }
      } else {
        // Get all active users
        setUsers(usersData.filter((u: any) => u.status === "active"));
      }

      // Get all departments
      const allDepartments: any[] = [];
      companiesData.forEach((company: any) => {
        if (company.departments) {
          company.departments.forEach((dept: any) => {
            allDepartments.push({ ...dept, companyName: company.name });
          });
        }
      });
      setDepartments(allDepartments);

    } catch (error) {
      console.error("Failed to load workflow data:", error);
      toast.error("Failed to load workflow information");
    } finally {
      setLoading(false);
    }
  };

  // Get department heads
  const getDepartmentHeads = () => {
    return users.filter((u: any) => u.role === "Department Head");
  };

  // Get users in current department
  const getCurrentDepartmentUsers = () => {
    if (!workflow?.assignedTo) return [];
    
    if (workflow.assignedTo.type === "department") {
      return users.filter((u: any) => {
        const dept = departments.find((d: any) => d.id === workflow.assignedTo.id);
        return dept && u.department === dept.name;
      });
    } else if (workflow.assignedTo.type === "user") {
      const assignedUser = users.find((u: any) => u.id === workflow.assignedTo.id);
      if (assignedUser?.department) {
        return users.filter((u: any) => u.department === assignedUser.department);
      }
    }
    return users;
  };

  const handleRoute = async () => {
    if (routingType === "actions") {
      // Open action creation dialog instead
      setActionDialogOpen(true);
      return;
    }

    if (routingType === "department" && !selectedDepartment) {
      toast.error("Please select a department");
      return;
    }
    if (routingType === "individual" && !selectedIndividual) {
      toast.error("Please select an individual");
      return;
    }

    if (!workflow) {
      toast.error("Workflow not found");
      return;
    }

    setRouting(true);

    try {
      // Determine new assignee based on routing type
      let newAssignedTo: any = null;
      let message = "";
      let routingHistoryEntry: any = {
        from: workflow.assignedTo || { type: "unknown", name: "Unknown" },
        routedBy: "Current User", // TODO: Get from context
        routedAt: new Date().toISOString(),
        notes: notes || undefined,
        routingType: routingType,
      };

      switch (routingType) {
        case "secretary": {
          // Route to secretary - find secretary role user
          const secretary = users.find((u: any) => u.role === "Secretary" || u.role?.toLowerCase().includes("secretary"));
          if (secretary) {
            newAssignedTo = {
              type: "user",
              id: secretary.id,
              name: secretary.name,
            };
            message = `Workflow returned to secretary (${secretary.name})`;
          } else {
            toast.error("Secretary not found");
            return;
          }
          break;
        }
        case "department": {
          const dept = departments.find((d: any) => d.id === selectedDepartment);
          if (dept) {
            newAssignedTo = {
              type: "department",
              id: dept.id,
              name: dept.name,
            };
            message = `Workflow routed to ${dept.name}`;
          }
          break;
        }
        case "individual": {
          const user = users.find((u: any) => u.id === selectedIndividual);
          if (user) {
            newAssignedTo = {
              type: "user",
              id: user.id,
              name: user.name,
            };
            message = `Workflow routed to ${user.name}`;
          }
          break;
        }
        case "department_head": {
          const head = departmentHeads[0];
          if (head) {
            newAssignedTo = {
              type: "user",
              id: head.id,
              name: head.name,
            };
            message = `Workflow routed to department head (${head.name})`;
          }
          break;
        }
        case "original_sender": {
          // Find original sender user
          const sender = users.find((u: any) => u.name === originalSender);
          if (sender) {
            newAssignedTo = {
              type: "user",
              id: sender.id,
              name: sender.name,
            };
            message = `Workflow routed back to ${originalSender}`;
          } else {
            // If user not found, create generic entry
            newAssignedTo = {
              type: "user",
              name: originalSender,
            };
            message = `Workflow routed back to ${originalSender}`;
          }
          break;
        }
      }

      if (!newAssignedTo) {
        toast.error("Unable to determine new assignee");
        return;
      }

      routingHistoryEntry.to = newAssignedTo;

      // Check if cross-company routing
      const currentUserStr = localStorage.getItem("mockCurrentUser");
      const currentUserData = currentUserStr ? JSON.parse(currentUserStr) : currentUser;
      const sourceCompanyId = workflow.sourceCompanyId || (await getUserCompanyId(currentUserData));
      
      let targetCompanyId: string | null = null;
      if (newAssignedTo.type === "department") {
        targetCompanyId = await getDepartmentCompanyId(newAssignedTo.id);
      } else if (newAssignedTo.type === "user") {
        targetCompanyId = await getUserCompanyIdByUserId(newAssignedTo.id);
      }

      // Use selected company if admin selected one
      if (isAdmin && selectedCompanyId) {
        targetCompanyId = selectedCompanyId;
      }

      const isCrossCompany = isCrossCompanyAssignment(sourceCompanyId, targetCompanyId);

      // If cross-company, create approval request instead of direct routing
      if (isCrossCompany && isAdmin && targetCompanyId && sourceCompanyId) {
        const sourceCompanyName = workflow.sourceCompanyName || (await getCompanyName(sourceCompanyId)) || "Unknown Company";
        const targetCompanyName = await getCompanyName(targetCompanyId) || "Unknown Company";

        const approvalRequest = createApprovalRequest({
          workflowId: workflow.id,
          requestType: "workflow_routing",
          sourceCompanyId,
          sourceCompanyName,
          targetCompanyId,
          targetCompanyName,
          requestedBy: currentUserData?.id || currentUserData?.name || "Unknown",
          assignedTo: newAssignedTo,
          workflowTitle: workflow.title,
          workflowDescription: workflow.description,
          routingNotes: notes,
        });

        // Update workflow status to pending
        const workflows = await api.getWorkflows();
        const localWorkflows = JSON.parse(localStorage.getItem("workflows") || "[]");
        const allWorkflows = [...workflows, ...localWorkflows];
        const workflowIndex = allWorkflows.findIndex((w: any) => w.id === workflowId);

        if (workflowIndex !== -1) {
          const updatedWorkflow = {
            ...allWorkflows[workflowIndex],
            approvalStatus: "pending",
            status: "pending",
          };

          const localIndex = localWorkflows.findIndex((w: any) => w.id === workflowId);
          if (localIndex !== -1) {
            localWorkflows[localIndex] = updatedWorkflow;
          } else {
            localWorkflows.push(updatedWorkflow);
          }
          localStorage.setItem("workflows", JSON.stringify(localWorkflows));
        }

        // Create notification
        const notifications = JSON.parse(localStorage.getItem("notifications") || "[]");
        notifications.push({
          id: `notif-${Date.now()}`,
          type: "cross_company_approval_request",
          title: "Cross-Company Workflow Routing Approval",
          message: `${sourceCompanyName} has requested to route a workflow to ${newAssignedTo.name} in your company.`,
          resourceType: "approval_request",
          resourceId: approvalRequest.id,
          read: false,
          createdAt: new Date().toISOString(),
        });
        localStorage.setItem("notifications", JSON.stringify(notifications));
        window.dispatchEvent(new CustomEvent("notificationsUpdated"));
        window.dispatchEvent(new CustomEvent("workflowsUpdated"));

        toast.success(`Routing requested. Approval pending from ${targetCompanyName}.`);
        setRouting(false);
        onOpenChange(false);
        return;
      }

      // Update workflow (normal same-company routing)
      const workflows = await api.getWorkflows();
      const localWorkflows = JSON.parse(localStorage.getItem("workflows") || "[]");
      const allWorkflows = [...workflows, ...localWorkflows];
      const workflowIndex = allWorkflows.findIndex((w: any) => w.id === workflowId);

      if (workflowIndex === -1) {
        toast.error("Workflow not found");
        return;
      }

      // Add company context to routing history if cross-company
      if (isCrossCompany) {
        routingHistoryEntry.isCrossCompany = true;
        routingHistoryEntry.routingType = "cross_company";
        routingHistoryEntry.sourceCompanyId = sourceCompanyId;
        routingHistoryEntry.targetCompanyId = targetCompanyId;
      }
      
      const updatedWorkflow = {
        ...allWorkflows[workflowIndex],
        assignedTo: newAssignedTo,
        status: "assigned", // Reset to assigned when routed
        routingHistory: [
          ...(allWorkflows[workflowIndex].routingHistory || []),
          routingHistoryEntry,
        ],
      };

      // Update in localStorage
      const localIndex = localWorkflows.findIndex((w: any) => w.id === workflowId);
      if (localIndex !== -1) {
        localWorkflows[localIndex] = updatedWorkflow;
        localStorage.setItem("workflows", JSON.stringify(localWorkflows));
      } else {
        // Add to local workflows if not there
        localWorkflows.push(updatedWorkflow);
        localStorage.setItem("workflows", JSON.stringify(localWorkflows));
      }

      // Dispatch event to update UI
      window.dispatchEvent(new CustomEvent("workflowsUpdated"));

      // Create notifications
      const notifications = JSON.parse(localStorage.getItem("notifications") || "[]");
      
      // Notify new assignee
      const assigneeNotification = {
        id: `notif-${Date.now()}-1`,
        type: "workflow_assigned",
        title: "Workflow Assigned",
        message: `Workflow "${workflow.title || workflow.folderName || workflow.documentName || 'Untitled'}" has been assigned to you`,
        resourceType: "workflow",
        resourceId: workflowId,
        read: false,
        createdAt: new Date().toISOString(),
      };
      notifications.push(assigneeNotification);

      // Notify previous assignee if different
      if (workflow.assignedTo && 
          (workflow.assignedTo.id !== newAssignedTo.id || 
           workflow.assignedTo.type !== newAssignedTo.type)) {
        const previousAssigneeNotification = {
          id: `notif-${Date.now()}-2`,
          type: "workflow_routed",
          title: "Workflow Routed",
          message: `Workflow "${workflow.title || workflow.folderName || workflow.documentName || 'Untitled'}" has been routed away from you`,
          resourceType: "workflow",
          resourceId: workflowId,
          read: false,
          createdAt: new Date().toISOString(),
        };
        notifications.push(previousAssigneeNotification);
      }

      // Notify workflow creator
      if (workflow.assignedBy && workflow.assignedBy !== "Current User") {
        const creatorNotification = {
          id: `notif-${Date.now()}-3`,
          type: "workflow_routed",
          title: "Workflow Routed",
          message: `Workflow "${workflow.title || workflow.folderName || workflow.documentName || 'Untitled'}" has been routed`,
          resourceType: "workflow",
          resourceId: workflowId,
          read: false,
          createdAt: new Date().toISOString(),
        };
        notifications.push(creatorNotification);
      }

      localStorage.setItem("notifications", JSON.stringify(notifications));
      window.dispatchEvent(new CustomEvent("notificationsUpdated"));

      toast.success(message);
      
      // Reset form
      setRoutingType("secretary");
      setSelectedDepartment("");
      setSelectedIndividual("");
      setSelectedCompanyId("");
      setNotes("");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to route workflow:", error);
      toast.error("Failed to route workflow. Please try again.");
    } finally {
      setRouting(false);
    }
  };

  const departmentHeads = getDepartmentHeads();
  const currentDeptUsers = getCurrentDepartmentUsers();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Route Document</SheetTitle>
          <SheetDescription>
            Choose how to proceed with this document workflow
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        ) : (
          <div className="space-y-6 mt-6">
            <RadioGroup
              value={routingType}
              onValueChange={(value: any) => {
                setRoutingType(value);
                setSelectedDepartment("");
                setSelectedIndividual("");
              }}
            >
              <div className="flex items-start space-x-2 space-y-0 rounded-md border p-4">
                <RadioGroupItem value="secretary" id="secretary" className="mt-1" />
                <div className="space-y-1 leading-none flex-1">
                  <Label htmlFor="secretary" className="cursor-pointer font-medium">
                    Send back to Secretary
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Return the document to the secretary for final review
                  </p>
                </div>
              </div>

              {originalSender && (
                <div className="flex items-start space-x-2 space-y-0 rounded-md border p-4">
                  <RadioGroupItem value="original_sender" id="original_sender" className="mt-1" />
                  <div className="space-y-1 leading-none flex-1">
                    <Label htmlFor="original_sender" className="cursor-pointer font-medium flex items-center gap-2">
                      Route to Original Sender
                      <User className="h-3 w-3" />
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Send back to {originalSender} (who assigned this document)
                    </p>
                  </div>
                </div>
              )}

              {departmentHeads.length > 0 && (
                <div className="flex items-start space-x-2 space-y-0 rounded-md border p-4">
                  <RadioGroupItem value="department_head" id="department_head" className="mt-1" />
                  <div className="space-y-1 leading-none flex-1">
                    <Label htmlFor="department_head" className="cursor-pointer font-medium flex items-center gap-2">
                      Route to Department Head
                      <Crown className="h-3 w-3" />
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Forward to your department head for review
                    </p>
                  </div>
                </div>
              )}

              {currentDeptUsers.length > 0 && (
                <div className="flex items-start space-x-2 space-y-0 rounded-md border p-4">
                  <RadioGroupItem value="individual" id="individual" className="mt-1" />
                  <div className="space-y-1 leading-none flex-1">
                    <Label htmlFor="individual" className="cursor-pointer font-medium">
                      Route to Individual in Department
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Assign to a specific person in your department
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-start space-x-2 space-y-0 rounded-md border p-4">
                <RadioGroupItem value="department" id="department" className="mt-1" />
                <div className="space-y-1 leading-none flex-1">
                  <Label htmlFor="department" className="cursor-pointer font-medium">
                    Route to Another Department
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Forward the document to a different department for processing
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-2 space-y-0 rounded-md border p-4">
                <RadioGroupItem value="actions" id="actions" className="mt-1" />
                <div className="space-y-1 leading-none flex-1">
                  <Label htmlFor="actions" className="cursor-pointer font-medium">
                    Add Actions/Resolutions
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Create action items that need to be tracked and completed
                  </p>
                </div>
              </div>
            </RadioGroup>

            {/* Company Selector for Cross-Company Routing (Admin only) */}
            {isAdmin && (routingType === "department" || routingType === "individual") && (
              <div className="space-y-2">
                <Label>Target Company (Optional - for cross-company routing)</Label>
                <Select
                  value={selectedCompanyId}
                  onValueChange={(value) => {
                    setSelectedCompanyId(value);
                    setSelectedDepartment("");
                    setSelectedIndividual("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select company (leave empty for same company)" />
                  </SelectTrigger>
                  <SelectContent>
                    <ScrollArea className="max-h-[200px]">
                      <SelectItem value="">Same Company</SelectItem>
                      {companies.map((company: any) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Select a different company to route cross-company (requires approval)
                </p>
              </div>
            )}

            {routingType === "department" && (
              <div className="space-y-2">
                <Label>Select Department</Label>
                <Select 
                  value={selectedDepartment} 
                  onValueChange={setSelectedDepartment}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose department..." />
                  </SelectTrigger>
                  <SelectContent>
                    <ScrollArea className="max-h-[200px]">
                      {(selectedCompanyId
                        ? departments.filter((d: any) => {
                            const deptCompany = companies.find((c: any) => 
                              c.departments?.some((dept: any) => dept.id === d.id)
                            );
                            return deptCompany?.id === selectedCompanyId;
                          })
                        : departments
                      ).map((dept: any) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-3 w-3" />
                            <span>{dept.name}</span>
                            {dept.companyName && (
                              <span className="text-xs text-muted-foreground">
                                ({dept.companyName})
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              </div>
            )}

            {routingType === "individual" && (
              <div className="space-y-2">
                <Label>Select Individual</Label>
                <Select value={selectedIndividual} onValueChange={setSelectedIndividual}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose person..." />
                  </SelectTrigger>
                  <SelectContent>
                    <ScrollArea className="max-h-[200px]">
                      {(selectedCompanyId
                        ? users.filter((u: any) => {
                            // Filter users by selected company
                            const userCompany = companies.find((c: any) => {
                              if (!c.departments) return false;
                              return c.departments.some((d: any) => 
                                u.department === d.id || u.department === d.name
                              );
                            });
                            return userCompany?.id === selectedCompanyId;
                          })
                        : currentDeptUsers
                      ).map((user: any) => (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3" />
                            <span>{user.name}</span>
                            {user.role && (
                              <span className="text-xs text-muted-foreground">
                                ({user.role})
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              </div>
            )}

            {routingType === "department_head" && departmentHeads.length > 0 && (
              <div className="space-y-2">
                <Label>Department Head</Label>
                <div className="p-3 border rounded-md bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4 text-yellow-600" />
                    <div>
                      <p className="font-medium text-sm">
                        {departmentHeads.map((h: any) => h.name).join(", ")}
                      </p>
                      <p className="text-xs text-muted-foreground">Department Head</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {routingType === "original_sender" && originalSender && (
              <div className="space-y-2">
                <Label>Original Sender</Label>
                <div className="p-3 border rounded-md bg-muted/50">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <div>
                      <p className="font-medium text-sm">{originalSender}</p>
                      <p className="text-xs text-muted-foreground">Who assigned this document</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes or instructions..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>
        )}

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={routing || loading}>
            Cancel
          </Button>
          <Button
            onClick={handleRoute}
            disabled={
              routing ||
              loading ||
              (routingType === "department" && !selectedDepartment) ||
              (routingType === "individual" && !selectedIndividual)
            }
          >
            {routing ? (
              "Routing..."
            ) : (
              <>
                {routingType === "secretary" && (
                  <>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Send to Secretary
                  </>
                )}
                {routingType === "original_sender" && (
                  <>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Send to {originalSender}
                  </>
                )}
                {routingType === "department_head" && (
                  <>
                    <Crown className="mr-2 h-4 w-4" />
                    Route to Department Head
                  </>
                )}
                {routingType === "individual" && (
                  <>
                    <User className="mr-2 h-4 w-4" />
                    Route to Individual
                  </>
                )}
                {routingType === "department" && (
                  <>
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Route to Department
                  </>
                )}
            {routingType === "actions" && (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Create Action
              </>
            )}
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>

      {/* Create Action Dialog */}
      <CreateActionFromWorkflowDialog
        open={actionDialogOpen}
        onOpenChange={(open) => {
          setActionDialogOpen(open);
          if (!open) {
            // Close routing sheet after action is created
            onOpenChange(false);
          }
        }}
        workflowId={workflowId}
        workflow={workflow}
        onActionCreated={() => {
          toast.success("Action created and notifications sent to assigned parties");
        }}
      />
    </Sheet>
  );
}
