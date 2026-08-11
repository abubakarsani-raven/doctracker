/**
 * App-wide text size preference.
 * Stored in localStorage and applied as html { font-size } so rem-based UI scales.
 */

export type FontScale = "sm" | "md" | "lg" | "xl";

export const FONT_SCALE_STORAGE_KEY = "dt_font_scale";

export const FONT_SCALE_OPTIONS: Array<{
  value: FontScale;
  label: string;
  /** Root html font-size percentage (browser default 16px). */
  percent: number;
  sample: string;
}> = [
  { value: "sm", label: "Small", percent: 87.5, sample: "A" },
  { value: "md", label: "Default", percent: 100, sample: "A" },
  { value: "lg", label: "Large", percent: 112.5, sample: "A" },
  { value: "xl", label: "Extra large", percent: 125, sample: "A" },
];

export function isFontScale(value: unknown): value is FontScale {
  return value === "sm" || value === "md" || value === "lg" || value === "xl";
}

export function getStoredFontScale(): FontScale {
  if (typeof window === "undefined") return "md";
  try {
    const raw = localStorage.getItem(FONT_SCALE_STORAGE_KEY);
    return isFontScale(raw) ? raw : "md";
  } catch {
    return "md";
  }
}

export function applyFontScale(scale: FontScale) {
  if (typeof document === "undefined") return;
  const option =
    FONT_SCALE_OPTIONS.find((o) => o.value === scale) ?? FONT_SCALE_OPTIONS[1];
  document.documentElement.style.fontSize = `${option.percent}%`;
  document.documentElement.dataset.fontScale = scale;
}

export function setFontScale(scale: FontScale) {
  try {
    localStorage.setItem(FONT_SCALE_STORAGE_KEY, scale);
  } catch {
    // ignore quota / private mode
  }
  applyFontScale(scale);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("dt-font-scale", { detail: scale }),
    );
  }
}

export function cycleFontScale(current: FontScale): FontScale {
  const order: FontScale[] = ["sm", "md", "lg", "xl"];
  const idx = order.indexOf(current);
  return order[(idx + 1) % order.length];
}

export function bumpFontScale(
  current: FontScale,
  direction: "up" | "down",
): FontScale {
  const order: FontScale[] = ["sm", "md", "lg", "xl"];
  const idx = order.indexOf(current);
  if (direction === "up") return order[Math.min(order.length - 1, idx + 1)];
  return order[Math.max(0, idx - 1)];
}
