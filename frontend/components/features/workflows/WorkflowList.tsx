"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingState } from "@/components/common";
import { Workflow, Clock, User, CheckCircle2, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface WorkflowListProps {
  workflows: any[];
  isLoading?: boolean;
  title?: string;
}

export function WorkflowList({ workflows, isLoading, title = "Workflows" }: WorkflowListProps) {
  const router = useRouter();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-600">Completed</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-600">In Progress</Badge>;
      case "ready_for_review":
        return <Badge className="bg-yellow-600">Ready for Review</Badge>;
      case "assigned":
        return <Badge variant="outline">Assigned</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingState type="card" />
        </CardContent>
      </Card>
    );
  }

  if (!workflows || workflows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Workflow}
            title="No workflows"
            description="No workflows have been created for this resource yet."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Workflow className="h-5 w-5" />
          {title} ({workflows.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {workflows.map((workflow) => {
            const assignedToName =
              typeof workflow.assignedTo === "object"
                ? workflow.assignedTo?.name || "Unassigned"
                : workflow.assignedToName || "Unassigned";

            const creatorName =
              workflow.creator?.name ||
              workflow.creator?.email ||
              workflow.assignedBy ||
              "Unknown";

            const completedActions =
              workflow.actions?.filter(
                (a: any) =>
                  a.status === "completed" ||
                  a.status === "document_uploaded" ||
                  a.status === "response_received"
              ) || [];
            const totalActions = workflow.actions?.length || 0;
            const progress =
              totalActions > 0
                ? Math.round((completedActions.length / totalActions) * 100)
                : workflow.progress || 0;

            return (
              <div
                key={workflow.id}
                className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => router.push(`/workflows/${workflow.id}`)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-base">{workflow.title}</h3>
                      {getStatusBadge(workflow.status)}
                    </div>

                    {workflow.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {workflow.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>
                          Assigned to: <strong>{assignedToName}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>
                          Created by: <strong>{creatorName}</strong>
                        </span>
                      </div>
                      {workflow.createdAt && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>
                            {formatDistanceToNow(new Date(workflow.createdAt), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                      )}
                      {totalActions > 0 && (
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>
                            {completedActions.length}/{totalActions} actions completed ({progress}%)
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Routing History Summary */}
                    {workflow.routingHistory && workflow.routingHistory.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Routing:</span>{" "}
                        {workflow.routingHistory.length} route
                        {workflow.routingHistory.length !== 1 ? "s" : ""}
                        {workflow.routingHistory.length > 0 && (
                          <span>
                            {" "}
                            • Last routed to:{" "}
                            {workflow.routingHistory[workflow.routingHistory.length - 1]?.toName ||
                              workflow.routingHistory[workflow.routingHistory.length - 1]?.to?.name ||
                              "Unknown"}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/workflows/${workflow.id}`);
                    }}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

