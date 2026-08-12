"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Building2, Users, Loader2, Network, ArrowRightLeft, Ban, CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/common";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { TransferOwnershipDialog } from "@/components/features/admin/TransferOwnershipDialog";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  useActivateCompany,
  useCompanies,
  useCompany,
  useDeactivateCompany,
  useUpdateCompany,
} from "@/lib/hooks/use-companies";
import { useUsers } from "@/lib/hooks/use-users";
import { format } from "date-fns";

export default function CompanyDetailPage() {
  const params = useParams();
  const companyId = params.id as string;

  const { data: company, isLoading, error } = useCompany(companyId);
  const { data: allCompanies = [] } = useCompanies();
  const { data: allUsers = [] } = useUsers();
  const updateCompany = useUpdateCompany();
  const deactivateCompany = useDeactivateCompany();
  const activateCompany = useActivateCompany();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);

  useEffect(() => {
    if (!company) return;
    setName(company.name || "");
    setDescription(company.description || "");
    setAddress(company.address || "");
  }, [company]);

  const companyUsers = useMemo(
    () => allUsers.filter((u: any) => u.companyId === companyId),
    [allUsers, companyId],
  );

  const usersInDepartment = (departmentId: string) =>
    companyUsers.filter((u: any) => u.departmentIds?.includes(departmentId))
      .length;

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

  const activeCount = useMemo(
    () => allCompanies.filter((c: any) => c.isActive !== false).length,
    [allCompanies],
  );
  const isActive = company?.isActive !== false;
  const isLastActive = isActive && activeCount <= 1;

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

  const handleSave = async () => {
    if (!name.trim()) return;
    await updateCompany.mutateAsync({
      id: companyId,
      data: {
        name: name.trim(),
        description: description.trim() || undefined,
        address: address.trim() || undefined,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/companies"
          className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block"
        >
          ← Back to Companies
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight">
                  {company.name}
                </h1>
                <Badge variant={isActive ? "default" : "secondary"}>
                  {isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              {company.createdAt && (
                <p className="text-muted-foreground">
                  Created {format(new Date(company.createdAt), "d MMM yyyy")}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setTransferOpen(true)}>
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Transfer documents
            </Button>
            {isActive ? (
              <Button
                variant="outline"
                disabled={isLastActive}
                onClick={() => setDeactivateOpen(true)}
              >
                <Ban className="mr-2 h-4 w-4" />
                {isLastActive
                  ? "Cannot deactivate last company"
                  : "Deactivate"}
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => activateCompany.mutate(companyId)}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Reactivate
              </Button>
            )}
          </div>
        </div>
      </div>

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

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="departments">Departments & Divisions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>
                Edit profile details. Documents stay with this company until you
                transfer ownership.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="detail-name">Company Name</Label>
                <Input
                  id="detail-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="detail-description">Description</Label>
                <Textarea
                  id="detail-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="detail-address">Address</Label>
                <Input
                  id="detail-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <Button
                onClick={handleSave}
                disabled={!name.trim() || updateCompany.isPending}
              >
                {updateCompany.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Save changes
              </Button>
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
                              {usersInDepartment(dept.id)} users
                            </p>
                          </div>
                        </div>
                      </div>
                      {dept.divisions?.length > 0 && (
                        <div className="ml-8 space-y-2">
                          {dept.divisions.map((div: any) => (
                            <div
                              key={div.id}
                              className="flex items-center justify-between text-sm"
                            >
                              <span>{div.name}</span>
                              <span className="text-muted-foreground">
                                {usersInDivision(div.id)} users
                              </span>
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

      <TransferOwnershipDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        sourceCompany={company}
      />
      <ConfirmDialog
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
        title="Deactivate company?"
        description={`“${company.name}” will be marked inactive. Transfer documents first if another company should own them.`}
        confirmLabel="Deactivate"
        variant="destructive"
        loading={deactivateCompany.isPending}
        onConfirm={async () => {
          await deactivateCompany.mutateAsync(companyId);
          setDeactivateOpen(false);
        }}
      />
    </div>
  );
}
