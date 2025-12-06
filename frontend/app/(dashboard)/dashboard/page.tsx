"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentCard } from "@/components/common";
import { FileText, Workflow, CheckSquare, HardDrive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/common";
import { useDocuments } from "@/lib/hooks/use-documents";
import { useWorkflows } from "@/lib/hooks/use-workflows";
import { useActions } from "@/lib/hooks/use-actions";
import { useMyGoals } from "@/lib/hooks/use-goals";
import { useCurrentUser } from "@/lib/hooks/use-users";
import { isAssignedToAction } from "@/lib/action-utils";
import { api } from "@/lib/api";
import { Target } from "lucide-react";
import { format } from "date-fns";

export default function DashboardPage() {
  const router = useRouter();
  const { data: currentUser } = useCurrentUser();
  const { data: documents = [], isLoading: documentsLoading } = useDocuments();
  const { data: workflows = [], isLoading: workflowsLoading } = useWorkflows();
  const { data: actions = [], isLoading: actionsLoading } = useActions();
  const { data: goals = [], isLoading: goalsLoading } = useMyGoals();

  const isLoading = documentsLoading || workflowsLoading || actionsLoading || goalsLoading;

  // Filter actions to only show user's assigned actions
  const myActions = useMemo(() => {
    if (!currentUser) return [];
    return actions.filter((action: any) => isAssignedToAction(action, currentUser));
  }, [actions, currentUser]);

  // Filter workflows to only show user's workflows (assigned to them or created by them)
  const myWorkflows = useMemo(() => {
    if (!currentUser) return [];
    return workflows.filter((w: any) => {
      // Created by user
      if (w.assignedBy === currentUser.id || w.assignedBy === currentUser.email) {
        return true;
      }
      // Assigned to user
      if (w.assignedTo?.type === "user" && w.assignedTo.id === currentUser.id) {
        return true;
      }
      // Assigned to user's department
      if (w.assignedTo?.type === "department") {
        const deptName = w.assignedTo.name || w.assignedTo.id;
        
        // Check single department field (backward compatibility)
        if (currentUser.department && 
            (currentUser.department === deptName || 
             currentUser.department.toLowerCase() === deptName.toLowerCase())) {
          return true;
        }
        
        // Check departments array
        if (currentUser.departments && Array.isArray(currentUser.departments)) {
          if (currentUser.departments.some((dept: string) => 
            dept === deptName || dept.toLowerCase() === deptName.toLowerCase()
          )) {
            return true;
          }
        }
      }
      return false;
    });
  }, [workflows, currentUser]);

  // Calculate stats - only show user's own data
  const stats = useMemo(() => {
    return {
      totalDocuments: documents.length,
      activeWorkflows: myWorkflows.filter(
        (w: any) => w.status !== "completed" && w.status !== "cancelled"
      ).length,
      pendingActions: myActions.filter((a: any) => a.status === "pending").length,
      myGoals: goals.filter((g: any) => g.status !== "achieved").length,
      storageUsed: 0, // TODO: Calculate from actual file sizes when available
    };
  }, [documents, myWorkflows, myActions, goals]);

  // Get recent documents
  const recentDocuments = useMemo(() => {
    return [...documents]
      .sort((a: any, b: any) => {
        const dateA = new Date(a.modifiedAt || a.createdAt || 0).getTime();
        const dateB = new Date(b.modifiedAt || b.createdAt || 0).getTime();
        return dateB - dateA;
      })
      .slice(0, 6);
  }, [documents]);

  // Get recent pending goals
  const recentGoals = useMemo(() => {
    return [...goals]
      .filter((g: any) => g.status !== "achieved")
      .sort((a: any, b: any) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      })
      .slice(0, 3);
  }, [goals]);

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const statsConfig = [
    {
      label: "Total Documents",
      value: formatNumber(stats.totalDocuments),
      icon: FileText,
      change: null,
    },
    {
      label: "Active Workflows",
      value: formatNumber(stats.activeWorkflows),
      icon: Workflow,
      change: null,
    },
    {
      label: "Pending Actions",
      value: formatNumber(stats.pendingActions),
      icon: CheckSquare,
      change: null,
    },
    {
      label: "Storage Used",
      value: formatBytes(stats.storageUsed),
      icon: HardDrive,
      change: null,
    },
  ];

  if (isLoading) {
    return <LoadingState type="card" />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here's what's happening with your documents.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsConfig.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.label}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                {stat.change && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {stat.change} from last month
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
        {/* My Goals Card */}
        <Card 
          className="cursor-pointer hover:bg-accent transition-colors"
          onClick={() => router.push("/my-goals")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Goals</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.myGoals}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.myGoals === 1 ? "goal pending" : "goals pending"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Documents */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold tracking-tight">
            Recent Documents
          </h2>
          <Badge
            variant="outline"
            className="cursor-pointer hover:bg-accent"
            onClick={() => router.push("/documents")}
          >
            View All
          </Badge>
        </div>
        {recentDocuments.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No documents yet. Upload your first document to get started!
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recentDocuments.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onView={(id) => router.push(`/documents/${id}`)}
                onDownload={(id) => console.log("Download", id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recent Goals */}
      {recentGoals.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Target className="h-6 w-6" />
              My Recent Goals
            </h2>
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-accent"
              onClick={() => router.push("/my-goals")}
            >
              View All
            </Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {recentGoals.map((goal: any) => (
              <Card 
                key={goal.id}
                className="cursor-pointer hover:bg-accent transition-colors"
                onClick={() => router.push(`/workflows/${goal.workflow?.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-sm line-clamp-2 flex-1">
                      {goal.title}
                    </h3>
                    <Badge 
                      variant={goal.status === "in_progress" ? "default" : "outline"}
                      className={goal.status === "in_progress" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : ""}
                    >
                      {goal.status === "in_progress" ? "In Progress" : "Pending"}
                    </Badge>
                  </div>
                  {goal.workflow && (
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      From: {goal.workflow.title || "Untitled Workflow"}
                    </p>
                  )}
                  {goal.dueDate && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Due: {format(new Date(goal.dueDate), "MMM d, yyyy")}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
