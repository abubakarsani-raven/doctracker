"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentCard } from "@/components/common";
import { FileText, Workflow, CheckSquare, HardDrive, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useMockData } from "@/lib/contexts/MockDataContext";

export default function DashboardPage() {
  const router = useRouter();
  const { documents, workflows, actions, loading: contextLoading } = useMockData();
  const [stats, setStats] = useState({
    totalDocuments: 0,
    activeWorkflows: 0,
    pendingActions: 0,
    storageUsed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentDocuments, setRecentDocuments] = useState<any[]>([]);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        
        // Get stats from API or calculate from context data
        const statsData = await api.getDashboardStats();
        if (statsData) {
          setStats(statsData);
        } else {
          // Fallback: calculate from context data
          setStats({
            totalDocuments: documents.length,
            activeWorkflows: workflows.filter((w: any) => w.status !== "completed" && w.status !== "cancelled").length,
            pendingActions: actions.filter((a: any) => a.status === "pending").length,
            storageUsed: documents.reduce((sum: number, d: any) => sum + (d.size || 0), 0),
          });
        }

        // Get recent documents - use context data or fetch fresh
        const allDocs = documents.length > 0 
          ? documents 
          : await api.getDocuments();
        
        // Sort by modified date and take the 6 most recent
        const recent = [...allDocs]
          .sort((a: any, b: any) => {
            const dateA = new Date(a.modifiedAt || a.createdAt || 0).getTime();
            const dateB = new Date(b.modifiedAt || b.createdAt || 0).getTime();
            return dateB - dateA;
          })
          .slice(0, 6);
        
        setRecentDocuments(recent);
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
        // Use context data as fallback
        setStats({
          totalDocuments: documents.length,
          activeWorkflows: workflows.filter((w: any) => w.status !== "completed" && w.status !== "cancelled").length,
          pendingActions: actions.filter((a: any) => a.status === "pending").length,
          storageUsed: documents.reduce((sum: number, d: any) => sum + (d.size || 0), 0),
        });
        setRecentDocuments(documents.slice(0, 6));
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [documents, workflows, actions]);

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const statsConfig = [
    {
      label: "Total Documents",
      value: formatNumber(stats.totalDocuments),
      icon: FileText,
      change: null, // Can be calculated if we track historical data
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

  if (loading || contextLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
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
    </div>
  );
}
