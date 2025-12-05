"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApprovalRequestCard } from "@/components/features/workflows/ApprovalRequestCard";
import { CrossCompanyApprovalDialog } from "@/components/features/workflows/CrossCompanyApprovalDialog";
import { EmptyState, LoadingState } from "@/components/common";
import { FileText, Search } from "lucide-react";
import {
  getApprovalRequests,
  getPendingApprovalsForCompany,
  getPendingApprovalsFromCompany,
  updateApprovalRequest,
  CrossCompanyApprovalRequest,
  isCompanyAdmin,
  getUserCompanyId,
} from "@/lib/cross-company-utils";
import { useMockData } from "@/lib/contexts/MockDataContext";
import { toast } from "sonner";
import { useRouteProtection } from "@/lib/hooks/useRouteProtection";

export default function ApprovalsPage() {
  const { currentUser } = useMockData();
  useRouteProtection({ requireAdmin: true });
  const [approvals, setApprovals] = useState<CrossCompanyApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [selectedRequest, setSelectedRequest] = useState<CrossCompanyApprovalRequest | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);

  useEffect(() => {
    loadApprovals();
    loadCompanies();
    
    // Listen for approval updates
    const handleUpdate = () => {
      loadApprovals();
    };
    
    window.addEventListener("approvalRequestsUpdated", handleUpdate);
    
    return () => {
      window.removeEventListener("approvalRequestsUpdated", handleUpdate);
    };
  }, []);

  const loadCompanies = async () => {
    try {
      const { api } = await import("@/lib/api");
      const companiesData = await api.getCompanies();
      setCompanies(companiesData);
    } catch (error) {
      console.error("Failed to load companies:", error);
    }
  };

  const loadApprovals = async () => {
    setLoading(true);
    try {
      let allApprovals = getApprovalRequests();
      
      // Filter by current user's company if not Master
      if (currentUser && currentUser.role !== "Master") {
        const userCompanyId = await getUserCompanyId(currentUser);
        if (userCompanyId) {
          // Show approvals where user's company is target (pending approvals) or source (sent approvals)
          const pendingForCompany = getPendingApprovalsForCompany(userCompanyId);
          const pendingFromCompany = getPendingApprovalsFromCompany(userCompanyId);
          const allForCompany = getApprovalRequests().filter(
            (a) => a.targetCompanyId === userCompanyId || a.sourceCompanyId === userCompanyId
          );
          allApprovals = allForCompany;
        }
      }
      
      setApprovals(allApprovals);
    } catch (error) {
      console.error("Failed to load approvals:", error);
      toast.error("Failed to load approval requests");
    } finally {
      setLoading(false);
    }
  };

  const filteredApprovals = approvals.filter((approval) => {
    // Filter by tab
    if (activeTab === "pending" && approval.status !== "pending") return false;
    if (activeTab === "approved" && approval.status !== "approved") return false;
    if (activeTab === "rejected" && approval.status !== "rejected") return false;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = (approval.workflowTitle || approval.actionTitle || "").toLowerCase().includes(query);
      const matchesSource = approval.sourceCompanyName.toLowerCase().includes(query);
      const matchesTarget = approval.targetCompanyName.toLowerCase().includes(query);
      if (!matchesTitle && !matchesSource && !matchesTarget) return false;
    }

    // Filter by company
    if (filterCompany !== "all") {
      if (approval.sourceCompanyId !== filterCompany && approval.targetCompanyId !== filterCompany) {
        return false;
      }
    }

    return true;
  });

  const handleApprove = async (requestId: string) => {
    try {
      const currentUserStr = localStorage.getItem("mockCurrentUser");
      const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
      const reviewedBy = currentUser?.id || currentUser?.name || "Unknown";

      const updated = updateApprovalRequest(requestId, {
        status: "approved",
        reviewedBy,
      });

      if (updated) {
        // Update related workflow/action
        await updateRelatedResource(updated);
        
        toast.success("Approval request approved");
        loadApprovals();
      }
    } catch (error) {
      console.error("Failed to approve:", error);
      toast.error("Failed to approve request");
    }
  };

  const handleReject = async (requestId: string) => {
    setSelectedRequest(approvals.find((a) => a.id === requestId) || null);
    setDialogOpen(true);
  };

  const updateRelatedResource = async (approval: CrossCompanyApprovalRequest) => {
    if (approval.requestType === "workflow_assignment" || approval.requestType === "workflow_routing") {
      // Update workflow approval status and activate assignment
      const workflows = JSON.parse(localStorage.getItem("workflows") || "[]");
      const workflowIndex = workflows.findIndex((w: any) => w.id === approval.workflowId);
      
      if (workflowIndex !== -1) {
        const workflow = workflows[workflowIndex];
        const updatedWorkflow = {
          ...workflow,
          approvalStatus: "approved",
          approvedBy: approval.reviewedBy,
          approvedAt: approval.reviewedAt,
          status: approval.requestType === "workflow_routing" ? "assigned" : workflow.status === "pending" ? "assigned" : workflow.status,
          // Update assignedTo if this is a routing approval
          ...(approval.requestType === "workflow_routing" && {
            assignedTo: approval.assignedTo,
          }),
          // Update routing history if routing
          ...(approval.requestType === "workflow_routing" && {
            routingHistory: [
              ...(workflow.routingHistory || []),
              {
                from: workflow.assignedTo || { type: "unknown", name: "Unknown" },
                to: approval.assignedTo,
                routedBy: approval.requestedBy,
                routedAt: approval.reviewedAt || new Date().toISOString(),
                notes: approval.routingNotes,
                routingType: "cross_company",
              },
            ],
          }),
        };

        workflows[workflowIndex] = updatedWorkflow;
        localStorage.setItem("workflows", JSON.stringify(workflows));
        
        // Create notification for assignee
        const notifications = JSON.parse(localStorage.getItem("notifications") || "[]");
        notifications.push({
          id: `notif-${Date.now()}`,
          type: approval.requestType === "workflow_routing" ? "workflow_routed" : "workflow_assigned",
          title: approval.requestType === "workflow_routing" ? "Workflow Routed to You" : "Workflow Assigned",
          message: `Workflow "${approval.workflowTitle}" has been ${approval.requestType === "workflow_routing" ? "routed" : "assigned"} to you`,
          resourceType: "workflow",
          resourceId: approval.workflowId,
          read: false,
          createdAt: new Date().toISOString(),
        });
        localStorage.setItem("notifications", JSON.stringify(notifications));
        window.dispatchEvent(new CustomEvent("notificationsUpdated"));
        window.dispatchEvent(new CustomEvent("workflowsUpdated"));
      }
    } else if (approval.requestType === "action_assignment") {
      // Update action approval status and activate assignment
      const actions = JSON.parse(localStorage.getItem("actions") || "[]");
      const actionIndex = actions.findIndex((a: any) => a.id === approval.actionId);
      
      if (actionIndex !== -1) {
        const action = actions[actionIndex];
        actions[actionIndex] = {
          ...action,
          approvalStatus: "approved",
          approvedBy: approval.reviewedBy,
          approvedAt: approval.reviewedAt,
          status: action.status === "pending" ? "pending" : action.status, // Keep status, but now assignee can work on it
        };
        localStorage.setItem("actions", JSON.stringify(actions));
        
        // Create notification for assignee
        const notifications = JSON.parse(localStorage.getItem("notifications") || "[]");
        notifications.push({
          id: `notif-${Date.now()}`,
          type: "action_assigned",
          title: "Action Assigned",
          message: `Action "${approval.actionTitle}" has been assigned to you`,
          resourceType: "action",
          resourceId: approval.actionId,
          read: false,
          createdAt: new Date().toISOString(),
        });
        localStorage.setItem("notifications", JSON.stringify(notifications));
        window.dispatchEvent(new CustomEvent("notificationsUpdated"));
        window.dispatchEvent(new CustomEvent("actionsUpdated"));
      }
    }
  };

  const handleViewDetails = (request: CrossCompanyApprovalRequest) => {
    setSelectedRequest(request);
    setDialogOpen(true);
  };

  if (loading) {
    return <LoadingState type="card" />;
  }

  // Check if user has permission to view approvals
  if (currentUser && !isCompanyAdmin(currentUser)) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Approval Requests</h1>
          <p className="text-muted-foreground">Manage cross-company approval requests</p>
        </div>
        <EmptyState
          icon={FileText}
          title="Access Restricted"
          description="Only Company Admins can view and manage approval requests."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Approval Requests</h1>
          <p className="text-muted-foreground">
            Manage cross-company workflow and action approval requests
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search approvals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={filterCompany} onValueChange={setFilterCompany}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by company" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Companies</SelectItem>
            {companies.map((company: any) => (
              <SelectItem key={company.id} value={company.id}>
                {company.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">
            Pending ({approvals.filter((a) => a.status === "pending").length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved ({approvals.filter((a) => a.status === "approved").length})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected ({approvals.filter((a) => a.status === "rejected").length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {filteredApprovals.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No approval requests"
              description={
                activeTab === "pending"
                  ? "No pending approval requests at this time"
                  : `No ${activeTab} approval requests found`
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredApprovals.map((approval) => (
                <div key={approval.id} onClick={() => handleViewDetails(approval)}>
                  <ApprovalRequestCard
                    request={approval}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    showActions={approval.status === "pending"}
                  />
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Approval Dialog */}
      {selectedRequest && (
        <CrossCompanyApprovalDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          request={selectedRequest}
          onApproved={handleApprove}
          onRejected={(id) => {
            loadApprovals();
            setDialogOpen(false);
          }}
        />
      )}
    </div>
  );
}
