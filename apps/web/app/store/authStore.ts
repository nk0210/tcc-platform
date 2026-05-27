import { create } from "zustand";

interface User {
  id: string;
  email: string;
  handle: string;
  skillLevel: string;
  tccId?: string;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  setAuth: (user, token) => {
    localStorage.setItem("tcc_token", token);
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem("tcc_token");
    set({ user: null, token: null });
  },
}));