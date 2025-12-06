"use client";

import { useMemo, useState } from "react";
import { WorkflowCard, EmptyState, LoadingState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { CreateWorkflowDialog } from "@/components/features/workflows/CreateWorkflowDialog";
import { useWorkflows } from "@/lib/hooks/use-workflows";
import { useCurrentUser } from "@/lib/hooks/use-users";
import { useUIStore } from "@/lib/stores";
import { isCompanyAdmin } from "@/lib/cross-company-utils";

export default function WorkflowsPage() {
  const router = useRouter();
  const { data: currentUser } = useCurrentUser();
  const { data: workflows = [], isLoading } = useWorkflows();
  const {
    createWorkflowDialogOpen,
    setCreateWorkflowDialogOpen,
    workflowSearchQuery,
    workflowStatusFilter,
    setWorkflowSearchQuery,
    setWorkflowStatusFilter,
  } = useUIStore();
  const [activeTab, setActiveTab] = useState("all");

  const filteredWorkflows = useMemo(() => {
    return workflows.filter((workflow: any) => {
      // Visibility check for cross-company workflows
      if (workflow.isCrossCompany && currentUser) {
        // Master can see all
        if (currentUser.role === "Master") {
          // Allow through
        }
        // Company Admin can see if:
        // - Workflow is from their company (source)
        // - Workflow is assigned to their company (target) and approved
        else if (isCompanyAdmin(currentUser)) {
          // For now, show all cross-company workflows to admins (they'll see pending approvals)
          // In production, would check company ID matching
        }
        // Regular users can only see if:
        // - Assigned to them and approved
        else {
          // Check if assigned to user/department and approved
          const isAssigned =
            (workflow.assignedTo?.type === "user" &&
              workflow.assignedTo.id === currentUser.id) ||
            (workflow.assignedTo?.type === "department" &&
              currentUser.department &&
              (workflow.assignedTo.name === currentUser.department ||
                workflow.assignedTo.id === currentUser.department));

          if (!isAssigned || workflow.approvalStatus !== "approved") {
            return false; // Hide if not assigned or not approved
          }
        }
      }

      const documentName =
        workflow.documentName || workflow.title || "Untitled Workflow";
      const matchesSearch = documentName
        .toLowerCase()
        .includes(workflowSearchQuery.toLowerCase());
      const matchesStatus =
        workflowStatusFilter === "all" ||
        workflow.status === workflowStatusFilter;

      // Tab filtering
      let matchesTab = true;
      if (activeTab === "assigned") {
        matchesTab = workflow.assignedTo?.type === "user";
      } else if (activeTab === "my-work") {
        matchesTab = workflow.status === "in_progress";
      } else if (activeTab === "completed") {
        matchesTab = workflow.status === "completed";
      }

      return matchesSearch && matchesStatus && matchesTab;
    });
  }, [
    workflows,
    currentUser,
    workflowSearchQuery,
    workflowStatusFilter,
    activeTab,
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workflows</h1>
          <p className="text-muted-foreground">
            Track and manage document workflows
          </p>
        </div>
        <Button onClick={() => setCreateWorkflowDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Workflow
        </Button>
      </div>

      {/* Tabs and Filters */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="assigned">Assigned to Me</TabsTrigger>
            <TabsTrigger value="my-work">My Work</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search workflows..."
                value={workflowSearchQuery}
                onChange={(e) => setWorkflowSearchQuery(e.target.value)}
                className="pl-10 w-[200px]"
              />
            </div>
            <Select
              value={workflowStatusFilter}
              onValueChange={setWorkflowStatusFilter}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="ready_for_review">Ready for Review</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <LoadingState type="card" />
          ) : filteredWorkflows.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No workflows found"
              description={
                workflowSearchQuery || workflowStatusFilter !== "all"
                  ? "Try adjusting your filters"
                  : "No workflows have been created yet"
              }
              action={
                !workflowSearchQuery && workflowStatusFilter === "all"
                  ? {
                      label: "Create Workflow",
                      onClick: () => setCreateWorkflowDialogOpen(true),
                    }
                  : undefined
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredWorkflows.map((workflow: any) => {
                // Normalize workflow data for WorkflowCard
                const normalizedWorkflow = {
                  id: workflow.id,
                  documentName:
                    workflow.documentName ||
                    workflow.title ||
                    "Untitled Workflow",
                  documentId: workflow.documentId || workflow.id,
                  status: workflow.status || "assigned",
                  assignedTo:
                    typeof workflow.assignedTo === "object"
                      ? workflow.assignedTo.name?.trim() || "Unassigned"
                      : workflow.assignedTo || "Unassigned",
                  assignedToType:
                    typeof workflow.assignedTo === "object"
                      ? workflow.assignedTo.type
                      : workflow.assignedToType || "user",
                  progress: workflow.progress || 0,
                  startedAt: workflow.assignedAt
                    ? new Date(workflow.assignedAt)
                    : new Date(),
                  dueDate: workflow.dueDate
                    ? new Date(workflow.dueDate)
                    : undefined,
                  // Cross-company fields
                  isCrossCompany: workflow.isCrossCompany,
                  sourceCompanyName: workflow.sourceCompanyName,
                  targetCompanyName: workflow.targetCompanyName,
                  approvalStatus: workflow.approvalStatus,
                };

                return (
                  <WorkflowCard
                    key={workflow.id}
                    workflow={normalizedWorkflow}
                    onView={(id) => router.push(`/workflows/${id}`)}
                  />
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Workflow Dialog */}
      <CreateWorkflowDialog
        open={createWorkflowDialogOpen}
        onOpenChange={setCreateWorkflowDialogOpen}
      />
    </div>
  );
}
