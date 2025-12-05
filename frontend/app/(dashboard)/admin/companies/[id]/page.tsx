"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Building2, Users, FileText, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/common";
import { useParams } from "next/navigation";
import Link from "next/link";

// Mock data
const companyData = {
  id: "1",
  name: "Acme Corporation",
  domain: "acme.com",
  description: "A leading corporation in technology and innovation",
  status: "active",
  users: 45,
  documents: 1234,
  departments: [
    {
      id: "1",
      name: "Legal",
      users: 12,
      divisions: [
        { id: "1", name: "Contracts", users: 5 },
        { id: "2", name: "Compliance", users: 7 },
      ],
    },
    {
      id: "2",
      name: "HR",
      users: 15,
      divisions: [],
    },
    {
      id: "3",
      name: "Finance",
      users: 18,
      divisions: [
        { id: "3", name: "Accounting", users: 10 },
        { id: "4", name: "Payroll", users: 8 },
      ],
    },
  ],
};

export default function CompanyDetailPage() {
  const params = useParams();
  const companyId = params.id as string;
  const [company] = useState(companyData);

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
              <p className="text-muted-foreground">{company.domain}</p>
            </div>
            <Badge variant={company.status === "active" ? "default" : "secondary"} className="ml-auto">
              {company.status}
            </Badge>
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
              <div className="text-2xl font-bold">{company.users}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{company.documents.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Departments</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{company.departments.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="departments">Departments & Divisions</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
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
                <div className="space-y-2">
                  <Label>Domain</Label>
                  <Input value={company.domain} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <p className="text-sm text-muted-foreground">{company.description}</p>
                </div>
                <Separator />
                <div className="flex gap-2">
                  <Button>Edit Company</Button>
                  <Button variant="outline">Deactivate</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Departments Tab */}
          <TabsContent value="departments">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Departments & Divisions</CardTitle>
                    <CardDescription>
                      Manage organizational structure
                    </CardDescription>
                  </div>
                  <Button>Add Department</Button>
                </div>
              </CardHeader>
              <CardContent>
                {company.departments.length === 0 ? (
                  <EmptyState
                    icon={Building2}
                    title="No departments yet"
                    description="Create your first department to get started"
                    action={{
                      label: "Add Department",
                      onClick: () => {},
                    }}
                  />
                ) : (
                  <div className="space-y-4">
                    {company.departments.map((dept) => (
                      <div
                        key={dept.id}
                        className="border rounded-lg p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <h3 className="font-semibold">{dept.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                {dept.users} users
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm">
                              Manage
                            </Button>
                            <Button variant="outline" size="sm">
                              Add Division
                            </Button>
                          </div>
                        </div>
                        {dept.divisions.length > 0 && (
                          <div className="ml-8 space-y-2 border-l-2 pl-4">
                            {dept.divisions.map((division) => (
                              <div
                                key={division.id}
                                className="flex items-center justify-between py-2"
                              >
                                <div className="flex items-center gap-2">
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{division.name}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {division.users} users
                                  </Badge>
                                </div>
                                <Button variant="ghost" size="sm">
                                  Manage
                                </Button>
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

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Company Settings</CardTitle>
                <CardDescription>
                  Configure company-wide settings and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Storage Limit</Label>
                  <Input type="number" placeholder="100" defaultValue="100" />
                  <p className="text-xs text-muted-foreground">
                    Maximum storage in GB
                  </p>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Default Document Scope</Label>
                  <p className="text-xs text-muted-foreground">
                    Default scope for new documents
                  </p>
                </div>
                <Separator />
                <div className="flex gap-2">
                  <Button>Save Settings</Button>
                  <Button variant="outline">Reset to Defaults</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
  );
}
