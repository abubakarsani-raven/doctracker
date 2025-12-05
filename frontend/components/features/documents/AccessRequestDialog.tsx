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
import { useMockData } from "@/lib/contexts/MockDataContext";
import { createAccessRequest, hasPendingRequest, getApproversForScope } from "@/lib/access-request-utils";

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
  const [requesting, setRequesting] = useState(false);
  const { currentUser } = useMockData();

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
    if (hasPendingRequest(resourceId, resourceType, currentUser)) {
      toast.error("You already have a pending request for this resource");
      return;
    }

    setRequesting(true);
    try {
      createAccessRequest({
        resourceId,
        resourceType,
        resourceName,
        scope,
        reason: reason.trim(),
        requestedBy: currentUser.id,
        requestedByName: currentUser.name || currentUser.email || "Unknown User",
        companyId: currentUser.companyId,
        departmentId: currentUser.departmentId,
      });

      toast.success("Access request submitted successfully");
      onOpenChange(false);
      setReason("");
    } catch (error) {
      console.error("Failed to submit access request:", error);
      toast.error("Failed to submit access request. Please try again.");
    } finally {
      setRequesting(false);
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
            Request access to {resourceType === "folder" ? "folder" : "document"}: <strong>{resourceName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {scope && (
            <div className="flex items-center gap-2">
              <Label>Scope:</Label>
              <Badge variant="outline">{scopeLabels[scope]}</Badge>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Access Request *</Label>
            <Textarea
              id="reason"
              placeholder="Explain why you need access to this resource..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              disabled={requesting}
            />
            <p className="text-xs text-muted-foreground">
              Your request will be reviewed by: {approverText}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={requesting}
          >
            Cancel
          </Button>
          <Button onClick={handleRequest} disabled={!reason.trim() || requesting}>
            {requesting ? "Submitting..." : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
