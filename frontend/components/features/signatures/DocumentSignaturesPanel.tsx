"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PenTool, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useCurrentUser } from "@/lib/hooks/use-users";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { PermissionButton } from "@/components/common/PermissionButton";
import { RequestSignatureDialog } from "./RequestSignatureDialog";
import { SignDocumentDialog } from "./SignDocumentDialog";

interface DocumentSignaturesPanelProps {
  fileId: string;
  fileName?: string;
  isRichText?: boolean;
  pageCount?: number;
  onChanged?: () => void;
}

export function DocumentSignaturesPanel({
  fileId,
  fileName,
  isRichText = false,
  pageCount = 3,
  onChanged,
}: DocumentSignaturesPanelProps) {
  const { data: currentUser } = useCurrentUser();
  const { can, permissions } = usePermissions();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestOpen, setRequestOpen] = useState(false);
  const [signTarget, setSignTarget] = useState<{
    requestId: string;
    participantId: string;
    isEditing: boolean;
  } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getFileSignatureRequests(fileId);
      setRequests(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast.error(error.message || "Could not load signature requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId]);

  const isMine = (p: any) =>
    p.userId === currentUser?.id || p.email === currentUser?.email;

  const myPending = (request: any) =>
    request.participants?.find(
      (p: any) => p.status === "pending" && isMine(p),
    );

  /** Signed participants can revise until a later signer has stamped. */
  const myEditable = (request: any) => {
    const mine = request.participants?.find(
      (p: any) => p.status === "signed" && isMine(p),
    );
    if (!mine) return null;
    const laterSigned = (request.participants || []).some(
      (p: any) =>
        p.signingOrder > mine.signingOrder && p.status === "signed",
    );
    return laterSigned ? null : mine;
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Signatures</CardTitle>
          <PermissionButton
            allowed={can("documents.request_signature")}
            reason={
              can("documents.request_signature")
                ? null
                : `The ${permissions.role} role cannot request signatures.`
            }
            size="sm"
            variant="outline"
            onClick={() => setRequestOpen(true)}
          >
            <PenTool className="mr-1.5 h-3.5 w-3.5" />
            Request
          </PermissionButton>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No signature requests yet. Request sign-off when the contract is
              ready.
            </p>
          ) : (
            requests.map((request) => {
              const pending = myPending(request);
              const editable = !pending ? myEditable(request) : null;
              return (
                <div
                  key={request.id}
                  className="space-y-2 rounded-md border p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      variant={
                        request.status === "completed" ? "default" : "secondary"
                      }
                    >
                      {request.status}
                    </Badge>
                    <span className="stamp text-muted-foreground">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <ul className="space-y-1 text-sm">
                    {(request.participants || []).map((p: any) => (
                      <li
                        key={p.id}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="min-w-0 break-words">
                          {p.signingOrder}. {p.name || p.email}
                        </span>
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          {p.status}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                  {pending && (
                    <PermissionButton
                      allowed={can("documents.sign")}
                      reason={
                        can("documents.sign")
                          ? null
                          : `Your role (${permissions.role}) can’t sign — ask an admin.`
                      }
                      size="sm"
                      className="w-full"
                      onClick={() =>
                        setSignTarget({
                          requestId: request.id,
                          participantId: pending.id,
                          isEditing: false,
                        })
                      }
                    >
                      <PenTool className="mr-1.5 h-3.5 w-3.5" />
                      Sign now
                    </PermissionButton>
                  )}
                  {editable && (
                    <PermissionButton
                      allowed={can("documents.sign")}
                      reason={
                        can("documents.sign")
                          ? null
                          : `Your role (${permissions.role}) can’t sign — ask an admin.`
                      }
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() =>
                        setSignTarget({
                          requestId: request.id,
                          participantId: editable.id,
                          isEditing: true,
                        })
                      }
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Edit my signature
                    </PermissionButton>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <RequestSignatureDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        fileId={fileId}
        fileName={fileName}
        onSuccess={load}
      />

      {signTarget && (
        <SignDocumentDialog
          open={!!signTarget}
          onOpenChange={(open) => !open && setSignTarget(null)}
          requestId={signTarget.requestId}
          participantId={signTarget.participantId}
          fileId={fileId}
          documentName={fileName}
          isRichText={isRichText}
          pageCount={pageCount}
          isEditing={signTarget.isEditing}
          onSuccess={() => {
            setSignTarget(null);
            load();
            onChanged?.();
          }}
        />
      )}
    </>
  );
}
