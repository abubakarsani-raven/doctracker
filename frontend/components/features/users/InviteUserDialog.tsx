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
import { Mail, Loader2 } from "lucide-react";
import { useCurrentUser, useInviteUser, useRoles } from "@/lib/hooks/use-users";

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

  const { data: currentUser } = useCurrentUser();
  const { data: roles = [], isLoading: rolesLoading } = useRoles(open);
  const inviteUser = useInviteUser();

  const targetCompanyId = companyId || currentUser?.companyId || undefined;

  const assignableRoles = useMemo(
    () =>
      (roles as Array<{ id: string; name: string }>).filter(
        (r) => r.name !== "Master",
      ),
    [roles],
  );

  useEffect(() => {
    if (!open) return;
    setEmail("");
    setName("");
    setRoleId("");
    setSendEmail(true);
  }, [open]);

  const handleInvite = async () => {
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
      await inviteUser.mutateAsync({
        email: email.trim(),
        name: name.trim(),
        roleId,
        companyId: targetCompanyId,
        sendEmail,
      });
      toast.success(
        sendEmail
          ? "Invitation sent successfully"
          : "User invited (no email sent)",
      );
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to send invitation");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
          <DialogDescription>
            Send an invitation to join your organization. They will set a
            password from the email link.
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
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="sendEmail"
              checked={sendEmail}
              onCheckedChange={(checked) => setSendEmail(checked === true)}
            />
            <Label htmlFor="sendEmail" className="cursor-pointer">
              Send invitation email
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleInvite}
            disabled={!email || !name || !roleId || inviteUser.isPending}
          >
            {inviteUser.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Mail className="mr-2 h-4 w-4" />
            )}
            {inviteUser.isPending ? "Sending..." : "Send Invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
