"use client";

import { useState, useMemo, useEffect } from "react";
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
import { toast } from "sonner";
import { Send, ArrowRight, ArrowLeft, Plus, User, Building2, Crown, FileText } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  isCompanyAdmin,
  getUserCompanyId,
  getDepartmentCompanyId,
  getUserCompanyIdByUserId,
  isCrossCompanyAssignment,
  getCompanyName,
} from "@/lib/cross-company-utils";
import { useWorkflow } from "@/lib/hooks/use-workflows";
import { useUsers } from "@/lib/hooks/use-users";
import { useCompanies } from "@/lib/hooks/use-companies";
import { useCurrentUser } from "@/lib/hooks/use-users";
import { useUpdateWorkflow } from "@/lib/hooks/use-workflows";
import { useCreateApprovalRequest } from "@/lib/hooks/use-approval-requests";

interface WorkflowRoutingSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId: string;
  /** Prefer opening create-action on the page so it is not nested in the Sheet. */
  onRequestCreateAction?: () => void;
}

export function WorkflowRoutingSheet({
  open,
  onOpenChange,
  workflowId,
  onRequestCreateAction,
}: WorkflowRoutingSheetProps) {
  // Fetch workflow data first
  const { data: workflow, isLoading: workflowLoading } = useWorkflow(workflowId);
  const { data: users = [] } = useUsers();
  const { data: companies = [] } = useCompanies();
  const { data: currentUser } = useCurrentUser();
  const updateWorkflow = useUpdateWorkflow();
  const createApprovalRequest = useCreateApprovalRequest();

  const [routingType, setRoutingType] = useState<
    "secretary" | "department" | "individual" | "department_head" | "original_sender" | "actions" | "file_documents"
  >("secretary");
  
  // Check if current user is a secretary
  const isSecretary = currentUser?.role === "Department Secretary" || currentUser?.role?.toLowerCase().includes("secretary");
  
  // Reset routing type based on workflow status
  useEffect(() => {
    // Secretary can file workflows that are ready_for_review or completed
    if (isSecretary && (workflow?.status === "completed" || workflow?.status === "ready_for_review")) {
      setRoutingType("file_documents");
    } else if (workflow?.status === "completed") {
      setRoutingType("file_documents");
    } else {
      setRoutingType("secretary");
    }
  }, [workflow?.status, isSecretary]);
  
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedIndividual, setSelectedIndividual] = useState("");
  const [notes, setNotes] = useState("");

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const isAdmin = currentUser && isCompanyAdmin(currentUser);

  const loading = workflowLoading;
  const isRouting = updateWorkflow.isPending || createApprovalRequest.isPending;

  // Get all departments from companies
  const departments = useMemo(() => {
    const allDepartments: any[] = [];
    companies.forEach((company: any) => {
      if (company.departments) {
        company.departments.forEach((dept: any) => {
          allDepartments.push({ ...dept, companyName: company.name });
        });
      }
    });
    return allDepartments;
  }, [companies]);

  // Resolve original sender to a display name (never show the raw user id).
  const originalSenderId = workflow?.assignedBy || "";
  const originalSenderName = useMemo(() => {
    if (!workflow) return "";
    const fromApi =
      workflow.assignedByName ||
      workflow.creatorName ||
      workflow.creator?.name ||
      workflow.creator?.email;
    if (fromApi) return fromApi;
    const user = users.find((u: any) => u.id === workflow.assignedBy);
    return user?.name || user?.email || "";
  }, [workflow, users]);

  // Get department heads
  const departmentHeads = useMemo(() => {
    return users.filter((u: any) => u.role === "Department Head");
  }, [users]);

  // Get users in current department
  const currentDeptUsers = useMemo(() => {
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
    return users.filter((u: any) => u.status === "active");
  }, [users, workflow, departments]);

  const handleRoute = async () => {
    if (routingType === "actions") {
      // Close sheet first so nested dialog focus traps don’t stack.
      onOpenChange(false);
      window.setTimeout(() => {
        onRequestCreateAction?.();
      }, 150);
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

    // Routing state is handled by mutation hooks

    try {
      // Determine new assignee based on routing type
      let newAssignedTo: any = null;
      let message = "";
      // Get current assignee name properly
      let fromName = "Unknown";
      let fromType = "unknown";
      let fromId = null;
      
      if (workflow.assignedTo) {
        if (typeof workflow.assignedTo === "object") {
          fromName = workflow.assignedTo.name || workflow.assignedToName || "Unknown";
          fromType = workflow.assignedTo.type || "unknown";
          fromId = workflow.assignedTo.id || null;
        } else {
          fromName = workflow.assignedTo || workflow.assignedToName || "Unknown";
        }
      } else if (workflow.assignedToName) {
        fromName = workflow.assignedToName;
        fromType = workflow.assignedToType || "unknown";
        fromId = workflow.assignedToId || null;
      }
      
      let routingHistoryEntry: any = {
        from: {
          type: fromType,
          id: fromId,
          name: fromName,
        },
        routedBy: currentUser?.name || currentUser?.email || "Current User",
        routedAt: new Date().toISOString(),
        notes: notes || undefined,
        routingType: routingType,
      };

      switch (routingType) {
        case "file_documents": {
          // File the workflow - keep it as completed, just add filedAt
          // Workflow remains completed, no new assignee needed
          message = "Workflow filed successfully";
          routingHistoryEntry.routingType = "filed";
          routingHistoryEntry.to = {
            type: "system",
            id: "system",
            name: "Filed",
          };
          break;
        }
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
          // Prefer lookup by id (assignedBy), then by resolved name.
          const sender =
            users.find((u: any) => u.id === originalSenderId) ||
            (originalSenderName
              ? users.find((u: any) => u.name === originalSenderName)
              : null);
          const senderLabel =
            sender?.name ||
            sender?.email ||
            originalSenderName ||
            "original sender";
          if (sender) {
            newAssignedTo = {
              type: "user",
              id: sender.id,
              name: senderLabel,
            };
          } else if (originalSenderId) {
            newAssignedTo = {
              type: "user",
              id: originalSenderId,
              name: senderLabel,
            };
          } else {
            toast.error("Original sender not found");
            return;
          }
          message = `Workflow routed back to ${senderLabel}`;
          break;
        }
      }

      // Filing does not reassign — only other routing types need an assignee.
      if (routingType !== "file_documents") {
        if (!newAssignedTo) {
          toast.error("Unable to determine new assignee");
          return;
        }
        routingHistoryEntry.to = newAssignedTo;
      }
      routingHistoryEntry.routedBy = currentUser?.name || currentUser?.email || "Current User";

      if (!currentUser) {
        toast.error("You must be logged in to route workflow");
        return;
      }

      // Check if cross-company routing
      const sourceCompanyId = workflow.sourceCompanyId || (await getUserCompanyId(currentUser));
      
      let targetCompanyId: string | null = null;
      if (newAssignedTo?.type === "department") {
        targetCompanyId = await getDepartmentCompanyId(newAssignedTo.id);
      } else if (newAssignedTo?.type === "user") {
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

        await createApprovalRequest.mutateAsync({
          workflowId: workflow.id,
          requestType: "workflow_routing",
          sourceCompanyId,
          sourceCompanyName,
          targetCompanyId,
          targetCompanyName,
          requestedBy: currentUser?.id || currentUser?.email || "Unknown",
          assignedTo: newAssignedTo,
          workflowTitle: workflow.title,
          workflowDescription: workflow.description,
          routingNotes: notes,
        });

        // Update workflow status to pending
        await updateWorkflow.mutateAsync({
          id: workflowId,
          data: {
            approvalStatus: "pending",
            status: "pending",
          },
        });

        toast.success(`Routing requested. Approval pending from ${targetCompanyName}.`);
        onOpenChange(false);
        return;
      }

      // Add company context to routing history if cross-company
      if (isCrossCompany) {
        routingHistoryEntry.isCrossCompany = true;
        routingHistoryEntry.routingType = "cross_company";
        routingHistoryEntry.sourceCompanyId = sourceCompanyId;
        routingHistoryEntry.targetCompanyId = targetCompanyId;
      }

      // Prepare workflow update data
      const updateData: any = {
        routingHistory: [
          ...(workflow.routingHistory || []),
          routingHistoryEntry,
        ],
      };

      // Handle file_documents case - keep workflow as completed, just add filedAt
      if (routingType === "file_documents") {
        updateData.filedAt = new Date().toISOString();
        // Keep status as "completed", don't change it
        // Don't change assignedTo
      } else {
        // Normal routing - update assignee and status
        updateData.assignedTo = newAssignedTo;
        updateData.status = "assigned";
      }

      // Update workflow
      await updateWorkflow.mutateAsync({
        id: workflowId,
        data: updateData,
      });

      // Notifications for routing are not wired yet — don't claim they were sent.
      toast.success(message);

      // Reset form
      setRoutingType("secretary");
      setSelectedDepartment("");
      setSelectedIndividual("");
      setSelectedCompanyId("");
      setNotes("");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Failed to route workflow:", error);
      // onError toast is on useUpdateWorkflow
    }
  };


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
          <div className="mt-2 space-y-6">
            <RadioGroup
              value={routingType}
              onValueChange={(value: any) => {
                setRoutingType(value);
                setSelectedDepartment("");
                setSelectedIndividual("");
              }}
              className="gap-3"
            >
              {/* Show file option for completed workflows or for secretary when ready_for_review */}
              {(workflow?.status === "completed" || (isSecretary && workflow?.status === "ready_for_review")) ? (
                <div className="flex items-start gap-3 rounded-md border p-4">
                  <RadioGroupItem value="file_documents" id="file_documents" className="mt-1" />
                  <div className="space-y-1 leading-none flex-1">
                    <Label htmlFor="file_documents" className="cursor-pointer font-medium">
                      File the Documents / Workflow
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Close the case after completion. Filing records that the
                      documents are archived; it does not cancel separate
                      signature requests on the file.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-md border p-4">
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
              )}

              {/* Only show other routing options if workflow is not completed and not being filed by secretary */}
              {workflow?.status !== "completed" && !(isSecretary && workflow?.status === "ready_for_review") && (
                <>
                  {originalSenderId && (
                <div className="flex items-start gap-3 rounded-md border p-4">
                  <RadioGroupItem value="original_sender" id="original_sender" className="mt-1" />
                  <div className="space-y-1 leading-none flex-1">
                    <Label htmlFor="original_sender" className="cursor-pointer font-medium flex items-center gap-2">
                      Route to Original Sender
                      <User className="h-3 w-3" />
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Send back to {originalSenderName || "the original sender"} (who assigned this document)
                    </p>
                  </div>
                </div>
              )}

              {departmentHeads.length > 0 && (
                <div className="flex items-start gap-3 rounded-md border p-4">
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
                <div className="flex items-start gap-3 rounded-md border p-4">
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

              <div className="flex items-start gap-3 rounded-md border p-4">
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

              <div className="flex items-start gap-3 rounded-md border p-4">
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
                </>
              )}
            </RadioGroup>

            {/* Company Selector for Cross-Company Routing (Admin only) */}
            {isAdmin && (routingType === "department" || routingType === "individual") && (
              <div className="space-y-2">
                <Label>Target Company (Optional - for cross-company routing)</Label>
                <Select
                  value={selectedCompanyId || "__same__"}
                  onValueChange={(value) => {
                    setSelectedCompanyId(value === "__same__" ? "" : value);
                    setSelectedDepartment("");
                    setSelectedIndividual("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select company (leave empty for same company)" />
                  </SelectTrigger>
                  <SelectContent searchPlaceholder="Search companies...">
                    <SelectItem value="__same__">Same Company</SelectItem>
                    {companies.map((company: any) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
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
                  <SelectContent searchPlaceholder="Search departments...">
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
                        <div className="flex items-center gap-2 min-w-0">
                          <Building2 className="h-3 w-3 shrink-0" />
                          <span className="truncate">{dept.name}</span>
                          {dept.companyName && (
                            <span className="text-xs text-muted-foreground truncate">
                              ({dept.companyName})
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
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
                  <SelectContent searchPlaceholder="Search people...">
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
                        <div className="flex items-center gap-2 min-w-0">
                          <User className="h-3 w-3 shrink-0" />
                          <span className="truncate">{user.name}</span>
                          {user.role && (
                            <span className="text-xs text-muted-foreground truncate">
                              ({user.role})
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
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

            {routingType === "original_sender" && originalSenderId && (
              <div className="space-y-2">
                <Label>Original Sender</Label>
                <div className="p-3 border rounded-md bg-muted/50">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <div>
                      <p className="font-medium text-sm">
                        {originalSenderName || "Original sender"}
                      </p>
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isRouting || loading}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleRoute}
            disabled={
              isRouting ||
              loading ||
              (routingType === "department" && !selectedDepartment) ||
              (routingType === "individual" && !selectedIndividual)
            }
          >
            {isRouting ? (
              "Routing..."
            ) : (
              <>
                {routingType === "file_documents" && (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    File Documents
                  </>
                )}
                {routingType === "secretary" && (
                  <>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Send to Secretary
                  </>
                )}
                {routingType === "original_sender" && (
                  <>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Send to {originalSenderName || "Original Sender"}
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
    </Sheet>
  );
}
