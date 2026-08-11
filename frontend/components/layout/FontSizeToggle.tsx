"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  applyFontScale,
  bumpFontScale,
  getStoredFontScale,
  setFontScale,
  type FontScale,
} from "@/lib/font-scale";

/**
 * Header control to bump UI text size (A− / A+). Preference persists in localStorage.
 */
export function FontSizeToggle() {
  const [scale, setScale] = useState<FontScale>("md");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = getStoredFontScale();
    setScale(stored);
    applyFontScale(stored);
    setMounted(true);

    const onScale = (event: Event) => {
      const detail = (event as CustomEvent<FontScale>).detail;
      if (detail) setScale(detail);
    };
    window.addEventListener("dt-font-scale", onScale);
    return () => window.removeEventListener("dt-font-scale", onScale);
  }, []);

  const change = (direction: "up" | "down") => {
    const next = bumpFontScale(scale, direction);
    setScale(next);
    setFontScale(next);
  };

  if (!mounted) {
    return (
      <div className="flex items-center" role="group" aria-label="Text size">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled
          aria-label="Decrease text size"
          title="Decrease text size"
        >
          <span className="text-xs font-semibold leading-none">A−</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled
          aria-label="Increase text size"
          title="Increase text size"
        >
          <span className="text-sm font-semibold leading-none">A+</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center" role="group" aria-label="Text size">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => change("down")}
        disabled={scale === "sm"}
        aria-label="Decrease text size"
        title="Decrease text size"
      >
        <span className="text-xs font-semibold leading-none">A−</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => change("up")}
        disabled={scale === "xl"}
        aria-label="Increase text size"
        title="Increase text size"
      >
        <span className="text-sm font-semibold leading-none">A+</span>
      </Button>
    </div>
  );
}
