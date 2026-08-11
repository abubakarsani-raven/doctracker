"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Filters for the document registry.
 *
 * The set is chosen around the questions people actually arrive with — "what
 * came in this week", "what can I not get into", "what is Legal holding" —
 * rather than around the columns that happen to exist.
 */
export interface DocumentFilterState {
  /** Whether the viewer can open the item. Specific to a need-to-know registry. */
  access: "all" | "open" | "restricted";
  scopes: string[];
  fileTypes: string[];
  departmentIds: string[];
  companyIds: string[];
  createdBy: string[];
  /** Modified within the last N days; null means any time. */
  modifiedWithinDays: number | null;
}

export const EMPTY_FILTERS: DocumentFilterState = {
  access: "all",
  scopes: [],
  fileTypes: [],
  departmentIds: [],
  companyIds: [],
  createdBy: [],
  modifiedWithinDays: null,
};

export interface FacetOption {
  value: string;
  label: string;
  count: number;
}

export interface DocumentFacets {
  fileTypes: FacetOption[];
  departments: FacetOption[];
  companies: FacetOption[];
  people: FacetOption[];
  scopes: FacetOption[];
  access: { open: number; restricted: number };
}

const AGE_PRESETS: Array<{ label: string; days: number | null }> = [
  { label: "Any time", days: null },
  { label: "Today", days: 1 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "This year", days: 365 },
];

/**
 * Reduce a stored file type to a kind a person recognises.
 *
 * The column holds a MIME type for some records and a bare extension for
 * others, so the raw value is useless as a label — the filter list was showing
 * "APPLICATION/VND.OPENXMLFORMATS-OFFICEDOCUMENT.SPREADSHEETML.SHEET". Grouping
 * by kind is also what people actually want: "the spreadsheets", not "xlsx and
 * xls and csv separately".
 */
export const FILE_KIND_LABELS: Record<string, string> = {
  pdf: "PDF",
  word: "Word",
  spreadsheet: "Spreadsheet",
  slides: "Slides",
  image: "Image",
  csv: "CSV",
  markdown: "Markdown",
  html: "Web page",
  text: "Text",
  unknown: "Unknown",
  other: "Other",
};

/** Label for an already-normalised kind. Safe to call on a `fileKind` value. */
export function fileKindLabel(kind: string): string {
  return FILE_KIND_LABELS[kind] ?? kind;
}

export function fileKind(raw?: string | null): { value: string; label: string } {
  const type = (raw ?? "").toLowerCase();

  const is = (...needles: string[]) => needles.some((n) => type.includes(n));
  /** Matches a bare extension, with or without a leading dot. */
  const ends = (...exts: string[]) =>
    exts.some((e) => type === e || type.endsWith(`.${e}`));

  if (is("pdf")) return { value: "pdf", label: "PDF" };
  // Check the specific MIME fragments before the bare extensions: every Office
  // MIME contains the string "officedocument", which itself contains "doc".
  if (is("spreadsheetml", "ms-excel") || ends("xlsx", "xls"))
    return { value: "spreadsheet", label: "Spreadsheet" };
  if (is("presentationml", "powerpoint") || ends("pptx", "ppt"))
    return { value: "slides", label: "Slides" };
  if (is("wordprocessingml", "msword") || ends("docx", "doc"))
    return { value: "word", label: "Word" };
  if (is("image/", "png", "jpeg", "jpg", "gif", "webp"))
    return { value: "image", label: "Image" };
  if (is("csv")) return { value: "csv", label: "CSV" };
  if (is("markdown", "md")) return { value: "markdown", label: "Markdown" };
  if (is("html")) return { value: "html", label: "Web page" };
  if (is("text/", "txt")) return { value: "text", label: "Text" };
  if (!type) return { value: "unknown", label: "Unknown" };

  return { value: "other", label: "Other" };
}

export function countActiveFilters(f: DocumentFilterState): number {
  return (
    (f.access !== "all" ? 1 : 0) +
    f.scopes.length +
    f.fileTypes.length +
    f.departmentIds.length +
    f.companyIds.length +
    f.createdBy.length +
    (f.modifiedWithinDays !== null ? 1 : 0)
  );
}

