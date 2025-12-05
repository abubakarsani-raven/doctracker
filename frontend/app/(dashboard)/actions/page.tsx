"use client";

import { useState, useEffect, useMemo } from "react";
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
import { api } from "@/lib/api";
import { useMockData } from "@/lib/contexts/MockDataContext";
import { canViewAction } from "@/lib/action-utils";
import { isCompanyAdmin } from "@/lib/cross-company-utils";

export default function ActionsPage() {
  const router = useRouter();
  const { currentUser } = useMockData();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("pending");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [actions, setActions] = useState<any[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActions();
    
    // Listen for action updates
    const handleUpdate = () => {
      loadActions();
    };
    
    window.addEventListener("actionsUpdated", handleUpdate);
    
    return () => {
      window.removeEventListener("actionsUpdated", handleUpdate);
    };
  }, []);

  const loadActions = async () => {
    setLoading(true);
    try {
      const [actionsData, workflowsData] = await Promise.all([
        api.getActions(),
        api.getWorkflows(),
      ]);

      // Merge with local storage
      const localActions = JSON.parse(localStorage.getItem("actions") || "[]");
      const localWorkflows = JSON.parse(localStorage.getItem("workflows") || "[]");
      
      const allActions = [...actionsData, ...localActions];
      const allWorkflows = [...workflowsData, ...localWorkflows];
      
      setActions(allActions);
      setWorkflows(allWorkflows);
    } catch (error) {
      console.error("Failed to load actions:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter actions by visibility (assigned or workflow participant)
  const visibleActionsList = useMemo(() => {
    if (!currentUser || actions.length === 0) return [];
    
    const visible: any[] = [];
    for (const action of actions) {
      // Check if assigned
      const isAssigned = 
        (action.assignedTo?.type === "user" && action.assignedTo.id === currentUser.id) ||
        (action.assignedTo?.type === "department" && 
         currentUser.department && 
         (action.assignedTo.name === currentUser.department || 
          action.assignedTo.id === currentUser.department ||
          action.assignedTo.name?.toLowerCase() === currentUser.department.toLowerCase()));
      
      // Check cross-company action visibility
      if (action.isCrossCompany) {
        // Master can see all
        if (currentUser.role === "Master") {
          visible.push(action);
        }
        // Company Admin can see cross-company actions (for approval management)
        else if (isCompanyAdmin(currentUser)) {
          visible.push(action);
        }
        // Regular users can only see if assigned and approved
        else if (isAssigned && action.approvalStatus === "approved") {
          visible.push(action);
        }
        // Skip if not approved or not assigned
        continue;
      }
      
      // Check if workflow participant (for same-company actions)
      let isParticipant = false;
      if (action.workflowId && !isAssigned) {
        const workflow = workflows.find((w: any) => w.id === action.workflowId);
        if (workflow) {
          // Check if creator
          if (workflow.assignedBy === currentUser.name || workflow.assignedBy === currentUser.id) {
            isParticipant = true;
          }
          // Check if current assignee
          else if (workflow.assignedTo) {
            if (workflow.assignedTo.type === "user" && workflow.assignedTo.id === currentUser.id) {
              isParticipant = true;
            } else if (workflow.assignedTo.type === "department" && currentUser.department) {
              const workflowDept = workflow.assignedTo.name || workflow.assignedTo.id;
              if (currentUser.department === workflowDept || 
                  currentUser.department.toLowerCase() === workflowDept.toLowerCase()) {
                isParticipant = true;
              }
            }
          }
          // Check routing history
          if (!isParticipant && workflow.routingHistory && Array.isArray(workflow.routingHistory)) {
            for (const route of workflow.routingHistory) {
              if ((route.from?.type === "user" && route.from.id === currentUser.id) ||
                  (route.to?.type === "user" && route.to.id === currentUser.id) ||
                  (route.from?.type === "department" && currentUser.department && 
                   (route.from.name === currentUser.department || 
                    route.from.id === currentUser.department ||
                    route.from.name?.toLowerCase() === currentUser.department.toLowerCase())) ||
                  (route.to?.type === "department" && currentUser.department &&
                   (route.to.name === currentUser.department || 
                    route.to.id === currentUser.department ||
                    route.to.name?.toLowerCase() === currentUser.department.toLowerCase()))) {
                isParticipant = true;
                break;
              }
            }
          }
        }
      }
      
      if (isAssigned || isParticipant) {
        visible.push(action);
      }
    }
    return visible;
  }, [actions, workflows, currentUser]);

  // Map action status for tabs (new statuses map to existing tabs)
  const getStatusForTab = (status: string): string => {
    if (status === "completed") return "completed";
    if (status === "document_uploaded" || status === "response_received") return "in_progress";
    if (status === "in_progress") return "in_progress";
    return "pending";
  };

  const filteredActions = visibleActionsList.filter((action) => {
    const matchesSearch = action.title
      ?.toLowerCase()
      .includes(searchQuery.toLowerCase()) ?? false;
    
    const actionStatus = action.status || "pending";
    const matchesStatus = statusFilter === "all" || actionStatus === statusFilter;
    
    const tabStatus = getStatusForTab(actionStatus);
    const matchesTab = activeTab === "all" || tabStatus === activeTab;

    return matchesSearch && matchesStatus && matchesTab;
  });

  if (loading) {
    return <LoadingState type="card" />;
  }

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Actions & Resolutions</h1>
            <p className="text-muted-foreground">
              Track and manage action items assigned to you or your department
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Action
          </Button>
        </div>

        {/* Tabs and Filters */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <TabsList>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="in_progress">In Progress</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search actions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-[200px]"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter" />
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
            {filteredActions.length === 0 ? (
              <EmptyState
                icon={Search}
                title="No actions found"
                description={
                  searchQuery || statusFilter !== "all"
                    ? "Try adjusting your filters"
                    : "No actions have been created yet"
                }
                action={
                  !searchQuery && statusFilter === "all"
                    ? {
                        label: "Create Action",
                        onClick: () => setCreateDialogOpen(true),
                      }
                    : undefined
                }
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredActions.map((action) => {
                  // Convert action to ActionCard format
                  const actionData = {
                    id: action.id,
                    title: action.title || "Untitled Action",
                    description: action.description,
                    status: action.status || "pending",
                    assignedTo: action.assignedTo?.name || action.assignedTo,
                    assignedToType: action.assignedTo?.type || "user",
                    documentId: action.documentId,
                    documentName: action.documentName,
                    dueDate: action.dueDate ? new Date(action.dueDate) : undefined,
                    completedAt: action.completedAt ? new Date(action.completedAt) : undefined,
                    createdAt: action.createdAt ? new Date(action.createdAt) : new Date(),
                    type: action.type,
                    workflowId: action.workflowId,
                    // Cross-company fields
                    isCrossCompany: action.isCrossCompany,
                    sourceCompanyName: action.sourceCompanyName,
                    targetCompanyName: action.targetCompanyName,
                    approvalStatus: action.approvalStatus,
                  };
                  
                  return (
                    <ActionCard
                      key={action.id}
                      action={actionData}
                      onView={(id) => router.push(`/actions/${id}`)}
                    />
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <CreateActionDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
        />
      </div>
  );
}
