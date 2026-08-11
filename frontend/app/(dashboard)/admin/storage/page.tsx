"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HardDrive, Loader2, Building2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useCompanies } from "@/lib/hooks/use-companies";

export default function AdminStoragePage() {
  const { data: totalStorage, isLoading: totalStorageLoading } = useQuery({
    queryKey: ["admin-total-storage"],
    queryFn: () => api.getTotalStorage(),
  });

  const { data: companies = [], isLoading: companiesLoading } = useCompanies();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Storage Analytics</h1>
        <p className="text-muted-foreground">
          Monitor storage usage across the system
        </p>
      </div>

      {/* Overall Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Storage Used</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {totalStorageLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                totalStorage?.formatted || "0 Bytes"
              )}
            </div>
            <p className="text-xs text-muted-foreground">Across all companies</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {companiesLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                companies.length
              )}
            </div>
            <p className="text-xs text-muted-foreground">Active companies</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Storage per Company</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {companiesLoading || totalStorageLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : companies.length > 0 ? (
                `${((totalStorage?.bytes || 0) / companies.length / (1024 * 1024 * 1024)).toFixed(1)} GB`
              ) : (
                "N/A"
              )}
            </div>
            <p className="text-xs text-muted-foreground">Average per company</p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Features */}
      <Card>
        <CardHeader>
          <CardTitle>Storage Management</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Detailed storage analytics, cleanup tools, and per-company breakdowns are coming soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}