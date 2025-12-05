"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle2, XCircle, Building2, ArrowRight, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { CrossCompanyApprovalRequest } from "@/lib/cross-company-utils";
import { CompanyBadge } from "./CompanyBadge";

interface ApprovalRequestCardProps {
  request: CrossCompanyApprovalRequest;
  onApprove?: (requestId: string) => void;
  onReject?: (requestId: string) => void;
  showActions?: boolean;
}

export function ApprovalRequestCard({
  request,
  onApprove,
  onReject,
  showActions = true,
}: ApprovalRequestCardProps) {
  const getStatusBadge = () => {
    switch (request.status) {
      case "pending":
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="default" className="flex items-center gap-1 bg-green-500">
            <CheckCircle2 className="h-3 w-3" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Rejected
          </Badge>
        );
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
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">{getRequestTypeLabel()}</CardTitle>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <CompanyBadge companyName={request.sourceCompanyName} variant="outline" size="sm" />
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <CompanyBadge companyName={request.targetCompanyName} variant="outline" size="sm" />
            </div>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-medium text-sm mb-1">
            {request.workflowTitle || request.actionTitle || "Untitled"}
          </h4>
          {(request.workflowDescription || request.actionDescription) && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {request.workflowDescription || request.actionDescription}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3" />
            <span>
              Assign to: <strong>{request.assignedTo.name}</strong> ({request.assignedTo.type})
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              Requested {formatDistanceToNow(new Date(request.requestedAt), { addSuffix: true })}
            </span>
          </div>
          {request.reviewedAt && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                {request.status === "approved" ? "Approved" : "Rejected"}{" "}
                {formatDistanceToNow(new Date(request.reviewedAt), { addSuffix: true })}
              </span>
            </div>
          )}
          {request.rejectionReason && (
            <div className="mt-2 p-2 bg-destructive/10 rounded-md">
              <p className="text-xs text-destructive">
                <strong>Reason:</strong> {request.rejectionReason}
              </p>
            </div>
          )}
        </div>

        {showActions && request.status === "pending" && onApprove && onReject && (
          <div className="flex items-center gap-2 pt-2 border-t">
            <Button
              size="sm"
              variant="default"
              className="flex-1"
              onClick={() => onApprove(request.id)}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="flex-1"
              onClick={() => onReject(request.id)}
            >
              <XCircle className="h-3 w-3 mr-1" />
              Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
