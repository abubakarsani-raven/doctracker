"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, LoadingState, QueryErrorState } from "@/components/common";
import { Activity, Filter } from "lucide-react";
import { useActivity, useRecentActivity } from "@/lib/hooks/use-activity";
import { formatDistanceToNow } from "date-fns";

export default function ActivityPage() {
  const [activityTypeFilter, setActivityTypeFilter] = useState<string>("all");
  const { data: activities = [], isLoading, isError, error, refetch } = useActivity({
    activityType: activityTypeFilter !== "all" ? activityTypeFilter : undefined,
    limit: 100,
  });
  const { data: recentActivities = [] } = useRecentActivity(20);

  const displayActivities = activities.length > 0 ? activities : (recentActivities.length > 0 ? recentActivities : []);

  const activityIcons: Record<string, string> = {
    workflow_created: "📋",
    workflow_updated: "🔄",
    workflow_routed: "➡️",
    action_created: "✅",
    action_completed: "✔️",
    document_uploaded: "📄",
    document_updated: "📝",
    note_added: "💬",
    access_requested: "🔒",
    access_approved: "🔓",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Activity Feed</h1>
          <p className="text-muted-foreground">
            View recent activity across your documents and workflows
          </p>
        </div>
        <Select value={activityTypeFilter} onValueChange={setActivityTypeFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Activities</SelectItem>
            <SelectItem value="workflow_created">Workflows</SelectItem>
            <SelectItem value="action_created">Actions</SelectItem>
            <SelectItem value="document_uploaded">Documents</SelectItem>
            <SelectItem value="note_added">Notes</SelectItem>
            <SelectItem value="access_requested">Access Requests</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingState type="card" />
      ) : isError ? (
        <QueryErrorState
          title="Failed to load activity"
          error={error}
          onRetry={() => refetch()}
        />
      ) : displayActivities.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activity found"
          description="Activity will appear here as you and your team work on documents and workflows."
        />
      ) : (
        <div className="space-y-4">
          {displayActivities.map((activity: any) => (
            <Card key={activity.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="text-2xl">
                    {activityIcons[activity.activityType] || "📌"}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{activity.description}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {activity.createdAt
                        ? formatDistanceToNow(new Date(activity.createdAt), {
                            addSuffix: true,
                          })
                        : "Recently"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

