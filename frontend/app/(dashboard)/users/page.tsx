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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { InviteUserDialog } from "@/components/features/users/InviteUserDialog";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Plus, Search, Building2, Loader2, MoreVertical } from "lucide-react";
import { EmptyState, PermissionButton, QueryErrorState } from "@/components/common";
import { useUsers, useDeactivateUser, useCurrentUser } from "@/lib/hooks/use-users";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { toast } from "sonner";

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [deactivateUserId, setDeactivateUserId] = useState<string | undefined>();
  const { can, permissions } = usePermissions();
  const { data: currentUser } = useCurrentUser();
  const deactivateUser = useDeactivateUser();

  const { data: users = [], isLoading, isError, error, refetch } = useUsers();

  const filteredUsers = users.filter((user: any) => {
    const matchesSearch =
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const canManage = can("users.manage");
  const userToDeactivate = users.find((u: any) => u.id === deactivateUserId);

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Users</h1>
            <p className="text-muted-foreground">
              Manage users and their permissions
            </p>
          </div>
          <PermissionButton
            allowed={canManage}
            reason={
              canManage
                ? null
                : `The ${permissions.role} role cannot invite users.`
            }
            onClick={() => setInviteDialogOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Invite User
          </PermissionButton>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="Staff">Staff</SelectItem>
              <SelectItem value="Manager">Manager</SelectItem>
              <SelectItem value="Department Head">Department Head</SelectItem>
              <SelectItem value="Department Secretary">Department Secretary</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )}

        {/* Error State */}
        {!isLoading && isError ? (
          <QueryErrorState
            title="Failed to load users"
            error={error}
            onRetry={() => refetch()}
          />
        ) : !isLoading && filteredUsers.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No users found"
            description={
              searchQuery || roleFilter !== "all"
                ? "Try adjusting your filters"
                : "Get started by inviting your first user"
            }
            action={
              !searchQuery && roleFilter === "all"
                ? {
                    label: "Invite User",
                    onClick: () => setInviteDialogOpen(true),
                  }
                : undefined
            }
          />
        ) : !isLoading ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage ? <TableHead className="w-[60px]" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user: any) => {
                  const showDeactivate =
                    canManage &&
                    user.isActive &&
                    user.id !== currentUser?.id;

                  return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {user.name
                              ? user.name
                                  .split(" ")
                                  .map((n: string) => n[0])
                                  .join("")
                              : user.email[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{user.name || user.email}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {user.role || "No Role"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Building2 className="h-3 w-3" />
                        {user.department?.name || "No Department"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? "default" : "secondary"}>
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    {canManage ? (
                      <TableCell className="text-right">
                        {showDeactivate ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                                <span className="sr-only">User actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeactivateUserId(user.id)}
                              >
                                Deactivate
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </TableCell>
                    ) : null}
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : null}

        <InviteUserDialog
          open={inviteDialogOpen}
          onOpenChange={setInviteDialogOpen}
        />

        <ConfirmDialog
          open={!!deactivateUserId}
          onOpenChange={(open) => {
            if (!open) setDeactivateUserId(undefined);
          }}
          title="Deactivate user?"
          description={
            userToDeactivate
              ? `${userToDeactivate.name || userToDeactivate.email} will no longer be able to sign in.`
              : "This user will no longer be able to sign in."
          }
          confirmLabel="Deactivate"
          variant="destructive"
          loading={deactivateUser.isPending}
          onConfirm={async () => {
            if (!deactivateUserId) return;
            try {
              await deactivateUser.mutateAsync(deactivateUserId);
              toast.success("User deactivated");
              setDeactivateUserId(undefined);
            } catch (err: any) {
              toast.error(err?.message || "Failed to deactivate user");
            }
          }}
        />
      </div>
  );
}
