"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Building2, Users, ChevronRight, Loader2, Network } from "lucide-react";
import { EmptyState } from "@/components/common";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useCompany } from "@/lib/hooks/use-companies";
import { useUsers } from "@/lib/hooks/use-users";
import { format } from "date-fns";

export default function CompanyDetailPage() {
  const params = useParams();
  const companyId = params.id as string;

  const { data: company, isLoading, error } = useCompany(companyId);
  const { data: allUsers = [] } = useUsers();

  const companyUsers = useMemo(
    () => allUsers.filter((u: any) => u.companyId === companyId),
    [allUsers, companyId],
  );

  // Head-counts come from the real user list rather than a stored counter, so
  // they stay correct as people move between departments.
  const usersInDepartment = (departmentId: string) =>
    companyUsers.filter((u: any) => u.departmentIds?.includes(departmentId)).length;

  const usersInDivision = (divisionId: string) =>
    companyUsers.filter((u: any) => u.divisionIds?.includes(divisionId)).length;

  const departments = company?.departments ?? [];
  const divisionCount = useMemo(
    () =>
      departments.reduce(
        (total: number, dept: any) => total + (dept.divisions?.length ?? 0),
        0,
      ),
    [departments],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="space-y-6">
        <Link
          href="/admin/companies"
          className="text-sm text-muted-foreground hover:text-foreground inline-block"
        >
          ← Back to Companies
        </Link>
        <EmptyState
          icon={Building2}
          title="Company not found"
          description="This company does not exist, or you do not have access to it."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/admin/companies"
          className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block"
        >
          ← Back to Companies
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{company.name}</h1>
            {company.createdAt && (
              <p className="text-muted-foreground">
                Created {format(new Date(company.createdAt), "d MMM yyyy")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{companyUsers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Departments</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{departments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Divisions</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{divisionCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="departments">Departments & Divisions</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>
                General information about the company
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input value={company.name} disabled />
              </div>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Created</Label>
                  <p className="text-sm">
                    {company.createdAt
                      ? format(new Date(company.createdAt), "d MMM yyyy, HH:mm")
                      : "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Last updated</Label>
                  <p className="text-sm">
                    {company.updatedAt
                      ? format(new Date(company.updatedAt), "d MMM yyyy, HH:mm")
                      : "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Departments Tab */}
        <TabsContent value="departments">
          <Card>
            <CardHeader>
              <CardTitle>Departments & Divisions</CardTitle>
              <CardDescription>
                Organizational structure for {company.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {departments.length === 0 ? (
                <EmptyState
                  icon={Building2}
                  title="No departments yet"
                  description="This company has no departments configured."
                />
              ) : (
                <div className="space-y-4">
                  {departments.map((dept: any) => (
                    <div key={dept.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Building2 className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <h3 className="font-semibold">{dept.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {usersInDepartment(dept.id)} users
                            </p>
                          </div>
                        </div>
                      </div>
                      {(dept.divisions?.length ?? 0) > 0 && (
                        <div className="ml-8 space-y-2 border-l-2 pl-4">
                          {dept.divisions.map((division: any) => (
                            <div
                              key={division.id}
                              className="flex items-center justify-between py-2"
                            >
                              <div className="flex items-center gap-2">
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{division.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {usersInDivision(division.id)} users
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
