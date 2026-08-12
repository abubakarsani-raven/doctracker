/** Ink choices for light vs dark document pages. */
export const PEN_COLORS = [
  {
    id: "black",
    label: "Black",
    value: "#111111",
    forBg: "light" as const,
  },
  {
    id: "navy",
    label: "Navy",
    value: "#1e3a5f",
    forBg: "light" as const,
  },
  {
    id: "blue",
    label: "Blue",
    value: "#1d4ed8",
    forBg: "light" as const,
  },
  {
    id: "white",
    label: "White",
    value: "#ffffff",
    forBg: "dark" as const,
  },
  {
    id: "cream",
    label: "Cream",
    value: "#fde68a",
    forBg: "dark" as const,
  },
  {
    id: "silver",
    label: "Silver",
    value: "#e5e7eb",
    forBg: "dark" as const,
  },
] as const;

export type PenColorId = (typeof PEN_COLORS)[number]["id"];

export function penColorValue(id: PenColorId): string {
  return PEN_COLORS.find((c) => c.id === id)?.value ?? "#111111";
}

export function penIsForDarkDoc(id: PenColorId): boolean {
  return PEN_COLORS.find((c) => c.id === id)?.forBg === "dark";
}
