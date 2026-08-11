"use client";

import { useState } from "react";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { CreateCompanyDialog } from "@/components/features/admin/CreateCompanyDialog";
import { Plus, Search, MoreVertical, Building2, Users, FileText, Settings, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/common";
import Link from "next/link";
import { useRouteProtection } from "@/lib/hooks/useRouteProtection";
import { useCompanies } from "@/lib/hooks/use-companies";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export default function CompaniesPage() {
  useRouteProtection({ requireMaster: true });
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  
  const { data: companies = [], isLoading, error } = useCompanies();

  if (error) {
    toast.error("Failed to load companies");
  }

  const filteredCompanies = companies.filter((company: any) =>
    company.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Company Management</h1>
            <p className="text-muted-foreground">
              Manage companies, departments, and divisions
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Company
          </Button>
        </div>

        {/* Filters */}
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

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )}

        {/* Companies Table */}
        {!isLoading && filteredCompanies.length === 0 ? (
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
                {filteredCompanies.map((company) => (
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
                      <Badge variant="default">
                        Active
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
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
                          <DropdownMenuItem>Edit</DropdownMenuItem>
                          <DropdownMenuItem>Deactivate</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}

        <CreateCompanyDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
        />
      </div>
  );
}
