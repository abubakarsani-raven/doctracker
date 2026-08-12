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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Mail, Loader2, UserPlus } from "lucide-react";
import {
  useCreateUser,
  useCurrentUser,
  useInviteUser,
  useRoles,
} from "@/lib/hooks/use-users";
import { PasswordInput } from "@/components/ui/password-input";
import {
  formatCapability,
  formatDataScope,
  parseRoleMeta,
  type RoleRecord,
} from "@/lib/role-meta";

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set (e.g. from company admin), Master can invite into this company. */
  companyId?: string;
}

export function InviteUserDialog({
  open,
  onOpenChange,
  companyId,
}: InviteUserDialogProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { data: currentUser } = useCurrentUser();
  const { data: roles = [], isLoading: rolesLoading } = useRoles(open);
  const inviteUser = useInviteUser();
  const createUser = useCreateUser();

  const targetCompanyId = companyId || currentUser?.companyId || undefined;

  const assignableRoles = useMemo(
    () =>
      (roles as RoleRecord[]).filter((r) => r.name !== "Master"),
    [roles],
  );

  const selectedRole = useMemo(
    () => assignableRoles.find((r) => r.id === roleId),
    [assignableRoles, roleId],
  );
  const roleMeta = parseRoleMeta(selectedRole);

  useEffect(() => {
    if (!open) return;
    setEmail("");
    setName("");
    setRoleId("");
    setSendEmail(true);
    setPassword("");
    setConfirmPassword("");
  }, [open]);

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
    if (!targetCompanyId) {
      toast.error(
        "Select a company first (open a company and use Add user), or use an account that belongs to a company.",
      );
      return;
    }

    try {
      if (sendEmail) {
        await inviteUser.mutateAsync({
          email: email.trim(),
          name: name.trim(),
          roleId,
          companyId: targetCompanyId,
          sendEmail: true,
        });
        toast.success("Invitation sent — they will set a password from the email");
      } else {
        if (!password || password.length < 8) {
          toast.error("Password must be at least 8 characters");
          return;
        }
        if (password !== confirmPassword) {
          toast.error("Passwords do not match");
          return;
        }
        await createUser.mutateAsync({
          email: email.trim(),
          name: name.trim(),
          roleId,
          companyId: targetCompanyId,
          password,
          status: "active",
        });
        toast.success("Account created — they can sign in with this password");
      }
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to add user");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
          <DialogDescription>
            {sendEmail
              ? "Send an invitation email. They will set a password from the link."
              : "Create the account yourself and set their password now."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-name">Full name *</Label>
            <Input
              id="invite-name"
              placeholder="Jane Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email Address *</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
                  placeholder={rolesLoading ? "Loading roles…" : "Select role"}
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
              <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-2">
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
                  <div>
                    <p className="font-medium mb-1">
                      What they can do ({roleMeta.capabilities.length})
                    </p>
                    <ul className="max-h-28 overflow-y-auto space-y-0.5 text-xs text-muted-foreground">
                      {roleMeta.capabilities.map((cap) => (
                        <li key={cap}>{formatCapability(cap)}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="sendEmail"
              checked={sendEmail}
              onCheckedChange={(checked) => {
                const on = checked === true;
                setSendEmail(on);
                if (on) {
                  setPassword("");
                  setConfirmPassword("");
                }
              }}
            />
            <Label htmlFor="sendEmail" className="cursor-pointer">
              Send invitation email
            </Label>
          </div>

          {!sendEmail ? (
            <div className="space-y-4 rounded-md border p-3">
              <p className="text-sm text-muted-foreground">
                Set a password for them. They can sign in immediately and change
                it later via Forgot password.
              </p>
              <div className="space-y-2">
                <Label htmlFor="invite-password">Password *</Label>
                <PasswordInput
                  id="invite-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-confirm">Confirm password *</Label>
                <PasswordInput
                  id="invite-confirm"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                />
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!email || !name || !roleId || busy}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : sendEmail ? (
              <Mail className="mr-2 h-4 w-4" />
            ) : (
              <UserPlus className="mr-2 h-4 w-4" />
            )}
            {busy
              ? "Saving…"
              : sendEmail
                ? "Send invitation"
                : "Create account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
