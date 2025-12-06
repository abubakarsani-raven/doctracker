"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApprovalRequestCard } from "@/components/features/workflows/ApprovalRequestCard";
import { CrossCompanyApprovalDialog } from "@/components/features/workflows/CrossCompanyApprovalDialog";
import { EmptyState, LoadingState } from "@/components/common";
import { FileText, Search } from "lucide-react";
import {
  getPendingApprovalsForCompany,
  getPendingApprovalsFromCompany,
  CrossCompanyApprovalRequest,
  isCompanyAdmin,
  getUserCompanyId,
} from "@/lib/cross-company-utils";
import { useApprovalRequests, useUpdateApprovalRequest } from "@/lib/hooks/use-approval-requests";
import { useCurrentUser } from "@/lib/hooks/use-users";
import { toast } from "sonner";
import { useRouteProtection } from "@/lib/hooks/useRouteProtection";

export default function ApprovalsPage() {
  const { data: currentUser } = useCurrentUser();
  useRouteProtection({ requireAdmin: true });
  const { data: approvals = [], isLoading } = useApprovalRequests();
  const updateApprovalRequest = useUpdateApprovalRequest();

  const [activeTab, setActiveTab] = useState("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<CrossCompanyApprovalRequest | null>(
    null
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  // Filter approvals by user's company if not Master
  const filteredApprovalsForUser = useMemo(() => {
    if (!currentUser) return [];

    if (currentUser.role === "Master") {
      return approvals;
    }

    const userCompanyId = currentUser.companyId;
    if (!userCompanyId) return [];

    return approvals.filter(
      (a) => a.targetCompanyId === userCompanyId || a.sourceCompanyId === userCompanyId
    );
  }, [approvals, currentUser]);

  const filteredApprovals = useMemo(() => {
    return filteredApprovalsForUser.filter((approval) => {
      // Filter by tab
      if (activeTab === "pending" && approval.status !== "pending") return false;
      if (activeTab === "approved" && approval.status !== "approved") return false;
      if (activeTab === "rejected" && approval.status !== "rejected") return false;

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = (approval.workflowTitle || approval.actionTitle || "")
          .toLowerCase()
          .includes(query);
        const matchesSource = approval.sourceCompanyName.toLowerCase().includes(query);
        const matchesTarget = approval.targetCompanyName.toLowerCase().includes(query);
        if (!matchesTitle && !matchesSource && !matchesTarget) return false;
      }

      return true;
    });
  }, [filteredApprovalsForUser, activeTab, searchQuery]);

  const handleApprove = async (requestId: string) => {
    if (!currentUser) {
      toast.error("You must be logged in to approve requests");
      return;
    }

    try {
      const reviewedBy = currentUser.id || currentUser.name || currentUser.email || "Unknown";

      await updateApprovalRequest.mutateAsync({
        id: requestId,
        data: {
          status: "approved",
          reviewedBy,
          reviewedAt: new Date().toISOString(),
        },
      });

      // TODO: Update related workflow/action via API when endpoints are ready
      toast.success("Approval request approved");
    } catch (error: any) {
      console.error("Failed to approve:", error);
      toast.error(error.message || "Failed to approve request");
    }
  };

  const handleReject = async (requestId: string) => {
    setSelectedRequest(approvals.find((a) => a.id === requestId) || null);
    setDialogOpen(true);
  };

  if (isLoading) {
    return <LoadingState type="card" />;
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
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search approval requests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">
            Pending ({filteredApprovalsForUser.filter((a) => a.status === "pending").length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved ({filteredApprovalsForUser.filter((a) => a.status === "approved").length})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected ({filteredApprovalsForUser.filter((a) => a.status === "rejected").length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {filteredApprovals.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={`No ${activeTab} approval requests`}
              description={`There are no ${activeTab} approval requests to display.`}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredApprovals.map((approval) => {
                const canApprove =
                  currentUser &&
                  isCompanyAdmin(currentUser) &&
                  approval.targetCompanyId === currentUser.companyId;
                
                return (
                  <ApprovalRequestCard
                    key={approval.id}
                    request={approval}
                    onApprove={canApprove ? () => handleApprove(approval.id) : undefined}
                    onReject={canApprove ? () => handleReject(approval.id) : undefined}
                    showActions={canApprove}
                  />
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Rejection Dialog */}
      {selectedRequest && (
        <CrossCompanyApprovalDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setSelectedRequest(null);
            }
          }}
          request={selectedRequest}
        />
      )}
    </div>
  );
}
