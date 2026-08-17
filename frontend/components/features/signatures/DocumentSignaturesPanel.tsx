"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PenTool, Loader2, Pencil, Trash2, Timer, FileWarning } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import {
  documentTypeLabel,
  isSignableDocument,
  type SignableDocument,
} from "@/lib/signable-document";
import { useCurrentUser } from "@/lib/hooks/use-users";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { PermissionButton } from "@/components/common/PermissionButton";
import { RequestSignatureDialog } from "./RequestSignatureDialog";
import { SignDocumentDialog } from "./SignDocumentDialog";

/** Matches backend SIGNATURE_EDIT_WINDOW_MS */
const EDIT_WINDOW_MS = 5 * 60 * 1000;

function formatRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface DocumentSignaturesPanelProps {
  fileId: string;
  fileName?: string;
  isRichText?: boolean;
  /** Extension / MIME of the file — decides whether it can be stamped at all. */
  fileType?: string | null;
  pageCount?: number;
  /** Bump to force-reload requests (e.g. after header Request signature). */
  refreshKey?: number;
  onChanged?: () => void;
}

export function DocumentSignaturesPanel({
  fileId,
  fileName,
  isRichText = false,
  fileType = null,
  pageCount = 3,
  refreshKey = 0,
  onChanged,
}: DocumentSignaturesPanelProps) {
  const { data: currentUser } = useCurrentUser();
  const { can, permissions } = usePermissions();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);
  const [now, setNow] = useState(() => Date.now());
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
  }, [fileId, refreshKey]);

  // Tick while any of my signatures are still inside the edit window.
  const needsTicker = useMemo(() => {
    if (!currentUser) return false;
    return requests.some((r) =>
      (r.participants || []).some((p: any) => {
        if (p.status !== "signed" || !p.signedAt) return false;
        const mine =
          p.userId === currentUser.id || p.email === currentUser.email;
        if (!mine) return false;
        return now - new Date(p.signedAt).getTime() < EDIT_WINDOW_MS;
      }),
    );
  }, [requests, currentUser, now]);

  useEffect(() => {
    if (!needsTicker) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [needsTicker]);

  const documentShape: SignableDocument = { fileType, fileName, isRichText };
  const signable = isSignableDocument(documentShape);
  const unsupportedReason = `${documentTypeLabel(documentShape)} can’t be signed — convert to PDF first.`;

  const isMine = (p: any) =>
    p.userId === currentUser?.id || p.email === currentUser?.email;

  const myPending = (request: any) =>
    request.participants?.find(
      (p: any) => p.status === "pending" && isMine(p),
    );

  /**
   * Signed participants can revise/remove within 5 minutes, until a later
   * signer has stamped.
   */
  const myEditable = (request: any) => {
    const mine = request.participants?.find(
      (p: any) => p.status === "signed" && isMine(p),
    );
    if (!mine?.signedAt) return null;
    const laterSigned = (request.participants || []).some(
      (p: any) =>
        p.signingOrder > mine.signingOrder && p.status === "signed",
    );
    if (laterSigned) return null;
    const remaining =
      EDIT_WINDOW_MS - (now - new Date(mine.signedAt).getTime());
    if (remaining <= 0) return null;
    return { participant: mine, remainingMs: remaining };
  };

  const handleRemove = async (requestId: string, participantId: string) => {
    if (
      !window.confirm(
        "Remove your signature? You can sign again afterward.",
      )
    ) {
      return;
    }
    setRemoving(true);
    try {
      await api.removeSignature(requestId, participantId);
      toast.success("Signature removed");
      await load();
      onChanged?.();
    } catch (error: any) {
      toast.error(error.message || "Could not remove signature");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Signatures</CardTitle>
          <PermissionButton
            allowed={can("documents.request_signature") && signable}
            reason={
              !can("documents.request_signature")
                ? `The ${permissions.role} role cannot request signatures.`
                : !signable
                  ? unsupportedReason
                  : null
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
          {!signable && (
            <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="min-w-0 space-y-1">
                <p className="font-medium">
                  {documentTypeLabel(documentShape)} can’t be signed
                </p>
                <p className="text-muted-foreground">
                  Signatures are stamped onto the file itself, which only works
                  for PDFs and documents written in the app. Convert this file
                  to PDF and upload it as a new version, then request
                  signatures on that.
                </p>
              </div>
            </div>
          )}
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
                      allowed={can("documents.sign") && signable}
                      reason={
                        !can("documents.sign")
                          ? `Your role (${permissions.role}) can’t sign — ask an admin.`
                          : !signable
                            ? unsupportedReason
                            : null
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
                    <div className="space-y-2">
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Timer className="h-3.5 w-3.5" />
                        Edit window ends in{" "}
                        <span className="font-medium tabular-nums text-foreground">
                          {formatRemaining(editable.remainingMs)}
                        </span>
                      </p>
                      <div className="flex gap-2">
                        <PermissionButton
                          allowed={can("documents.sign") && signable}
                          reason={
                            !can("documents.sign")
                              ? `Your role (${permissions.role}) can’t sign — ask an admin.`
                              : !signable
                                ? unsupportedReason
                                : null
                          }
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() =>
                            setSignTarget({
                              requestId: request.id,
                              participantId: editable.participant.id,
                              isEditing: true,
                            })
                          }
                        >
                          <Pencil className="mr-1.5 h-3.5 w-3.5" />
                          Edit
                        </PermissionButton>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-destructive hover:text-destructive"
                          disabled={removing || !can("documents.sign")}
                          onClick={() =>
                            handleRemove(
                              request.id,
                              editable.participant.id,
                            )
                          }
                        >
                          {removing ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Remove
                        </Button>
                      </div>
                    </div>
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
            // Keep the dialog mounted so "Save this signature?" can open.
            load();
            onChanged?.();
          }}
        />
      )}
    </>
  );
}
