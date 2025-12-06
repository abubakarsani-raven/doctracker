"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState } from "@/components/common";
import {
  CheckCircle2,
  Circle,
  Clock,
  User,
  Building2,
  ArrowRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useWorkflow } from "@/lib/hooks/use-workflows";
import { useUsers } from "@/lib/hooks/use-users";
import { CompanyBadge } from "./CompanyBadge";

interface TimelineEvent {
  id: string;
  state: string;
  changedBy: string;
  changedAt: Date;
  notes?: string;
  type?: "created" | "routed" | "status_change" | "cross_company_routed";
  from?: any;
  to?: any;
  isCrossCompany?: boolean;
}

interface WorkflowTimelineProps {
  workflowId: string;
}

export function WorkflowTimeline({ workflowId }: WorkflowTimelineProps) {
  const { data: workflow, isLoading } = useWorkflow(workflowId);
  const { data: users = [] } = useUsers();

  const events = useMemo(() => {
    if (!workflow) return [];

    const timelineEvents: TimelineEvent[] = [];

    // Helper function to get user name from ID or object
    const getUserName = (userIdOrObject: any): string => {
      if (!userIdOrObject) return "System";
      
      // If it's already an object with name/email, use that
      if (typeof userIdOrObject === "object") {
        return userIdOrObject.name || userIdOrObject.email || "Unknown";
      }
      
      // If it's an ID, try to find user in the users list
      if (typeof userIdOrObject === "string") {
        // Check if it's a UUID (likely an ID)
        if (userIdOrObject.includes("-")) {
          const user = users.find((u: any) => u.id === userIdOrObject);
          if (user) {
            return user.name || user.email || userIdOrObject;
          }
        }
        // Otherwise it might be a name already
        return userIdOrObject;
      }
      
      return "System";
    };

    // Get creator name - use creator relation if available, otherwise fallback to ID lookup
    const creatorName = workflow.creator?.name || 
                        workflow.creator?.email || 
                        getUserName(workflow.assignedBy) || 
                        "System";

    // Add workflow creation event
    if (workflow.createdAt || workflow.assignedAt) {
      timelineEvents.push({
        id: "created",
        state: "Created",
        changedBy: creatorName,
        changedAt: new Date(workflow.createdAt || workflow.assignedAt),
        notes:
          workflow.description ||
          `Workflow "${workflow.title || workflow.folderName || workflow.documentName || "Untitled"}" created`,
        type: "created",
      });
    }

    // Add initial assignment
    if (workflow.assignedTo) {
      timelineEvents.push({
        id: "assigned",
        state: "Assigned",
        changedBy: creatorName,
        changedAt: new Date(workflow.assignedAt || workflow.createdAt || new Date()),
        notes: `Assigned to ${
          typeof workflow.assignedTo === "object"
            ? workflow.assignedTo.name?.trim() || "Unassigned"
            : workflow.assignedTo || "Unassigned"
        }`,
        type: "status_change",
      });
    }

    // Add routing history events
    if (workflow.routingHistory && workflow.routingHistory.length > 0) {
      workflow.routingHistory.forEach((route: any, index: number) => {
        // Use database fields first (fromName, toName), then fallback to nested objects
        const fromName = route.fromName || route.from?.name || route.from || "Unknown";
        const toName = route.toName || route.to?.name || route.to || "Unknown";

        let routingNotes =
          route.notes || `Routed from ${fromName} to ${toName}`;
        if (route.routingType === "cross_company" || route.isCrossCompany) {
          routingNotes = `Cross-company routing: ${fromName} → ${toName}${
            route.notes ? ` - ${route.notes}` : ""
          }`;
        }

        timelineEvents.push({
          id: `route-${index}`,
          state:
            route.routingType === "cross_company" || route.isCrossCompany
              ? "Cross-Company Routed"
              : "Routed",
          changedBy: getUserName(route.routedBy) || "System",
          changedAt: new Date(route.routedAt),
          notes: routingNotes,
          type:
            route.routingType === "cross_company" || route.isCrossCompany
              ? "cross_company_routed"
              : "routed",
          from: route.from,
          to: route.to,
          isCrossCompany:
            route.routingType === "cross_company" || route.isCrossCompany,
        });
      });
    }

    // Add status change events based on current status
    if (workflow.status) {
      const statusLabels: Record<string, string> = {
        assigned: "Assigned",
        in_progress: "In Progress",
        ready_for_review: "Ready for Review",
        completed: "Completed",
      };

      const statusLabel = statusLabels[workflow.status] || workflow.status;
      const lastEvent = timelineEvents[timelineEvents.length - 1];

      if (!lastEvent || lastEvent.state !== statusLabel) {
        timelineEvents.push({
          id: "current-status",
          state: statusLabel,
          changedBy: "System",
          changedAt: new Date(workflow.updatedAt || workflow.createdAt || new Date()),
          notes: `Current status: ${statusLabel}`,
          type: "status_change",
        });
      }
    }

    // Sort by date
    return timelineEvents.sort(
      (a, b) =>
        new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime()
    );
  }, [workflow, users]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Workflow Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingState type="card" />
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Workflow Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Clock}
            title="No timeline events yet"
            description="Timeline events will appear here as the workflow progresses"
          />
        </CardContent>
      </Card>
    );
  }

  const currentEventIndex = events.length - 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workflow Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {events.map((event, index) => {
            const isCompleted = index <= currentEventIndex;
            const isCurrent = index === currentEventIndex;

            return (
              <div
                key={event.id}
                className="relative flex gap-4 pb-8 last:pb-0"
              >
                {/* Timeline Line */}
                {index < events.length - 1 && (
                  <div
                    className={cn(
                      "absolute left-5 top-10 w-0.5 h-full",
                      isCompleted ? "bg-primary" : "bg-muted"
                    )}
                  />
                )}

                {/* Icon */}
                <div
                  className={cn(
                    "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2",
                    isCompleted
                      ? "bg-primary border-primary text-primary-foreground"
                      : "bg-background border-muted text-muted-foreground"
                  )}
                >
                  {event.type === "routed" || event.type === "cross_company_routed" ? (
                    <ArrowRight className="h-5 w-5" />
                  ) : isCompleted ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p
                      className={cn(
                        "font-medium",
                        isCompleted && "text-foreground"
                      )}
                    >
                      {event.state}
                    </p>
                    {isCurrent && <Badge variant="default">Current</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {event.changedBy} •{" "}
                    {formatDistanceToNow(event.changedAt, { addSuffix: true })}
                  </p>
                  {event.notes && (
                    <p className="text-sm text-muted-foreground">
                      {event.notes}
                    </p>
                  )}
                  {(event.type === "routed" ||
                    event.type === "cross_company_routed") &&
                    event.from &&
                    event.to && (
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground flex-wrap">
                        {event.from.type === "user" ? (
                          <User className="h-3 w-3" />
                        ) : (
                          <Building2 className="h-3 w-3" />
                        )}
                        <span>{event.from.name || event.from}</span>
                        <ArrowRight className="h-3 w-3" />
                        {event.to.type === "user" ? (
                          <User className="h-3 w-3" />
                        ) : (
                          <Building2 className="h-3 w-3" />
                        )}
                        <span>{event.to.name || event.to}</span>
                        {event.isCrossCompany && (
                          <Badge variant="outline" className="text-xs">
                            Cross-Company
                          </Badge>
                        )}
                      </div>
                    )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
