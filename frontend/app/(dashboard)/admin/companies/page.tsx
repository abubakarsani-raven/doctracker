"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { CreateCompanyDialog } from "@/components/features/admin/CreateCompanyDialog";
import { EditCompanyDialog } from "@/components/features/admin/EditCompanyDialog";
import { TransferOwnershipDialog } from "@/components/features/admin/TransferOwnershipDialog";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  Plus,
  Search,
  MoreVertical,
  Building2,
  Users,
  FileText,
  Settings,
  Loader2,
  Pencil,
  ArrowRightLeft,
  Ban,
  CheckCircle2,
} from "lucide-react";
import { EmptyState, QueryErrorState } from "@/components/common";
import Link from "next/link";
import { useRouteProtection } from "@/lib/hooks/useRouteProtection";
import {
  useActivateCompany,
  useCompanies,
  useDeactivateCompany,
} from "@/lib/hooks/use-companies";

export default function CompaniesPage() {
  useRouteProtection({ requireMaster: true });
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editCompany, setEditCompany] = useState<any | null>(null);
  const [transferCompany, setTransferCompany] = useState<any | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<any | null>(null);

  const { data: companies = [], isLoading, isError, error, refetch } =
    useCompanies();
  const deactivateCompany = useDeactivateCompany();
  const activateCompany = useActivateCompany();

  const activeCount = useMemo(
    () => companies.filter((c: any) => c.isActive !== false).length,
    [companies],
  );

  const filteredCompanies = companies.filter((company: any) =>
    company.name?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Company Management</h1>
          <p className="text-muted-foreground">
            Manage companies, departments, and document ownership
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Company
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search companies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )}

      {!isLoading && isError ? (
        <QueryErrorState
          title="Failed to load companies"
          error={error}
          onRetry={() => refetch()}
        />
      ) : !isLoading && filteredCompanies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No companies found"
          description={
            searchQuery
              ? "Try adjusting your search"
              : "Get started by creating your first company"
          }
          action={
            !searchQuery
              ? {
                  label: "Create Company",
                  onClick: () => setCreateDialogOpen(true),
                }
              : undefined
          }
        />
      ) : !isLoading ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCompanies.map((company: any) => {
                const isActive = company.isActive !== false;
                const isLastActive = isActive && activeCount <= 1;
                return (
                  <TableRow key={company.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <Link
                            href={`/admin/companies/${company.id}`}
                            className="font-medium hover:text-primary"
                          >
                            {company.name}
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            {company.description || "No description"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{company.address || "N/A"}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        {company._count?.users || 0}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <FileText className="h-3 w-3 text-muted-foreground" />
                        {company._count?.files || 0}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={isActive ? "default" : "secondary"}>
                        {isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`More actions for ${company.name}`}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/companies/${company.id}`}>
                              <Settings className="mr-2 h-4 w-4" />
                              Manage
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setEditCompany(company)}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setTransferCompany(company)}
                          >
                            <ArrowRightLeft className="mr-2 h-4 w-4" />
                            Transfer documents
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {isActive ? (
                            <DropdownMenuItem
                              disabled={isLastActive}
                              onClick={() => {
                                if (!isLastActive) setDeactivateTarget(company);
                              }}
                            >
                              <Ban className="mr-2 h-4 w-4" />
                              {isLastActive
                                ? "Deactivate (last company)"
                                : "Deactivate"}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() =>
                                activateCompany.mutate(company.id)
                              }
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Reactivate
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <CreateCompanyDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
      <EditCompanyDialog
        open={!!editCompany}
        onOpenChange={(open) => !open && setEditCompany(null)}
        company={editCompany}
      />
      <TransferOwnershipDialog
        open={!!transferCompany}
        onOpenChange={(open) => !open && setTransferCompany(null)}
        sourceCompany={transferCompany}
      />
      <ConfirmDialog
        open={!!deactivateTarget}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        title="Deactivate company?"
        description={
          deactivateTarget
            ? `“${deactivateTarget.name}” will be marked inactive. Documents stay until you transfer ownership to another company. You cannot deactivate the last active company.`
            : ""
        }
        confirmLabel="Deactivate"
        variant="destructive"
        loading={deactivateCompany.isPending}
        onConfirm={async () => {
          if (!deactivateTarget) return;
          await deactivateCompany.mutateAsync(deactivateTarget.id);
          setDeactivateTarget(null);
        }}
      />
    </div>
  );
}
