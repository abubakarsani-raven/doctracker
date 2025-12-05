"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common";
import { Plus, Upload, MessageSquare, CheckCircle2, Clock, User, Building2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { api } from "@/lib/api";
import { useMockData } from "@/lib/contexts/MockDataContext";
import { ActionCompletionDialog } from "./ActionCompletionDialog";
import { DocumentUploadActionDialog } from "./DocumentUploadActionDialog";
import { RequestResponseActionDialog } from "./RequestResponseActionDialog";

interface WorkflowActionsListProps {
  workflowId: string;
  onCreateAction?: () => void;
}

export function WorkflowActionsList({
  workflowId,
  onCreateAction,
}: WorkflowActionsListProps) {
  const { currentUser } = useMockData();
  const [actions, setActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [responseDialogOpen, setResponseDialogOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<any>(null);

  useEffect(() => {
    loadActions();
    
    // Listen for action updates
    const handleActionUpdate = () => {
      loadActions();
    };
    window.addEventListener("actionsUpdated", handleActionUpdate);
    
    return () => {
      window.removeEventListener("actionsUpdated", handleActionUpdate);
    };
  }, [workflowId]);

  const loadActions = async () => {
    setLoading(true);
    try {
      const allActions = await api.getActions();
      const localActions = JSON.parse(localStorage.getItem("actions") || "[]");
      
      // Merge and filter by workflow
      const allWorkflowActions = [...allActions, ...localActions]
        .filter((action: any) => action.workflowId === workflowId);
      
      // Deduplicate
      const uniqueActions = Array.from(
        new Map(allWorkflowActions.map((a: any) => [a.id, a])).values()
      );
      
      setActions(uniqueActions);
    } catch (error) {
      console.error("Failed to load actions:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActionTypeIcon = (type?: string) => {
    switch (type) {
      case "document_upload":
        return <Upload className="h-4 w-4" />;
      case "request_response":
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <CheckCircle2 className="h-4 w-4" />;
    }
  };

  const getActionTypeLabel = (type?: string) => {
    switch (type) {
      case "document_upload":
        return "Upload Document";
      case "request_response":
        return "Request/Response";
      default:
        return "Regular";
    }
  };

  const getStatusBadge = (action: any) => {
    const status = action.status;
    if (status === "completed") {
      return <Badge className="bg-green-600">Completed</Badge>;
    } else if (status === "document_uploaded") {
      return <Badge className="bg-blue-600">Document Uploaded</Badge>;
    } else if (status === "response_received") {
      return <Badge className="bg-blue-600">Response Received</Badge>;
    } else if (status === "in_progress") {
      return <Badge className="bg-yellow-600">In Progress</Badge>;
    } else {
      return <Badge variant="outline">Pending</Badge>;
    }
  };

  const handleActionClick = (action: any) => {
    setSelectedAction(action);
    
    if (action.type === "document_upload" && action.status === "pending") {
      setUploadDialogOpen(true);
    } else if (action.type === "document_upload" && action.status === "document_uploaded") {
      // Allow marking document upload as complete
      setCompletionDialogOpen(true);
    } else if (action.type === "request_response" && !action.response) {
      // Show response dialog if no response yet
      setResponseDialogOpen(true);
    } else if (action.type === "request_response" && action.status === "response_received") {
      // Allow requester to mark response action as complete
      setCompletionDialogOpen(true);
    } else if (action.type === "request_response") {
      // View/respond to request
      setResponseDialogOpen(true);
    } else if (action.status !== "completed") {
      setCompletionDialogOpen(true);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading actions...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Actions</h2>
        {onCreateAction && (
          <Button onClick={onCreateAction} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Create Action
          </Button>
        )}
      </div>

      {actions.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No actions yet"
          description="Create actions to track work that needs to be done for this workflow"
          action={onCreateAction ? {
            label: "Create Action",
            onClick: onCreateAction,
          } : undefined}
        />
      ) : (
        <div className="space-y-3">
          {actions.map((action) => (
            <Card
              key={action.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleActionClick(action)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getActionTypeIcon(action.type)}
                      <CardTitle className="text-base">{action.title}</CardTitle>
                    </div>
                    {action.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {action.description}
                      </p>
                    )}
                  </div>
                  {getStatusBadge(action)}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    {action.assignedTo?.type === "user" ? (
                      <User className="h-3 w-3" />
                    ) : (
                      <Building2 className="h-3 w-3" />
                    )}
                    <span>Assigned to: {action.assignedTo?.name?.trim() || "Unassigned"}</span>
                  </div>
                  {action.type && (
                    <Badge variant="outline" className="text-xs">
                      {getActionTypeLabel(action.type)}
                    </Badge>
                  )}
                  {action.createdAt && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>Created {formatDistanceToNow(new Date(action.createdAt), { addSuffix: true })}</span>
                    </div>
                  )}
                </div>
                {action.type === "document_upload" && action.status === "pending" && (
                  <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950 rounded-md">
                    <p className="text-xs text-blue-800 dark:text-blue-200">
                      Click to upload the required document
                    </p>
                  </div>
                )}
                {action.type === "document_upload" && action.status === "document_uploaded" && (
                  <div className="mt-2 p-2 bg-green-50 dark:bg-green-950 rounded-md">
                    <p className="text-xs text-green-800 dark:text-green-200">
                      Document uploaded. Click to mark action as complete.
                    </p>
                  </div>
                )}
                {action.type === "request_response" && action.status === "pending" && (
                  <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-950 rounded-md">
                    <p className="text-xs text-yellow-800 dark:text-yellow-200">
                      Click to respond to this request
                    </p>
                  </div>
                )}
                {action.type === "request_response" && action.status === "response_received" && (
                  <div className="mt-2 p-2 bg-green-50 dark:bg-green-950 rounded-md">
                    <p className="text-xs text-green-800 dark:text-green-200">
                      Response received. Click to view and mark as complete.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Action Completion Dialog */}
      {selectedAction && completionDialogOpen && (
        <ActionCompletionDialog
          open={completionDialogOpen}
          onOpenChange={(open) => {
            setCompletionDialogOpen(open);
            if (!open) setSelectedAction(null);
          }}
          actionId={selectedAction.id}
          action={selectedAction}
          onActionCompleted={loadActions}
        />
      )}

      {/* Document Upload Dialog */}
      {selectedAction && selectedAction.type === "document_upload" && (
        <DocumentUploadActionDialog
          open={uploadDialogOpen}
          onOpenChange={(open) => {
            setUploadDialogOpen(open);
            if (!open) setSelectedAction(null);
          }}
          actionId={selectedAction.id}
          action={selectedAction}
          onUploadComplete={loadActions}
        />
      )}

      {/* Request/Response Dialog */}
      {selectedAction && selectedAction.type === "request_response" && (
        <RequestResponseActionDialog
          open={responseDialogOpen}
          onOpenChange={(open) => {
            setResponseDialogOpen(open);
            if (!open) setSelectedAction(null);
          }}
          actionId={selectedAction.id}
          action={selectedAction}
          onResponseComplete={loadActions}
          isRequester={currentUser && selectedAction?.createdBy === currentUser.name}
        />
      )}
    </div>
  );
}
