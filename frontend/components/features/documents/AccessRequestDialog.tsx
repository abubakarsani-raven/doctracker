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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Lock, User, Building2, Users } from "lucide-react";
import { useCurrentUser } from "@/lib/hooks/use-users";
import {
  getApproversForScope,
  hasPendingRequest,
} from "@/lib/access-request-utils";
import { useCreateAccessRequest } from "@/lib/hooks/use-access-requests";

interface AccessRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceId: string;
  resourceType: "folder" | "document";
  resourceName: string;
  scope?: "company" | "department" | "division";
}

export function AccessRequestDialog({
  open,
  onOpenChange,
  resourceId,
  resourceType,
  resourceName,
  scope,
}: AccessRequestDialogProps) {
  const [reason, setReason] = useState("");
  const { data: currentUser } = useCurrentUser();
  const createRequest = useCreateAccessRequest();

  const scopeLabels: Record<string, string> = {
    company: "Company-wide",
    department: "Department-wide",
    division: "Division-wide",
  };

  const approvers = getApproversForScope(scope);
  const approverText = approvers.join(", ");

  const handleRequest = async () => {
    if (!reason.trim()) {
      toast.error("Please provide a reason for access");
      return;
    }

    if (!currentUser) {
      toast.error("You must be logged in to request access");
      return;
    }

    // Check if user already has a pending request
    // TODO: Implement hasPendingRequest check via API when endpoint is available
    // if (hasPendingRequest(resourceId, resourceType, currentUser)) {
    //   toast.error("You already have a pending request for this resource");
    //   return;
    // }

    try {
      await createRequest.mutateAsync({
        resourceId,
        resourceType,
        resourceName,
        scope,
        reason: reason.trim(),
        requestedBy: currentUser.id || currentUser.email || "Unknown",
        requestedByName: currentUser.name || currentUser.email || "Unknown User",
        companyId: currentUser.companyId,
        departmentId: currentUser.departmentId,
      });

      setReason("");
      onOpenChange(false);
    } catch (error: any) {
      // Error toast is handled by the mutation hook
      console.error("Failed to submit access request:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Request Access
          </DialogTitle>
          <DialogDescription>
            Request access to {resourceType}: {resourceName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 bg-muted rounded-md">
            <p className="text-sm font-medium mb-1">{resourceName}</p>
            <p className="text-xs text-muted-foreground">
              {resourceType === "folder" ? "Folder" : "Document"}
              {scope && (
                <>
                  {" • "}
                  <Badge variant="outline" className="text-xs">
                    {scopeLabels[scope]}
                  </Badge>
                </>
              )}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="access-reason">Reason for Access *</Label>
            <Textarea
              id="access-reason"
              placeholder="Explain why you need access to this resource..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={createRequest.isPending}
              rows={4}
            />
          </div>

          {scope && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
              <p className="text-xs font-medium mb-1">
                This request will be reviewed by:
              </p>
              <p className="text-xs text-muted-foreground">{approverText}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createRequest.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRequest}
            disabled={createRequest.isPending || !reason.trim()}
          >
            {createRequest.isPending ? "Submitting..." : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
