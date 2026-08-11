"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Folder } from "lucide-react";
import { useFolders } from "@/lib/hooks/use-documents";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { cn } from "@/lib/utils";

interface FolderAtMentionTextareaProps {
  id?: string;
  label?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  /** Folder chosen via @ for saving the referenced document */
  saveToFolderId: string | null;
  onSaveToFolderChange: (folder: { id: string; name: string } | null) => void;
  disabled?: boolean;
  rows?: number;
  placeholder?: string;
  hint?: string;
}

/**
 * Result notes textarea. Typing `@` opens a folder picker so the referenced
 * document can be saved into that folder on complete.
 */
export function FolderAtMentionTextarea({
  id = "completion-notes",
  label,
  value,
  onChange,
  saveToFolderId,
  onSaveToFolderChange,
  disabled,
  rows = 4,
  placeholder,
  hint,
}: FolderAtMentionTextareaProps) {
  const { data: allFolders = [] } = useFolders();
  const { canOn } = usePermissions();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [highlight, setHighlight] = useState(0);

  const writableFolders = useMemo(() => {
    return (allFolders as any[]).filter((folder) => canOn(folder, "write", "folder"));
  }, [allFolders, canOn]);

  const folderPaths = useMemo(() => {
    const byId = new Map(writableFolders.map((f: any) => [f.id, f]));
    const pathOf = (folder: any): string => {
      if (!folder.parentFolderId) return folder.name;
      const parent = byId.get(folder.parentFolderId);
      if (!parent) return folder.name;
      return `${pathOf(parent)} / ${folder.name}`;
    };
    return writableFolders.map((f: any) => ({
      id: f.id as string,
      name: f.name as string,
      path: pathOf(f),
    }));
  }, [writableFolders]);

  const filtered = useMemo(() => {
    const q = mentionQuery.trim().toLowerCase();
    if (!q) return folderPaths.slice(0, 8);
    return folderPaths
      .filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.path.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [folderPaths, mentionQuery]);

  const selectedFolder = folderPaths.find((f) => f.id === saveToFolderId);

  const closeMention = () => {
    setMentionOpen(false);
    setMentionQuery("");
    setMentionStart(null);
    setHighlight(0);
  };

  const pickFolder = (folder: { id: string; name: string; path: string }) => {
    if (mentionStart === null || !textareaRef.current) {
      onSaveToFolderChange({ id: folder.id, name: folder.name });
      closeMention();
      return;
    }
    const el = textareaRef.current;
    const cursor = el.selectionStart;
    const before = value.slice(0, mentionStart);
    const after = value.slice(cursor);
    const token = `@${folder.name}`;
    const next = `${before}${token}${after.startsWith(" ") ? after : ` ${after}`}`;
    onChange(next);
    onSaveToFolderChange({ id: folder.id, name: folder.name });
    closeMention();
    requestAnimationFrame(() => {
      const pos = before.length + token.length + 1;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const handleChange = (next: string) => {
    onChange(next);
    const el = textareaRef.current;
    if (!el) return;
    const cursor = el.selectionStart;
    const upToCursor = next.slice(0, cursor);
    const at = upToCursor.lastIndexOf("@");
    if (at === -1) {
      closeMention();
      return;
    }
    const between = upToCursor.slice(at + 1);
    // Abort if space/newline after @ without selecting (except mid-query)
    if (/[\n]/.test(between) || (between.includes(" ") && between.trim().includes(" "))) {
      closeMention();
      return;
    }
    // Only trigger when @ starts a token (start or after whitespace)
    if (at > 0 && !/\s/.test(upToCursor[at - 1])) {
      closeMention();
      return;
    }
    setMentionStart(at);
    setMentionQuery(between);
    setMentionOpen(true);
    setHighlight(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!mentionOpen || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      pickFolder(filtered[highlight]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeMention();
    }
  };

  return (
    <div className="space-y-2 relative">
      {label !== undefined ? (
        <Label htmlFor={id}>{label}</Label>
      ) : (
        <Label htmlFor={id}>
          Result <span className="text-destructive">*</span>
        </Label>
      )}
      <Textarea
        ref={textareaRef}
        id={id}
        placeholder={
          placeholder ||
          "What was the outcome? Type @ to save the referenced file into a folder…"
        }
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={rows}
        required
      />
      {mentionOpen && (
        <div
          className="absolute z-50 left-0 right-0 mt-1 rounded-md border bg-popover text-popover-foreground shadow-md overflow-hidden"
          role="listbox"
        >
          <div className="px-2 py-1.5 text-xs text-muted-foreground border-b">
            Save document to folder
          </div>
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              No writable folders match
            </p>
          ) : (
            <ul className="max-h-48 overflow-y-auto py-1">
              {filtered.map((folder, i) => (
                <li key={folder.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === highlight}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-left text-sm",
                      i === highlight ? "bg-accent" : "hover:bg-muted",
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pickFolder(folder);
                    }}
                    onMouseEnter={() => setHighlight(i)}
                  >
                    <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{folder.path}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {selectedFolder && (
        <p className="text-xs text-muted-foreground">
          Will save referenced file to{" "}
          <span className="font-medium text-foreground">{selectedFolder.path}</span>
          .{" "}
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() => onSaveToFolderChange(null)}
          >
            Clear
          </button>
        </p>
      )}
      {hint && !selectedFolder && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
