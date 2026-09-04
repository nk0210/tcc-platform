/**
 * TCC Theme Store
 * Dark (default) or light — persisted the same way every other per-user
 * preference in this app is (see lib/persistence/storage.ts). Actually
 * applying the theme (setting `data-theme` on <html>) happens in
 * components/ThemeProvider.tsx, which also runs a blocking inline script
 * in <head> so the correct theme is set before first paint — this store is
 * just the source of truth `ThemeToggle` reads/writes.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getUserScopedStorage } from "@/lib/persistence/storage";

export type Theme = "dark" | "light";

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: "dark",
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: get().theme === "dark" ? "light" : "dark" }),
    }),
    {
      name: "theme",
      storage: createJSONStorage(() => getUserScopedStorage("theme")),
    }
  )
);
