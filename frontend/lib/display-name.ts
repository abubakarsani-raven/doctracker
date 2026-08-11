/**
 * Helpers for showing people / org subjects in the UI.
 * Prefer a human name; never render a raw UUID as label text.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function looksLikeId(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return UUID_RE.test(trimmed) || /^[0-9a-f]{24}$/i.test(trimmed);
}

type NamedRecord = {
  id?: string;
  name?: string | null;
  email?: string | null;
  title?: string | null;
};

/**
 * Resolve a user / department / company id (or object) to a display label.
 */
export function displayName(
  value: unknown,
  directory?: NamedRecord[] | null,
  fallback = "Unknown",
): string {
  if (value == null || value === "") return fallback;

  if (typeof value === "object") {
    const obj = value as NamedRecord & { assignedToName?: string };
    const fromObj =
      obj.name ||
      obj.assignedToName ||
      obj.title ||
      obj.email ||
      null;
    if (fromObj && !looksLikeId(fromObj)) return String(fromObj);
    if (obj.id && directory?.length) {
      const match = directory.find((d) => d.id === obj.id);
      const label = match?.name || match?.email || match?.title;
      if (label && !looksLikeId(label)) return String(label);
    }
    if (fromObj) return String(fromObj);
    return fallback;
  }

  const str = String(value).trim();
  if (!looksLikeId(str)) return str;

  if (directory?.length) {
    const match = directory.find((d) => d.id === str);
    const label = match?.name || match?.email || match?.title;
    if (label && !looksLikeId(label)) return String(label);
  }

  return fallback;
}

/** Prefer explicit name fields, then resolve ids against a directory. */
export function personLabel(
  opts: {
    name?: string | null;
    email?: string | null;
    id?: string | null;
  },
  directory?: NamedRecord[] | null,
  fallback = "Unknown",
): string {
  if (opts.name && !looksLikeId(opts.name)) return opts.name;
  if (opts.email && !looksLikeId(opts.email)) return opts.email;
  return displayName(opts.id ?? opts.name ?? opts.email, directory, fallback);
}
