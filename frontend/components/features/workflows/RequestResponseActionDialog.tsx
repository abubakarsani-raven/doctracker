"use client";

import { useState, useEffect } from "react";
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
import { MessageSquare, CheckCircle2, Send } from "lucide-react";
import { toast } from "sonner";
import { useUpdateAction } from "@/lib/hooks/use-actions";
import { useUpdateWorkflowProgress } from "@/lib/hooks/use-workflow-progress";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ActionCompletionDialog } from "./ActionCompletionDialog";

interface RequestResponseActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionId: string;
  action?: any;
  onResponseComplete?: () => void;
  isRequester?: boolean;
}

export function RequestResponseActionDialog({
  open,
  onOpenChange,
  actionId,
  action,
  onResponseComplete,
  isRequester = false,
}: RequestResponseActionDialogProps) {
  const [response, setResponse] = useState("");
  const [responseData, setResponseData] = useState("");
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const updateAction = useUpdateAction();
  const { updateProgress } = useUpdateWorkflowProgress();

  const hasResponded =
    action?.status === "response_received" || action?.response;

  useEffect(() => {
    if (!open) {
      setResponse("");
      setResponseData("");
    } else if (action?.response) {
      setResponse(action.response);
      setResponseData(action.responseData || "");
    }
  }, [open, action]);

  const handleSubmitResponse = async () => {
    if (!response.trim()) {
      toast.error("Please provide a response");
      return;
    }

    try {
      await updateAction.mutateAsync({
        id: actionId,
        data: {
          status: "response_received",
          response: response,
          responseData: responseData || response,
          responseReceivedAt: new Date().toISOString(),
        },
      });

      // Update workflow progress
      if (action?.workflowId) {
        await updateProgress(action.workflowId);
      }

      // TODO: Create notification via backend API when endpoint is available

      toast.success(
        "Response submitted successfully. You can mark the action as complete."
      );
      setCompletionDialogOpen(true);
      onResponseComplete?.();
    } catch (error: any) {
      console.error("Failed to submit response:", error);
      toast.error(error.message || "Failed to submit response. Please try again.");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {isRequester ? "View Request" : "Respond to Request"}
            </DialogTitle>
            <DialogDescription>
              {isRequester
                ? "View the request you sent and the response received"
                : "Provide the requested information to continue the workflow"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {action && (
              <>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm font-medium mb-1">{action.title}</p>
                  {action.description && (
                    <p className="text-xs text-muted-foreground mb-2">
                      {action.description}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Request Details</Label>
                  <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
                    <p className="text-sm">
                      {action.requestDetails || "No details provided"}
                    </p>
                  </div>
                </div>

                <Separator />

                {hasResponded ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>Response</Label>
                      <Badge variant="outline" className="text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Received
                      </Badge>
                    </div>
                    <div className="p-3 bg-green-50 dark:bg-green-950 rounded-md">
                      <p className="text-sm">{action.response}</p>
                      {action.responseReceivedAt && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Responded:{" "}
                          {new Date(action.responseReceivedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                    {action.responseData &&
                      action.responseData !== action.response && (
                        <div className="p-3 bg-muted rounded-md">
                          <Label className="text-xs">Additional Data:</Label>
                          <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                            {action.responseData}
                          </p>
                        </div>
                      )}
                  </div>
                ) : !isRequester ? (
                  <div className="space-y-2">
                    <Label htmlFor="response">Your Response *</Label>
                    <Textarea
                      id="response"
                      placeholder="Provide the requested information here..."
                      value={response}
                      onChange={(e) => setResponse(e.target.value)}
                      disabled={updateAction.isPending}
                      rows={6}
                    />
                    <div className="space-y-2">
                      <Label htmlFor="response-data">
                        Additional Data (Optional)
                      </Label>
                      <Textarea
                        id="response-data"
                        placeholder="Additional structured data, numbers, or details..."
                        value={responseData}
                        onChange={(e) => setResponseData(e.target.value)}
                        disabled={updateAction.isPending}
                        rows={4}
                      />
                      <p className="text-xs text-muted-foreground">
                        You can provide structured data here (e.g., budget
                        amounts, dates, figures) that can be used to continue
                        the workflow.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-md">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      Waiting for response from{" "}
                      {action.assignedTo?.name || "assigned party"}...
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {hasResponded || isRequester ? "Close" : "Cancel"}
            </Button>
            {!hasResponded && !isRequester && (
              <Button
                onClick={handleSubmitResponse}
                disabled={updateAction.isPending || !response.trim()}
              >
                <Send className="mr-2 h-4 w-4" />
                {updateAction.isPending
                  ? "Submitting..."
                  : "Submit Response"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Completion Dialog for Requester */}
      {action && hasResponded && isRequester && (
        <ActionCompletionDialog
          open={completionDialogOpen}
          onOpenChange={(open) => {
            setCompletionDialogOpen(open);
            if (!open) {
              onOpenChange(false);
            }
          }}
          actionId={actionId}
          action={action}
          onActionCompleted={() => {
            onResponseComplete?.();
            onOpenChange(false);
          }}
        />
      )}
    </>
  );
}
