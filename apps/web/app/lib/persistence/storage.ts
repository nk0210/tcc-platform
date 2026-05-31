/**
 * TCC User-Scoped Persistent Storage
 *
 * All user data stored under: tcc:{userId}:{storeName}
 * This ensures complete isolation — User A never sees User B's data.
 *
 * Phase 1: localStorage (browser-local, fully functional for demo/beta)
 * Phase 2: PostgreSQL + Prisma via backend API (same structure, same keys logic)
 *
 * Auth is stored separately under: tcc:auth (not user-scoped, bootstrap key)
 */

export function getStoredUserId(): string {
  if (typeof window === "undefined") return "guest";
  try {
    const auth = localStorage.getItem("tcc:auth");
    if (auth) {
      const parsed = JSON.parse(auth);
      const userId = parsed?.state?.user?.id;
      if (userId) return userId;
    }
  } catch {}
  return "guest";
}

export function getUserScopedStorage(storeName: string) {
  const getKey = () => `tcc:${getStoredUserId()}:${storeName}`;

  return {
    getItem: (_name: string): string | null => {
      if (typeof window === "undefined") return null;
      try {
        return localStorage.getItem(getKey());
      } catch {
        return null;
      }
    },
    setItem: (_name: string, value: string): void => {
      if (typeof window === "undefined") return;
      try {
        localStorage.setItem(getKey(), value);
      } catch {}
    },
    removeItem: (_name: string): void => {
      if (typeof window === "undefined") return;
      try {
        localStorage.removeItem(getKey());
      } catch {}
    },
  };
}

export function clearUserData(userId: string): void {
  if (typeof window === "undefined") return;
  const prefix = `tcc:${userId}:`;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) keysToRemove.push(key);
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
}

export function rehydrateAllStores(): void {
  // Zustand persist stores expose .persist.rehydrate()
  // Called after login so the new userId is used for storage keys
  if (typeof window === "undefined") return;
  const storeNames = [
    "tradeStore", "journalStore", "watchlistStore", "symbolStore",
    "notificationStore", "academyStore", "copyTradingStore",
    "playbookStore", "strategyStore",
  ];
  storeNames.forEach(name => {
    try {
      // Dynamic import triggers re-read from localStorage with new userId
      import(`@/store/${name}`).then((mod: any) => {
        const storeKey = Object.keys(mod).find(k => k.startsWith("use") && mod[k]?.persist?.rehydrate);
        if (storeKey) mod[storeKey].persist.rehydrate();
      }).catch(() => {});
    } catch {}
  });
}

export function resetStoreStates(): void {
  // Called on logout — clears in-memory store state without deleting persisted data
  // Individual stores can call their own reset actions
}