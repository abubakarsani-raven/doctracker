"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building2, CheckCircle2, XCircle } from "lucide-react";
import { CrossCompanyApprovalRequest } from "@/lib/cross-company-utils";
import { CompanyBadge } from "./CompanyBadge";
import { toast } from "sonner";
import { useCurrentUser } from "@/lib/hooks/use-users";
import { useUpdateApprovalRequest } from "@/lib/hooks/use-approval-requests";
import { useUpdateWorkflow } from "@/lib/hooks/use-workflows";

interface CrossCompanyApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: CrossCompanyApprovalRequest;
  onApproved?: (requestId: string) => void;
  onRejected?: (requestId: string) => void;
}

export function CrossCompanyApprovalDialog({
  open,
  onOpenChange,
  request,
  onApproved,
  onRejected,
}: CrossCompanyApprovalDialogProps) {
  const { data: currentUser } = useCurrentUser();
  const updateApprovalRequest = useUpdateApprovalRequest();
  const [rejectionReason, setRejectionReason] = useState("");
  const [action, setAction] = useState<"approve" | "reject" | null>(null);

  const isProcessing = updateApprovalRequest.isPending;

  const handleApprove = async () => {
    if (isProcessing) return;

    setAction("approve");

    try {
      await updateApprovalRequest.mutateAsync({
        id: request.id,
        data: {
          status: "approved",
          reviewedBy: currentUser?.id || currentUser?.email || "Unknown",
        },
      });

      onApproved?.(request.id);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Failed to approve request:", error);
      // Error toast is handled by mutation hook
    } finally {
      setAction(null);
    }
  };

  const handleReject = async () => {
    if (isProcessing) return;

    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    setAction("reject");

    try {
      await updateApprovalRequest.mutateAsync({
        id: request.id,
        data: {
          status: "rejected",
          reviewedBy: currentUser?.id || currentUser?.email || "Unknown",
          rejectionReason: rejectionReason.trim(),
        },
      });

      onRejected?.(request.id);
      onOpenChange(false);
      setRejectionReason("");
    } catch (error: any) {
      console.error("Failed to reject request:", error);
      // Error toast is handled by mutation hook
    } finally {
      setAction(null);
    }
  };

  const getRequestTypeLabel = () => {
    switch (request.requestType) {
      case "workflow_assignment":
        return "Workflow Assignment";
      case "workflow_routing":
        return "Workflow Routing";
      case "action_assignment":
        return "Action Assignment";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{getRequestTypeLabel()} Approval</DialogTitle>
          <DialogDescription>
            Review and approve or reject this cross-company request
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Company Information */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-md">
            <CompanyBadge companyName={request.sourceCompanyName} />
            <span className="text-muted-foreground">→</span>
            <CompanyBadge companyName={request.targetCompanyName} />
          </div>

          {/* Request Details */}
          <div className="space-y-2">
            <div>
              <Label className="text-sm font-medium">Title</Label>
              <p className="text-sm mt-1">
                {request.workflowTitle || request.actionTitle || "Untitled"}
              </p>
            </div>
            {(request.workflowDescription || request.actionDescription) && (
              <div>
                <Label className="text-sm font-medium">Description</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {request.workflowDescription || request.actionDescription}
                </p>
              </div>
            )}
            <div>
              <Label className="text-sm font-medium">Assignment</Label>
              <p className="text-sm mt-1">
                Assign to: <strong>{request.assignedTo.name}</strong> ({request.assignedTo.type})
              </p>
            </div>
            {request.routingNotes && (
              <div>
                <Label className="text-sm font-medium">Routing Notes</Label>
                <p className="text-sm text-muted-foreground mt-1">{request.routingNotes}</p>
              </div>
            )}
          </div>

          {/* Rejection Reason Input */}
          {request.status === "pending" && (
            <div className="space-y-2">
              <Label htmlFor="rejection-reason" className="text-sm">
                Rejection Reason (optional, required when rejecting)
              </Label>
              <Textarea
                id="rejection-reason"
                placeholder="Provide a reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {/* Status Display (if already reviewed) */}
          {request.status !== "pending" && (
            <div className="p-3 rounded-md bg-muted">
              <div className="flex items-center gap-2">
                {request.status === "approved" ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                <span className="text-sm font-medium">
                  {request.status === "approved" ? "Approved" : "Rejected"}
                </span>
              </div>
              {request.rejectionReason && (
                <p className="text-sm text-muted-foreground mt-2">{request.rejectionReason}</p>
              )}
              {request.reviewedAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  Reviewed on {new Date(request.reviewedAt).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {request.status === "pending" ? (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={isProcessing || action === "approve"}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button
                onClick={handleApprove}
                disabled={isProcessing || action === "reject"}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Approve
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
