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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { InviteUserDialog } from "@/components/features/users/InviteUserDialog";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  Plus,
  Search,
  Building2,
  Loader2,
  MoreVertical,
  Users,
  UserCheck,
  Mail,
  UserX,
} from "lucide-react";
import { EmptyState, PermissionButton, QueryErrorState } from "@/components/common";
import {
  useUsers,
  useDeactivateUser,
  useCurrentUser,
  useRoles,
} from "@/lib/hooks/use-users";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { toast } from "sonner";
import {
  formatCapability,
  formatDataScope,
  parseRoleMeta,
  type RoleRecord,
} from "@/lib/role-meta";

function userStatus(user: any) {
  const status = String(user.status || "").toLowerCase();
  const active = user.isActive === true || status === "active";
  const invited = status === "invited";
  return { status, active, invited };
}

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [deactivateUserId, setDeactivateUserId] = useState<string | undefined>();
  const [detailUserId, setDetailUserId] = useState<string | undefined>();
  const { can, permissions } = usePermissions();
  const { data: currentUser } = useCurrentUser();
  const deactivateUser = useDeactivateUser();
  const { data: roles = [] } = useRoles(true);

  const { data: users = [], isLoading, isError, error, refetch } = useUsers();

  const rolesByName = useMemo(() => {
    const map = new Map<string, RoleRecord>();
    for (const role of roles as RoleRecord[]) {
      map.set(role.name, role);
    }
    return map;
  }, [roles]);

  const roleNames = useMemo(() => {
    const names = new Set<string>();
    for (const u of users) {
      if (u.role) names.add(u.role);
    }
    return Array.from(names).sort();
  }, [users]);

  const stats = useMemo(() => {
    let active = 0;
    let invited = 0;
    let inactive = 0;
    for (const u of users) {
      const s = userStatus(u);
      if (s.active) active += 1;
      else if (s.invited) invited += 1;
      else inactive += 1;
    }
    return { total: users.length, active, invited, inactive };
  }, [users]);

  const filteredUsers = users.filter((user: any) => {
    const matchesSearch =
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const canManage = can("users.manage");
  const userToDeactivate = users.find((u: any) => u.id === deactivateUserId);
  const detailUser = users.find((u: any) => u.id === detailUserId);
  const detailRole = detailUser?.role
    ? rolesByName.get(detailUser.role)
    : undefined;
  const detailMeta = parseRoleMeta(detailRole);

  return (
    <div className="space-y-6">
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "…" : stats.total}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "…" : stats.active}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Invited</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "…" : stats.invited}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "…" : stats.inactive}
            </div>
          </CardContent>
        </Card>
      </div>

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
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {roleNames.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )}

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
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user: any) => {
                const { active, invited } = userStatus(user);
                const showDeactivate =
                  canManage && active && user.id !== currentUser?.id;
                const roleMeta = parseRoleMeta(rolesByName.get(user.role));

                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <button
                        type="button"
                        className="flex items-center gap-3 text-left hover:opacity-80"
                        onClick={() => setDetailUserId(user.id)}
                      >
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
                          <p className="font-medium">
                            {user.name || user.email}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {user.email}
                          </p>
                        </div>
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant="secondary">
                          {user.role || "No Role"}
                        </Badge>
                        {roleMeta.dataScope ? (
                          <p className="text-xs text-muted-foreground">
                            {formatDataScope(roleMeta.dataScope)}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Building2 className="h-3 w-3" />
                        {user.department || "No Department"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          active
                            ? "default"
                            : invited
                              ? "outline"
                              : "secondary"
                        }
                      >
                        {active
                          ? "Active"
                          : invited
                            ? "Invited"
                            : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">User actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setDetailUserId(user.id)}
                          >
                            View access
                          </DropdownMenuItem>
                          {showDeactivate ? (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeactivateUserId(user.id)}
                            >
                              Deactivate
                            </DropdownMenuItem>
                          ) : null}
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

      <InviteUserDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
      />

      <Sheet
        open={!!detailUser}
        onOpenChange={(open) => {
          if (!open) setDetailUserId(undefined);
        }}
      >
        <SheetContent className="sm:max-w-md overflow-y-auto">
          {detailUser ? (
            <>
              <SheetHeader>
                <SheetTitle>{detailUser.name || detailUser.email}</SheetTitle>
                <SheetDescription>{detailUser.email}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Status</p>
                  <Badge
                    variant={
                      userStatus(detailUser).active
                        ? "default"
                        : userStatus(detailUser).invited
                          ? "outline"
                          : "secondary"
                    }
                  >
                    {userStatus(detailUser).active
                      ? "Active"
                      : userStatus(detailUser).invited
                        ? "Invited"
                        : "Inactive"}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Role</p>
                  <Badge variant="secondary">
                    {detailUser.role || "No role"}
                  </Badge>
                  {detailMeta.description ? (
                    <p className="text-sm text-muted-foreground">
                      {detailMeta.description}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Data reach</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDataScope(detailMeta.dataScope)}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Department</p>
                  <p className="text-sm text-muted-foreground">
                    {detailUser.department || "None"}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    What they can do ({detailMeta.capabilities.length})
                  </p>
                  {detailMeta.capabilities.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No capabilities listed for this role.
                    </p>
                  ) : (
                    <ul className="space-y-1 text-sm text-muted-foreground max-h-[50vh] overflow-y-auto">
                      {detailMeta.capabilities.map((cap) => (
                        <li
                          key={cap}
                          className="rounded border px-2 py-1.5 text-foreground/90"
                        >
                          {formatCapability(cap)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

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
