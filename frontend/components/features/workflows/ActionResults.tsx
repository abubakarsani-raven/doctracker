"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingState } from "@/components/common";
import {
  CheckCircle2,
  Upload,
  MessageSquare,
  FileText,
  User,
  Building2,
  Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useActionsByWorkflow } from "@/lib/hooks/use-actions";
import Link from "next/link";

interface ActionResultsProps {
  workflowId: string;
}

export function ActionResults({ workflowId }: ActionResultsProps) {
  const { data: allActions = [], isLoading } = useActionsByWorkflow(workflowId);

  // Filter to only completed actions or actions with results
  const actions = useMemo(() => {
    return allActions.filter((action: any) => {
      const status = action.status;
      return (
        status === "completed" ||
        status === "document_uploaded" ||
        status === "response_received"
      );
    });
  }, [allActions]);

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
        return "Document Upload";
      case "request_response":
        return "Request/Response";
      default:
        return "Regular Action";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Action Results</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingState type="card" />
        </CardContent>
      </Card>
    );
  }

  if (actions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Action Results</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={CheckCircle2}
            title="No completed actions yet"
            description="Completed action results will appear here"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Action Results</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[600px]">
          <div className="space-y-4">
            {actions.map((action) => (
              <div
                key={action.id}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {getActionTypeIcon(action.type)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{action.title}</h4>
                        <Badge variant="outline" className="text-xs">
                          {getActionTypeLabel(action.type)}
                        </Badge>
                      </div>
                      {action.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {action.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge className="bg-green-600">
                    {action.status === "document_uploaded"
                      ? "Document Uploaded"
                      : action.status === "response_received"
                      ? "Response Received"
                      : "Completed"}
                  </Badge>
                </div>

                <Separator />

                {/* Document Upload Results */}
                {action.type === "document_upload" &&
                  action.uploadedDocumentId && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Uploaded Document:</p>
                      <div className="p-3 bg-muted rounded-md">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-500" />
                            <span className="text-sm">
                              {action.uploadedDocumentName || "Document"}
                            </span>
                          </div>
                          {action.targetFolderId && (
                            <Link href={`/documents/folder/${action.targetFolderId}`}>
                              <Button variant="ghost" size="sm">
                                View Folder
                              </Button>
                            </Link>
                          )}
                        </div>
                        {action.uploadedAt && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Uploaded{" "}
                            {formatDistanceToNow(new Date(action.uploadedAt), {
                              addSuffix: true,
                            })}{" "}
                            by {action.uploadedBy || "Unknown"}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                {/* Request/Response Results */}
                {action.type === "request_response" && action.response && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Request:</p>
                    <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
                      <p className="text-sm">
                        {action.requestDetails || "No details provided"}
                      </p>
                    </div>
                    <p className="text-sm font-medium">Response:</p>
                    <div className="p-3 bg-green-50 dark:bg-green-950 rounded-md">
                      <p className="text-sm">{action.response}</p>
                      {action.responseData &&
                        action.responseData !== action.response && (
                          <div className="mt-2 p-2 bg-background rounded border">
                            <p className="text-xs font-medium mb-1">
                              Additional Data:
                            </p>
                            <pre className="text-xs whitespace-pre-wrap">
                              {action.responseData}
                            </pre>
                          </div>
                        )}
                      {action.responseReceivedAt && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Responded{" "}
                          {formatDistanceToNow(
                            new Date(action.responseReceivedAt),
                            { addSuffix: true }
                          )}{" "}
                          by {action.respondedBy || "Unknown"}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Regular Action Results */}
                {action.type === "regular" && action.resolutionNotes && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Completion Notes:</p>
                    <div className="p-3 bg-muted rounded-md">
                      <p className="text-sm">{action.resolutionNotes}</p>
                    </div>
                  </div>
                )}

                {/* Action Metadata */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                  <div className="flex items-center gap-1">
                    {action.assignedTo?.type === "user" ? (
                      <User className="h-3 w-3" />
                    ) : (
                      <Building2 className="h-3 w-3" />
                    )}
                    <span>
                      Assigned to:{" "}
                      {action.assignedTo?.name?.trim() || action.assignedToName || "Unassigned"}
                    </span>
                  </div>
                  {(action.completedAt ||
                    action.uploadedAt ||
                    action.responseReceivedAt) && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>
                        {action.completedAt &&
                          `Completed ${formatDistanceToNow(
                            new Date(action.completedAt),
                            { addSuffix: true }
                          )}`}
                        {action.uploadedAt &&
                          `Uploaded ${formatDistanceToNow(
                            new Date(action.uploadedAt),
                            { addSuffix: true }
                          )}`}
                        {action.responseReceivedAt &&
                          `Responded ${formatDistanceToNow(
                            new Date(action.responseReceivedAt),
                            { addSuffix: true }
                          )}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
