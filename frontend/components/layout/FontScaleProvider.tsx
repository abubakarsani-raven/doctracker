"use client";

import { useEffect } from "react";
import { applyFontScale, getStoredFontScale } from "@/lib/font-scale";

/** Applies stored font scale on first paint of the client tree. */
export function FontScaleProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyFontScale(getStoredFontScale());
  }, []);

  return <>{children}</>;
}
