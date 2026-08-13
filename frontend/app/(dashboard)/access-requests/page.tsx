"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, LoadingState, QueryErrorState } from "@/components/common";
import { ListPagination, paginateItems } from "@/components/common/ListPagination";
import { KeyRound, History, Clock } from "lucide-react";
import {
  AccessRequest,
  canApproveAccessRequest,
} from "@/lib/access-request-utils";
import {
  AccessRequestCard,
  accessRequestDecidedAt,
} from "@/components/features/access-requests/AccessRequestCard";
import { useAccessRequests, useUpdateAccessRequest } from "@/lib/hooks/use-access-requests";
import { useCurrentUser } from "@/lib/hooks/use-users";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function AccessRequestsPage() {
  const router = useRouter();
  const { data: currentUser } = useCurrentUser();
  const { data: allRequests = [], isLoading, isError, error, refetch } =
    useAccessRequests();
  const updateRequest = useUpdateAccessRequest();

  const [activeTab, setActiveTab] = useState("request");
  const [requestPage, setRequestPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(
    null,
  );
  const [rejectionReason, setRejectionReason] = useState("");

  const pendingMine = useMemo(
    () =>
      (allRequests as AccessRequest[]).filter(
        (request) =>
          request.status === "pending" &&
          request.requestedBy === currentUser?.id,
      ),
    [allRequests, currentUser],
  );

  const pendingToReview = useMemo(
    () =>
      (allRequests as AccessRequest[]).filter(
        (request) =>
          request.status === "pending" &&
          canApproveAccessRequest(request, currentUser),
      ),
    [allRequests, currentUser],
  );

  const requestAccessItems = useMemo(
    () => [...pendingToReview, ...pendingMine.filter(
      (request) => !pendingToReview.some((r) => r.id === request.id),
    )],
    [pendingToReview, pendingMine],
  );

  const historyItems = useMemo(
    () =>
      (allRequests as AccessRequest[])
        .filter((request) => request.status !== "pending")
        .sort(
          (a, b) =>
            new Date(accessRequestDecidedAt(b)).getTime() -
            new Date(accessRequestDecidedAt(a)).getTime(),
        ),
    [allRequests],
  );

  const pagedRequests = paginateItems(requestAccessItems, requestPage);
  const pagedHistory = paginateItems(historyItems, historyPage);

  const handleApprove = async (requestId: string) => {
    if (!currentUser) {
      toast.error("You must be signed in to approve requests");
      return;
    }

    try {
      await updateRequest.mutateAsync({
        id: requestId,
        data: { status: "approved" },
      });
      toast.success("Access request approved");
    } catch (err: any) {
      toast.error(err.message || "Failed to approve request");
    }
  };

  const handleReject = (request: AccessRequest) => {
    setSelectedRequest(request);
    setRejectionReason("");
    setRejectDialogOpen(true);
  };

  const confirmReject = async () => {
    if (!selectedRequest || !currentUser || !rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    try {
      await updateRequest.mutateAsync({
        id: selectedRequest.id,
        data: {
          status: "rejected",
          rejectionReason: rejectionReason.trim(),
        },
      });
      toast.success("Access request rejected");
      setRejectDialogOpen(false);
      setSelectedRequest(null);
      setRejectionReason("");
    } catch (err: any) {
      toast.error(err.message || "Failed to reject request");
    }
  };

  const handleRevoke = async (request: AccessRequest) => {
    if (!currentUser) {
      toast.error("You must be signed in to revoke access");
      return;
    }

    try {
      await updateRequest.mutateAsync({
        id: request.id,
        data: {
          status: "rejected",
          rejectionReason: "Access revoked by approver",
        },
      });
      toast.success("Access revoked");
    } catch (err: any) {
      toast.error(err.message || "Failed to revoke access");
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return (
      <QueryErrorState
        title="Failed to load access requests"
        error={error}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Request access</h1>
        <p className="text-muted-foreground">
          Track requests you have made, decide incoming ones, and look back at
          what was granted or refused.
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value);
          setRequestPage(1);
          setHistoryPage(1);
        }}
      >
        <TabsList>
          <TabsTrigger value="request">
            <KeyRound className="mr-2 h-4 w-4" />
            Request access ({requestAccessItems.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="mr-2 h-4 w-4" />
            History ({historyItems.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="request" className="space-y-4">
          {requestAccessItems.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No open access requests"
              description="Open a Restricted document or folder and choose Request access. Your pending requests will show up here."
              action={{
                label: "Go to documents",
                onClick: () => router.push("/documents"),
              }}
            />
          ) : (
            <>
              <div className="grid gap-4">
                {pagedRequests.map((request) => (
                  <AccessRequestCard
                    key={request.id}
                    request={request}
                    currentUser={currentUser}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    busy={updateRequest.isPending}
                  />
                ))}
              </div>
              <ListPagination
                page={requestPage}
                total={requestAccessItems.length}
                onPageChange={setRequestPage}
                label="requests"
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {historyItems.length === 0 ? (
            <EmptyState
              icon={History}
              title="No access history yet"
              description="Approved and rejected requests will be listed here."
            />
          ) : (
            <>
              <div className="grid gap-4">
                {pagedHistory.map((request) => (
                  <AccessRequestCard
                    key={request.id}
                    request={request}
                    currentUser={currentUser}
                    onRevoke={handleRevoke}
                    busy={updateRequest.isPending}
                  />
                ))}
              </div>
              <ListPagination
                page={historyPage}
                total={historyItems.length}
                onPageChange={setHistoryPage}
                label="records"
              />
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject access request</DialogTitle>
            <DialogDescription>
              Say why this request is being refused. The requester will see this
              note.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Rejection reason</Label>
              <Textarea
                id="rejection-reason"
                placeholder="Explain why this request is being rejected…"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                disabled={updateRequest.isPending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false);
                setSelectedRequest(null);
                setRejectionReason("");
              }}
              disabled={updateRequest.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={!rejectionReason.trim() || updateRequest.isPending}
            >
              Reject request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
