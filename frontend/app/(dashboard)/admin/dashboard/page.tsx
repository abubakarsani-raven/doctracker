"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Users, HardDrive, TrendingUp, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useDocuments } from "@/lib/hooks/use-documents";
import { useUsers } from "@/lib/hooks/use-users";
import { useWorkflows } from "@/lib/hooks/use-workflows";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function AdminDashboardPage() {
  const { data: documents = [], isLoading: documentsLoading } = useDocuments();
  const { data: users = [], isLoading: usersLoading } = useUsers();
  const { data: workflows = [], isLoading: workflowsLoading } = useWorkflows();
  
  const { data: storage, isLoading: storageLoading } = useQuery({
    queryKey: ["admin-storage"],
    queryFn: () => api.getTotalStorage(),
  });

  const stats = [
    {
      label: "Total Documents",
      value: documentsLoading ? "..." : documents.length.toLocaleString(),
      icon: FileText,
      isLoading: documentsLoading,
    },
    {
      label: "Active Users",
      value: usersLoading
        ? "..."
        : users
            .filter(
              (u: any) =>
                u.isActive === true ||
                String(u.status || "").toLowerCase() === "active",
            )
            .length.toString(),
      icon: Users,
      isLoading: usersLoading,
    },
    {
      label: "Storage Used",
      value: storageLoading ? "..." : (storage?.formatted || "0 Bytes"),
      icon: HardDrive,
      isLoading: storageLoading,
    },
    {
      label: "Active Workflows",
      value: workflowsLoading ? "..." : workflows.length.toString(),
      icon: TrendingUp,
      isLoading: workflowsLoading,
    },
  ];
  return (
    <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of system activity and metrics
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
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
                  <div className="text-2xl font-bold flex items-center gap-2">
                    {stat.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : stat.value}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Real-time data
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Additional Admin Sections */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Activity feed will be displayed here
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Database</span>
                  <Badge variant="default">Healthy</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Storage</span>
                  <Badge variant="default">Healthy</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">API</span>
                  <Badge variant="default">Healthy</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
  );
}
