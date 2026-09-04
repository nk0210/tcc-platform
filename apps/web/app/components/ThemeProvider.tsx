"use client";
/**
 * Applies the persisted theme to <html data-theme="..."> after mount, and
 * keeps it in sync if the user toggles it. The actual flash-of-wrong-theme
 * prevention happens separately via the blocking inline script in
 * layout.tsx's <head> (this component's own first effect run is too late —
 * it fires after React hydrates, which is after first paint).
 */
import { useEffect } from "react";
import { useThemeStore } from "@/store/themeStore";

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return <>{children}</>;
}
