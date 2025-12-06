"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Target, ExternalLink, Calendar } from "lucide-react";
import { LoadingState } from "@/components/common";
import { useMyGoals } from "@/lib/hooks/use-goals";
import { format, isPast, isToday } from "date-fns";
import { GoalCard } from "@/components/features/workflows/GoalCard";

export default function MyGoalsPage() {
  const router = useRouter();
  const { data: goals = [], isLoading } = useMyGoals();

  // Group goals by status
  const groupedGoals = useMemo(() => {
    const pending = goals.filter((g: any) => g.status === "pending");
    const inProgress = goals.filter((g: any) => g.status === "in_progress");
    const achieved = goals.filter((g: any) => g.status === "achieved");
    return { pending, inProgress, achieved };
  }, [goals]);

  // Count overdue goals
  const overdueCount = useMemo(() => {
    return goals.filter((g: any) => {
      if (g.status === "achieved") return false;
      const dueDate = g.dueDate ? new Date(g.dueDate) : null;
      return dueDate && !isPast(dueDate) === false && !isToday(dueDate);
    }).length;
  }, [goals]);

  if (isLoading) {
    return <LoadingState type="card" />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Target className="h-8 w-8" />
              My Goals
            </h1>
            <p className="text-muted-foreground mt-1">
              Goals assigned to you or your department across all workflows
            </p>
          </div>
          {goals.length > 0 && (
            <Badge variant="outline" className="text-sm">
              {goals.length} {goals.length === 1 ? "goal" : "goals"}
            </Badge>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {goals.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Goals</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{goals.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{groupedGoals.pending.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Target className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{groupedGoals.inProgress.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Achieved</CardTitle>
              <Target className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{groupedGoals.achieved.length}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Goals List */}
      {goals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Goals Assigned</h3>
            <p className="text-muted-foreground mb-4">
              You don't have any goals assigned to you or your department yet.
            </p>
            <p className="text-sm text-muted-foreground">
              Goals are created in workflows after they are ready for review or completed.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Pending Goals */}
          {groupedGoals.pending.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-1 w-1 rounded-full bg-gray-400" />
                <h2 className="text-xl font-semibold">
                  Pending Goals
                  <span className="text-muted-foreground font-normal ml-2">
                    ({groupedGoals.pending.length})
                  </span>
                </h2>
              </div>
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {groupedGoals.pending.map((goal: any) => (
                  <div key={goal.id} className="relative">
                    <GoalCard
                      goal={goal}
                      workflowId={goal.workflow?.id || ""}
                      onGoalUpdated={() => {}}
                    />
                    {goal.workflow?.id && (
                      <div className="mt-2 flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push(`/workflows/${goal.workflow.id}`)}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Workflow
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* In Progress Goals */}
          {groupedGoals.inProgress.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-1 w-1 rounded-full bg-blue-500" />
                <h2 className="text-xl font-semibold">
                  In Progress
                  <span className="text-muted-foreground font-normal ml-2">
                    ({groupedGoals.inProgress.length})
                  </span>
                </h2>
              </div>
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {groupedGoals.inProgress.map((goal: any) => (
                  <div key={goal.id} className="relative">
                    <GoalCard
                      goal={goal}
                      workflowId={goal.workflow?.id || ""}
                      onGoalUpdated={() => {}}
                    />
                    {goal.workflow?.id && (
                      <div className="mt-2 flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push(`/workflows/${goal.workflow.id}`)}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Workflow
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Achieved Goals */}
          {groupedGoals.achieved.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-1 w-1 rounded-full bg-green-600" />
                <h2 className="text-xl font-semibold">
                  Achieved
                  <span className="text-muted-foreground font-normal ml-2">
                    ({groupedGoals.achieved.length})
                  </span>
                </h2>
              </div>
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {groupedGoals.achieved.map((goal: any) => (
                  <div key={goal.id} className="relative">
                    <GoalCard
                      goal={goal}
                      workflowId={goal.workflow?.id || ""}
                      onGoalUpdated={() => {}}
                    />
                    {goal.workflow?.id && (
                      <div className="mt-2 flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push(`/workflows/${goal.workflow.id}`)}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Workflow
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
