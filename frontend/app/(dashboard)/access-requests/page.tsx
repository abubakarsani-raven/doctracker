"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, LoadingState } from "@/components/common";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Folder,
} from "lucide-react";
import {
  AccessRequest,
  canApproveAccessRequest,
} from "@/lib/access-request-utils";
import { useAccessRequests, useUpdateAccessRequest } from "@/lib/hooks/use-access-requests";
import { useCurrentUser } from "@/lib/hooks/use-users";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function AccessRequestsPage() {
  const { data: currentUser } = useCurrentUser();
  const { data: allRequests = [], isLoading } = useAccessRequests();
  const updateRequest = useUpdateAccessRequest();

  const [activeTab, setActiveTab] = useState("pending");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Filter requests based on tab and user permissions
  const filteredRequests = useMemo(() => {
    let requests = (allRequests || []) as AccessRequest[];

    // Filter by tab
    if (activeTab === "pending") {
      requests = requests.filter(
        (request: AccessRequest) =>
          request.status === "pending" &&
          canApproveAccessRequest(request, currentUser)
      );
    } else if (activeTab === "approved") {
      requests = requests.filter((request: AccessRequest) => request.status === "approved");
    } else if (activeTab === "rejected") {
      requests = requests.filter((request: AccessRequest) => request.status === "rejected");
    }

    return requests;
  }, [allRequests, activeTab, currentUser]);

  const handleApprove = async (requestId: string) => {
    if (!currentUser) {
      toast.error("You must be logged in to approve requests");
      return;
    }

    try {
      await updateRequest.mutateAsync({
        id: requestId,
        data: {
          status: "approved",
          approvedBy: currentUser.id || currentUser.email || "Unknown",
          approvedByName: currentUser.name || currentUser.email || "Unknown User",
          approvedAt: new Date().toISOString(),
        },
      });

      toast.success("Access request approved");
    } catch (error: any) {
      console.error("Failed to approve:", error);
      toast.error(error.message || "Failed to approve request");
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
          rejectedBy: currentUser.id || currentUser.email || "Unknown",
          rejectedByName: currentUser.name || currentUser.email || "Unknown User",
          rejectionReason: rejectionReason.trim(),
          rejectedAt: new Date().toISOString(),
        },
      });

      toast.success("Access request rejected");
      setRejectDialogOpen(false);
      setSelectedRequest(null);
      setRejectionReason("");
    } catch (error: any) {
      console.error("Failed to reject:", error);
      toast.error(error.message || "Failed to reject request");
    }
  };

  const handleRevoke = async (request: AccessRequest) => {
    if (!currentUser) {
      toast.error("You must be logged in to revoke access");
      return;
    }

    try {
      await updateRequest.mutateAsync({
        id: request.id,
        data: {
          status: "rejected",
          rejectedBy: currentUser.id || currentUser.email || "Unknown",
          rejectedByName: currentUser.name || currentUser.email || "Unknown User",
          rejectionReason: "Access revoked by approver",
          rejectedAt: new Date().toISOString(),
        },
      });

      toast.success("Access revoked successfully");
    } catch (error: any) {
      console.error("Failed to revoke:", error);
      toast.error(error.message || "Failed to revoke access");
    }
  };

  const scopeLabels: Record<string, string> = {
    company: "Company-wide",
    department: "Department-wide",
    division: "Division-wide",
  };

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Access Requests</h1>
        <p className="text-muted-foreground">
          Review and manage document and folder access requests
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">
            <Clock className="mr-2 h-4 w-4" />
            Pending ({filteredRequests.filter((r: AccessRequest) => r.status === "pending").length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Approved ({filteredRequests.filter((r: AccessRequest) => r.status === "approved").length})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            <XCircle className="mr-2 h-4 w-4" />
            Rejected ({filteredRequests.filter((r: AccessRequest) => r.status === "rejected").length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {filteredRequests.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title={`No ${activeTab} access requests`}
              description={
                activeTab === "pending"
                  ? "There are no pending access requests for you to review"
                  : `There are no ${activeTab} access requests`
              }
            />
          ) : (
            <div className="grid gap-4">
              {filteredRequests.map((request: AccessRequest) => (
                <Card key={request.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {request.resourceType === "document" ? (
                          <FileText className="h-5 w-5 text-blue-500 mt-1" />
                        ) : (
                          <Folder className="h-5 w-5 text-yellow-500 mt-1" />
                        )}
                        <div>
                          <CardTitle className="text-lg">{request.resourceName}</CardTitle>
                          <CardDescription className="flex items-center gap-2 mt-1">
                            <span>Requested by {request.requestedByName}</span>
                            {request.scope && (
                              <>
                                <span>•</span>
                                <Badge variant="outline">
                                  {scopeLabels[request.scope]}
                                </Badge>
                              </>
                            )}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge
                        variant={
                          request.status === "approved"
                            ? "default"
                            : request.status === "rejected"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {request.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {request.reason && (
                      <div>
                        <Label className="text-sm font-medium">Reason:</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          {request.reason}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>
                          Requested{" "}
                          {formatDistanceToNow(new Date(request.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      {request.approvedAt && (
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>
                            Approved{" "}
                            {formatDistanceToNow(new Date(request.approvedAt), {
                              addSuffix: true,
                            })}{" "}
                            by {request.approvedByName}
                          </span>
                        </div>
                      )}
                      {request.rejectedAt && (
                        <div className="flex items-center gap-1">
                          <XCircle className="h-3 w-3" />
                          <span>
                            Rejected{" "}
                            {formatDistanceToNow(new Date(request.rejectedAt), {
                              addSuffix: true,
                            })}{" "}
                            by {request.rejectedByName}
                          </span>
                        </div>
                      )}
                    </div>

                    {request.rejectionReason && (
                      <div className="p-3 bg-destructive/10 rounded-md">
                        <Label className="text-sm font-medium text-destructive">
                          Rejection Reason:
                        </Label>
                        <p className="text-sm text-destructive mt-1">
                          {request.rejectionReason}
                        </p>
                      </div>
                    )}

                    {request.status === "pending" &&
                      canApproveAccessRequest(request, currentUser) && (
                        <div className="flex items-center gap-2 pt-2 border-t">
                          <Button
                            size="sm"
                            onClick={() => handleApprove(request.id)}
                            className="flex-1"
                            disabled={updateRequest.isPending}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReject(request)}
                            className="flex-1"
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      )}
                    {request.status === "approved" &&
                      canApproveAccessRequest(request, currentUser) && (
                        <div className="flex items-center gap-2 pt-2 border-t">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRevoke(request)}
                            className="flex-1"
                            disabled={updateRequest.isPending}
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Revoke Access
                          </Button>
                        </div>
                      )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Access Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this access request
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Rejection Reason *</Label>
              <Textarea
                id="rejection-reason"
                placeholder="Explain why this request is being rejected..."
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
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
