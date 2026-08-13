"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
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
import { formatDistanceToNow } from "date-fns";

export const ACCESS_SCOPE_LABELS: Record<string, string> = {
  company: "Company-wide",
  department: "Department-wide",
  division: "Division-wide",
};

export function accessRequestDecidedAt(request: AccessRequest): string {
  return request.approvedAt || request.rejectedAt || request.updatedAt;
}

interface AccessRequestCardProps {
  request: AccessRequest;
  currentUser: any;
  onApprove?: (id: string) => void;
  onReject?: (request: AccessRequest) => void;
  onRevoke?: (request: AccessRequest) => void;
  busy?: boolean;
}

export function AccessRequestCard({
  request,
  currentUser,
  onApprove,
  onReject,
  onRevoke,
  busy,
}: AccessRequestCardProps) {
  const canDecide = canApproveAccessRequest(request, currentUser);
  const mine = request.requestedBy === currentUser?.id;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {request.resourceType === "document" ? (
              <FileText className="mt-1 h-5 w-5 shrink-0 text-blue-500" />
            ) : (
              <Folder className="mt-1 h-5 w-5 shrink-0 text-yellow-500" />
            )}
            <div className="min-w-0">
              <CardTitle className="text-lg break-words">
                {request.resourceName}
              </CardTitle>
              <CardDescription className="mt-1 flex flex-wrap items-center gap-2">
                <span>
                  {mine ? "You requested this" : `Requested by ${request.requestedByName}`}
                </span>
                {request.scope && (
                  <Badge variant="outline">
                    {ACCESS_SCOPE_LABELS[request.scope] ?? request.scope}
                  </Badge>
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
            className="shrink-0 capitalize"
          >
            {request.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {request.reason && (
          <div>
            <Label className="text-sm font-medium">Reason</Label>
            <p className="mt-1 text-sm text-muted-foreground">{request.reason}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
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
          <div className="rounded-md bg-destructive/10 p-3">
            <Label className="text-sm font-medium text-destructive">
              {request.status === "approved" ? "Note" : "Rejection reason"}
            </Label>
            <p className="mt-1 text-sm text-destructive">
              {request.rejectionReason}
            </p>
          </div>
        )}

        {request.status === "pending" && canDecide && onApprove && onReject && (
          <div className="flex items-center gap-2 border-t pt-2">
            <Button
              size="sm"
              onClick={() => onApprove(request.id)}
              className="flex-1"
              disabled={busy}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onReject(request)}
              className="flex-1"
              disabled={busy}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
          </div>
        )}
        {request.status === "approved" && canDecide && onRevoke && (
          <div className="flex items-center gap-2 border-t pt-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onRevoke(request)}
              className="flex-1"
              disabled={busy}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Revoke access
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
