"use client";

import { MockDataProvider } from "./contexts/MockDataContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return <MockDataProvider>{children}</MockDataProvider>;
}
