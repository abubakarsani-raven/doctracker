"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Clock, User, Building2, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
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
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTimeline();
    
    const handleUpdate = () => {
      loadTimeline();
    };
    
    window.addEventListener("workflowsUpdated", handleUpdate);
    
    return () => {
      window.removeEventListener("workflowsUpdated", handleUpdate);
    };
  }, [workflowId]);

  const loadTimeline = async () => {
    setLoading(true);
    try {
      const workflows = await api.getWorkflows();
      const localWorkflows = JSON.parse(localStorage.getItem("workflows") || "[]");
      const allWorkflows = [...workflows, ...localWorkflows];
      const workflow = allWorkflows.find((w: any) => w.id === workflowId);
      
      if (!workflow) {
        setEvents([]);
        return;
      }
      
      const timelineEvents: TimelineEvent[] = [];
      
      // Add workflow creation event
      if (workflow.assignedAt) {
        timelineEvents.push({
          id: "created",
          state: "Created",
          changedBy: workflow.assignedBy || "System",
          changedAt: new Date(workflow.assignedAt),
          notes: workflow.description || `Workflow "${workflow.title || workflow.folderName || workflow.documentName}" created`,
          type: "created",
        });
      }
      
      // Add initial assignment
      if (workflow.assignedTo) {
        timelineEvents.push({
          id: "assigned",
          state: "Assigned",
          changedBy: workflow.assignedBy || "System",
          changedAt: new Date(workflow.assignedAt || new Date()),
          notes: `Assigned to ${workflow.assignedTo.name?.trim() || (typeof workflow.assignedTo === "string" ? workflow.assignedTo : "Unassigned")}`,
          type: "status_change",
        });
      }
      
      // Add routing history events
      if (workflow.routingHistory && workflow.routingHistory.length > 0) {
        workflow.routingHistory.forEach((route: any, index: number) => {
          const fromName = route.from?.name || route.from || "Unknown";
          const toName = route.to?.name || route.to || "Unknown";
          
          // Build routing notes with company context if cross-company
          let routingNotes = route.notes || `Routed from ${fromName} to ${toName}`;
          if (route.routingType === "cross_company" || route.isCrossCompany) {
            routingNotes = `Cross-company routing: ${fromName} → ${toName}${route.notes ? ` - ${route.notes}` : ""}`;
          }
          
          timelineEvents.push({
            id: `route-${index}`,
            state: route.routingType === "cross_company" || route.isCrossCompany ? "Cross-Company Routed" : "Routed",
            changedBy: route.routedBy || "System",
            changedAt: new Date(route.routedAt),
            notes: routingNotes,
            type: route.routingType === "cross_company" || route.isCrossCompany ? "cross_company_routed" : "routed",
            from: route.from,
            to: route.to,
            isCrossCompany: route.routingType === "cross_company" || route.isCrossCompany,
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
        
        // Only add if status is different from last event
        if (!lastEvent || lastEvent.state !== statusLabel) {
          timelineEvents.push({
            id: "current-status",
            state: statusLabel,
            changedBy: "System",
            changedAt: new Date(),
            notes: `Current status: ${statusLabel}`,
            type: "status_change",
          });
        }
      }
      
      // Sort by date
      timelineEvents.sort((a, b) => 
        new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime()
      );
      
      setEvents(timelineEvents);
    } catch (error) {
      console.error("Failed to load timeline:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Workflow Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading timeline...</p>
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
          <p className="text-sm text-muted-foreground">No timeline events yet.</p>
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
              <div key={event.id} className="relative flex gap-4 pb-8 last:pb-0">
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
                  {event.type === "routed" ? (
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
                    <p className={cn("font-medium", isCompleted && "text-foreground")}>
                      {event.state}
                    </p>
                    {isCurrent && <Badge variant="default">Current</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {event.changedBy} •{" "}
                    {formatDistanceToNow(event.changedAt, { addSuffix: true })}
                  </p>
                  {event.notes && (
                    <p className="text-sm text-muted-foreground">{event.notes}</p>
                  )}
                  {(event.type === "routed" || event.type === "cross_company_routed") && event.from && event.to && (
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
