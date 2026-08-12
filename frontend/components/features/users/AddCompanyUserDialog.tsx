"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Mail, UserPlus } from "lucide-react";
import { useCreateUser, useInviteUser, useRoles } from "@/lib/hooks/use-users";
import { PasswordInput } from "@/components/ui/password-input";
import {
  formatCapability,
  formatDataScope,
  parseRoleMeta,
  type RoleRecord,
} from "@/lib/role-meta";

interface AddCompanyUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName?: string;
  departments?: Array<{ id: string; name: string }>;
}

export function AddCompanyUserDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
  departments = [],
}: AddCompanyUserDialogProps) {
  const [mode, setMode] = useState<"invite" | "create">("invite");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [password, setPassword] = useState("");
  const [sendEmail, setSendEmail] = useState(true);

  const { data: roles = [], isLoading: rolesLoading } = useRoles(open);
  const inviteUser = useInviteUser();
  const createUser = useCreateUser();

  const assignableRoles = useMemo(
    () => (roles as RoleRecord[]).filter((r) => r.name !== "Master"),
    [roles],
  );

  const selectedRole = useMemo(
    () => assignableRoles.find((r) => r.id === roleId),
    [assignableRoles, roleId],
  );
  const roleMeta = parseRoleMeta(selectedRole);

  useEffect(() => {
    if (!open) return;
    setMode("invite");
    setEmail("");
    setName("");
    setRoleId("");
    setDepartmentId("");
    setPassword("");
    setSendEmail(true);
  }, [open, companyId]);

  const busy = inviteUser.isPending || createUser.isPending;

  const handleSubmit = async () => {
    if (!email.trim() || !name.trim()) {
      toast.error("Name and email are required");
      return;
    }
    if (!roleId) {
      toast.error("Please select a role");
      return;
    }

    const departmentIds = departmentId ? [departmentId] : undefined;

    try {
      // Invite tab + email off → create with admin-set password (same as Create).
      if (mode === "invite" && sendEmail) {
        await inviteUser.mutateAsync({
          email: email.trim(),
          name: name.trim(),
          roleId,
          departmentIds,
          companyId,
          sendEmail: true,
        });
        toast.success(
          "Invitation sent — they will set a password from the email link",
        );
      } else {
        if (!password || password.length < 8) {
          toast.error("Password must be at least 8 characters");
          return;
        }
        await createUser.mutateAsync({
          email: email.trim(),
          name: name.trim(),
          roleId,
          departmentIds,
          companyId,
          password,
          status: "active",
        });
        toast.success("Account created — they can sign in now");
      }
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || "Could not add user");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
          <DialogDescription>
            {companyName
              ? `Invite or create an account for ${companyName}.`
              : "Invite by email or create an account with a password."}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={mode}
          onValueChange={(v) => setMode(v as "invite" | "create")}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="invite">Invite by email</TabsTrigger>
            <TabsTrigger value="create">Create account</TabsTrigger>
          </TabsList>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company-user-name">Full name *</Label>
              <Input
                id="company-user-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-user-email">Email *</Label>
              <Input
                id="company-user-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select
                value={roleId}
                onValueChange={setRoleId}
                disabled={rolesLoading}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      rolesLoading ? "Loading roles…" : "Select role"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {assignableRoles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedRole ? (
                <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
                  <p className="text-muted-foreground">
                    {roleMeta.description || `${selectedRole.name} role`}
                  </p>
                  {roleMeta.dataScope ? (
                    <p>
                      <span className="font-medium">Reach: </span>
                      {formatDataScope(roleMeta.dataScope)}
                    </p>
                  ) : null}
                  {roleMeta.capabilities.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {roleMeta.capabilities.length} capabilities — e.g.{" "}
                      {roleMeta.capabilities
                        .slice(0, 3)
                        .map(formatCapability)
                        .join("; ")}
                      {roleMeta.capabilities.length > 3 ? "…" : ""}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            {departments.length > 0 ? (
              <div className="space-y-2">
                <Label>Department</Label>
                <Select
                  value={departmentId || "__none__"}
                  onValueChange={(v) =>
                    setDepartmentId(v === "__none__" ? "" : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No department</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <TabsContent value="invite" className="mt-0 space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="send-invite-email"
                  checked={sendEmail}
                  onCheckedChange={(checked) =>
                    setSendEmail(checked === true)
                  }
                />
                <Label htmlFor="send-invite-email" className="cursor-pointer">
                  Send invitation email with set-password link
                </Label>
              </div>
              {!sendEmail ? (
                <div className="space-y-2">
                  <Label htmlFor="company-invite-password">Password *</Label>
                  <PasswordInput
                    id="company-invite-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                  />
                  <p className="text-xs text-muted-foreground">
                    Without email, you set their password so they can sign in
                    right away.
                  </p>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="create" className="mt-0 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company-user-password">Password *</Label>
                <PasswordInput
                  id="company-user-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                />
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : mode === "invite" && sendEmail ? (
              <Mail className="mr-2 h-4 w-4" />
            ) : (
              <UserPlus className="mr-2 h-4 w-4" />
            )}
            {busy
              ? "Saving…"
              : mode === "invite" && sendEmail
                ? "Send invite"
                : "Create account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
