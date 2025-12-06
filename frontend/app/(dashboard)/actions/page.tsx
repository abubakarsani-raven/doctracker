"use client";

import { useMemo, useState } from "react";
import { ActionCard, EmptyState, LoadingState } from "@/components/common";
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
import { CreateActionDialog } from "@/components/features/actions/CreateActionDialog";
import { useActions } from "@/lib/hooks/use-actions";
import { useWorkflows } from "@/lib/hooks/use-workflows";
import { useCurrentUser } from "@/lib/hooks/use-users";
import { useUIStore } from "@/lib/stores";
import { canViewAction } from "@/lib/action-utils";
import { isCompanyAdmin } from "@/lib/cross-company-utils";

export default function ActionsPage() {
  const router = useRouter();
  const { data: currentUser } = useCurrentUser();
  const { data: actions = [], isLoading: actionsLoading } = useActions();
  const { data: workflows = [], isLoading: workflowsLoading } = useWorkflows();
  const {
    createActionDialogOpen,
    setCreateActionDialogOpen,
    actionSearchQuery,
    actionStatusFilter,
    setActionSearchQuery,
    setActionStatusFilter,
  } = useUIStore();
  const [activeTab, setActiveTab] = useState("pending");

  const isLoading = actionsLoading || workflowsLoading;

  // Filter actions by visibility (assigned or workflow participant)
  const filteredActions = useMemo(() => {
    if (!currentUser) return [];
    if (!Array.isArray(actions)) return [];
    if (!Array.isArray(workflows)) return [];

    return actions.filter((action: any) => {
      // Check if user can view this action
      if (!canViewAction(action, currentUser, workflows)) {
        return false;
      }

      // Get workflow for this action if it exists
      const workflow = workflows.find((w: any) => w.id === action.workflowId);

      // Apply search filter
      const actionTitle = action.title || "";
      const matchesSearch = actionTitle
        .toLowerCase()
        .includes(actionSearchQuery.toLowerCase());

      // Apply status filter
      const matchesStatus =
        actionStatusFilter === "all" || action.status === actionStatusFilter;

      // Apply tab filter
      let matchesTab = true;
      if (activeTab === "pending") {
        matchesTab = action.status === "pending";
      } else if (activeTab === "in-progress") {
        matchesTab =
          action.status === "in_progress" || action.status === "assigned";
      } else if (activeTab === "completed") {
        matchesTab = action.status === "completed";
      } else if (activeTab === "my-actions") {
        // Show actions assigned to current user
        const isAssigned =
          (action.assignedTo?.type === "user" &&
            action.assignedTo.id === currentUser.id) ||
          (action.assignedTo?.type === "department" &&
            currentUser.department &&
            action.assignedTo.name === currentUser.department);

        matchesTab = isAssigned && action.status !== "completed";
      }

      return matchesSearch && matchesStatus && matchesTab;
    });
  }, [
    actions,
    workflows,
    currentUser,
    actionSearchQuery,
    actionStatusFilter,
    activeTab,
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Actions</h1>
          <p className="text-muted-foreground">
            Track and manage workflow actions
          </p>
        </div>
        <Button onClick={() => setCreateActionDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Action
        </Button>
      </div>

      {/* Tabs and Filters */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="in-progress">In Progress</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="my-actions">My Actions</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search actions..."
                value={actionSearchQuery}
                onChange={(e) => setActionSearchQuery(e.target.value)}
                className="pl-10 w-[200px]"
              />
            </div>
            <Select
              value={actionStatusFilter}
              onValueChange={setActionStatusFilter}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <LoadingState type="card" />
          ) : filteredActions.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No actions found"
              description={
                actionSearchQuery || actionStatusFilter !== "all"
                  ? "Try adjusting your filters"
                  : "No actions have been created yet"
              }
              action={
                !actionSearchQuery && actionStatusFilter === "all"
                  ? {
                      label: "Create Action",
                      onClick: () => setCreateActionDialogOpen(true),
                    }
                  : undefined
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredActions.map((action: any) => (
                <ActionCard
                  key={action.id}
                  action={action}
                  onView={(id) => router.push(`/actions/${id}`)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Action Dialog */}
      <CreateActionDialog
        open={createActionDialogOpen}
        onOpenChange={setCreateActionDialogOpen}
      />
    </div>
  );
}
