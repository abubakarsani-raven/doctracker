"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import {
  useCompanies,
  useTransferCompanyOwnership,
} from "@/lib/hooks/use-companies";

interface TransferOwnershipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceCompany: { id: string; name: string } | null;
}

export function TransferOwnershipDialog({
  open,
  onOpenChange,
  sourceCompany,
}: TransferOwnershipDialogProps) {
  const { data: companies = [] } = useCompanies();
  const transfer = useTransferCompanyOwnership();
  const [targetId, setTargetId] = useState("");

  const targets = useMemo(
    () =>
      companies.filter(
        (c: any) =>
          c.id !== sourceCompany?.id && c.isActive !== false,
      ),
    [companies, sourceCompany?.id],
  );

  const handleTransfer = async () => {
    if (!sourceCompany || !targetId) return;
    try {
      await transfer.mutateAsync({
        sourceCompanyId: sourceCompany.id,
        targetCompanyId: targetId,
        transferAll: true,
      });
      setTargetId("");
      onOpenChange(false);
    } catch {
      // toast from hook
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTargetId("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer document ownership</DialogTitle>
          <DialogDescription>
            Move all folders and documents from{" "}
            <strong>{sourceCompany?.name}</strong> to another active company.
            Use this before deactivating a company that still holds files.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label>Destination company</Label>
          <Select value={targetId} onValueChange={setTargetId}>
            <SelectTrigger>
              <SelectValue placeholder="Select company" />
            </SelectTrigger>
            <SelectContent>
              {targets.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {targets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Create or reactivate another company first.
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={transfer.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleTransfer}
            disabled={!targetId || transfer.isPending}
          >
            {transfer.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Transfer all documents
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
