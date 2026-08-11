"use client";

import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export type ScopeLevel = "company" | "department" | "division";

/**
 * The classification marking that sits on every record.
 *
 * Scope is the single fact that decides who can reach a document, so it is
 * given the most legible slot on the card rather than being one badge among
 * several. The wording matches the language used everywhere else in the
 * product ("company-wide", not "scope: 1").
 */
const SCOPE_TEXT: Record<ScopeLevel, string> = {
  company: "Company-wide",
  department: "Department",
  division: "Division",
};

const SCOPE_TONE: Record<ScopeLevel, string> = {
  company: "text-scope-company",
  department: "text-scope-department",
  division: "text-scope-division",
};

/** Icon fill/text colours — scope is read from the icon, not a left border. */
const SCOPE_ICON: Record<ScopeLevel, string> = {
  company: "text-scope-company fill-scope-company/20",
  department: "text-scope-department fill-scope-department/20",
  division: "text-scope-division fill-scope-division/20",
};

export function normaliseScope(value?: string | null): ScopeLevel | null {
  if (value === "company" || value === "department" || value === "division") {
    return value;
  }
  return null;
}

/**
 * Colour the folder/file icon by scope (or muted when restricted).
 * Replaces the old left-edge spine.
 */
export function scopeIconClass(
  scope?: string | null,
  restricted = false,
): string {
  if (restricted) return "text-muted-foreground/50";
  const level = normaliseScope(scope);
  return level ? SCOPE_ICON[level] : "text-brass fill-brass/20";
}

interface ScopeMarkProps {
  scope?: string | null;
  /** Name of the department or division the record belongs to, when known. */
  qualifier?: string | null;
  className?: string;
}

export function ScopeMark({ scope, qualifier, className }: ScopeMarkProps) {
  const level = normaliseScope(scope);
  if (!level) return null;

  return (
    <span
      className={cn("stamp inline-flex items-center gap-1.5", SCOPE_TONE[level], className)}
    >
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full bg-current"
      />
      {SCOPE_TEXT[level]}
      {qualifier && level !== "company" ? (
        <span className="text-muted-foreground">· {qualifier}</span>
      ) : null}
    </span>
  );
}

/** Shown in place of the scope marking when the viewer cannot open a record. */
export function RestrictedMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "stamp inline-flex items-center gap-1.5 text-scope-restricted",
        className,
      )}
    >
      <Lock className="h-3 w-3" aria-hidden />
      Restricted
    </span>
  );
}