/** The shape a record needs to expose to be filtered. */
export interface FilterableRecord {
  scopeLevel?: string | null;
  scope?: string | null;
  fileType?: string | null;
  type?: string | null;
  departmentId?: string | null;
  companyId?: string | null;
  createdBy?: string | null;
  modifiedAt?: Date | string | null;
  hasAccess?: boolean;
}

export function matchesFilters(
  record: FilterableRecord,
  f: DocumentFilterState,
): boolean {
  if (f.access !== "all") {
    const open = record.hasAccess !== false;
    if (f.access === "open" && !open) return false;
    if (f.access === "restricted" && open) return false;
  }

  if (f.scopes.length) {
    const scope = record.scopeLevel ?? record.scope ?? "";
    if (!f.scopes.includes(scope)) return false;
  }

  if (f.fileTypes.length) {
    if (!f.fileTypes.includes(fileKind(record.fileType ?? record.type).value)) {
      return false;
    }
  }

  if (f.departmentIds.length) {
    if (!record.departmentId || !f.departmentIds.includes(record.departmentId)) {
      return false;
    }
  }

  if (f.companyIds.length) {
    if (!record.companyId || !f.companyIds.includes(record.companyId)) {
      return false;
    }
  }

  if (f.createdBy.length) {
    if (!record.createdBy || !f.createdBy.includes(record.createdBy)) return false;
  }

  if (f.modifiedWithinDays !== null && record.modifiedAt) {
    const modified = new Date(record.modifiedAt).getTime();
    const cutoff = Date.now() - f.modifiedWithinDays * 24 * 60 * 60 * 1000;
    if (Number.isFinite(modified) && modified < cutoff) return false;
  }

  return true;
}

interface DocumentFiltersProps {
  value: DocumentFilterState;
  onChange: (next: DocumentFilterState) => void;
  facets: DocumentFacets;
  /** Company filter only makes sense to someone who sees more than one. */
  showCompanies?: boolean;
}

