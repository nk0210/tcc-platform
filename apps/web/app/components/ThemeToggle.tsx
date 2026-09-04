"use client";
/**
 * Dark/light switch — reads/writes store/themeStore.ts. ThemeProvider
 * (mounted once in the root layout) reflects the store's value onto
 * <html data-theme>, so this component only ever needs to update the store.
 */
import { useState, useEffect } from "react";
import { useThemeStore } from "@/store/themeStore";

export default function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  // Avoid a hydration mismatch: the store's persisted value only rehydrates
  // client-side, so the very first client render must match the server's
  // (theme === "dark") render before this effect flips `mounted`.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isLight = mounted && theme === "light";

  return (
    <button
      onClick={toggleTheme}
      className="btn btn-ghost w-8 h-8 !p-0 rounded-lg"
      title={isLight ? "Switch to dark mode" : "Switch to light mode"}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
    >
      <span className="text-base leading-none" aria-hidden="true">
        {isLight ? "☀️" : "🌙"}
      </span>
    </button>
  );
}