export function DocumentFilters({
  value,
  onChange,
  facets,
  showCompanies = false,
}: DocumentFiltersProps) {
  const activeCount = countActiveFilters(value);

  const toggle = (key: keyof DocumentFilterState, item: string) => {
    const current = value[key] as string[];
    onChange({
      ...value,
      [key]: current.includes(item)
        ? current.filter((v) => v !== item)
        : [...current, item],
    });
  };

  return (
    // A side sheet rather than a popover: there are eight facets with counts,
    // and a popover clipped them without scrolling. The sheet also leaves the
    // list visible behind it, so the effect of a filter can be watched as it
    // is applied.
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="relative">
          <Filter className="mr-2 h-4 w-4" />
          Filters
          {activeCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-2 h-5 min-w-5 justify-center px-1.5"
            >
              {activeCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-sm">
        <SheetHeader className="border-b">
          <SheetTitle>Filter documents</SheetTitle>
          <SheetDescription>
            {activeCount === 0
              ? "Narrow the registry by access, age, scope or owner."
              : `${activeCount} filter${activeCount === 1 ? "" : "s"} applied.`}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-5 p-4">
            {/* Access — the question unique to this app */}
            <FilterGroup label="Access">
              <div className="flex gap-1 rounded-md border p-1">
                {(
                  [
                    { v: "all", label: "All" },
                    { v: "open", label: `Open (${facets.access.open})` },
                    {
                      v: "restricted",
                      label: `Locked (${facets.access.restricted})`,
                    },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.v}
                    type="button"
                    onClick={() => onChange({ ...value, access: option.v })}
                    className={cn(
                      "flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors",
                      value.access === option.v
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </FilterGroup>

            <FilterGroup label="Modified">
              <div className="flex flex-wrap gap-1.5">
                {AGE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      onChange({ ...value, modifiedWithinDays: preset.days })
                    }
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition-colors",
                      value.modifiedWithinDays === preset.days
                        ? "border-primary bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </FilterGroup>

            <CheckList
              label="Scope"
              options={facets.scopes}
              selected={value.scopes}
              onToggle={(v) => toggle("scopes", v)}
            />

            <CheckList
              label="File type"
              options={facets.fileTypes}
              selected={value.fileTypes}
              onToggle={(v) => toggle("fileTypes", v)}
            />

            <CheckList
              label="Department"
              options={facets.departments}
              selected={value.departmentIds}
              onToggle={(v) => toggle("departmentIds", v)}
            />

            {showCompanies && (
              <CheckList
                label="Company"
                options={facets.companies}
                selected={value.companyIds}
                onToggle={(v) => toggle("companyIds", v)}
              />
            )}

            <CheckList
              label="Added by"
              options={facets.people}
              selected={value.createdBy}
              onToggle={(v) => toggle("createdBy", v)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t p-4">
          <Button
            variant="ghost"
            size="sm"
            disabled={activeCount === 0}
            onClick={() => onChange(EMPTY_FILTERS)}
          >
            Clear all
          </Button>
          <span className="stamp text-muted-foreground">
            {activeCount} applied
          </span>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold">{label}</Label>
      {children}
    </div>
  );
}

function CheckList({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: FacetOption[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  // A facet with nothing in it is noise, so it is not rendered at all.
  if (options.length === 0) return null;

  return (
    <>
      <Separator />
      <FilterGroup label={label}>
        <div className="space-y-1">
          {options.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-accent"
            >
              <Checkbox
                checked={selected.includes(option.value)}
                onCheckedChange={() => onToggle(option.value)}
              />
              <span className="flex-1 truncate">{option.label}</span>
              <span className="stamp text-muted-foreground">{option.count}</span>
            </label>
          ))}
        </div>
      </FilterGroup>
    </>
  );
}

/**
 * The filters currently in force, shown as removable chips under the search
 * bar. Without these, an active filter is hidden behind a popover and people
 * conclude their documents have vanished.
 */
export function ActiveFilterChips({
  value,
  onChange,
  facets,
}: {
  value: DocumentFilterState;
  onChange: (next: DocumentFilterState) => void;
  facets: DocumentFacets;
}) {
  const chips = useMemo(() => {
    const labelFor = (options: FacetOption[], v: string) =>
      options.find((o) => o.value === v)?.label ?? v;

    const out: Array<{ key: string; label: string; clear: () => void }> = [];

    if (value.access !== "all") {
      out.push({
        key: "access",
        label: value.access === "open" ? "Open to me" : "Locked",
        clear: () => onChange({ ...value, access: "all" }),
      });
    }

    if (value.modifiedWithinDays !== null) {
      const preset = AGE_PRESETS.find(
        (p) => p.days === value.modifiedWithinDays,
      );
      out.push({
        key: "age",
        label: `Modified: ${preset?.label ?? `${value.modifiedWithinDays}d`}`,
        clear: () => onChange({ ...value, modifiedWithinDays: null }),
      });
    }

    const listChips = (
      key: "scopes" | "fileTypes" | "departmentIds" | "companyIds" | "createdBy",
      options: FacetOption[],
    ) => {
      for (const v of value[key]) {
        out.push({
          key: `${key}:${v}`,
          label: labelFor(options, v),
          clear: () =>
            onChange({ ...value, [key]: value[key].filter((x) => x !== v) }),
        });
      }
    };

    listChips("scopes", facets.scopes);
    listChips("fileTypes", facets.fileTypes);
    listChips("departmentIds", facets.departments);
    listChips("companyIds", facets.companies);
    listChips("createdBy", facets.people);

    return out;
  }, [value, onChange, facets]);

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.clear}
          className="inline-flex items-center gap-1 rounded-full border bg-muted/40 py-1 pl-2.5 pr-1.5 text-xs transition-colors hover:bg-accent"
        >
          {chip.label}
          <X className="h-3 w-3 opacity-60" aria-hidden />
          <span className="sr-only">Remove filter</span>
        </button>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs"
        onClick={() => onChange(EMPTY_FILTERS)}
      >
        Clear all
      </Button>
    </div>
  );
}
