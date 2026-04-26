import { create } from "zustand";
import * as authApi from "../api/auth";
import type { AuthTokens, LoginData, RegisterData, RegisterResponse, User } from "../types/models";

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  setTokens: (tokens: AuthTokens) => void;
  login: (data: LoginData) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  registerWithResponse: (data: RegisterData) => Promise<RegisterResponse>;
  logout: () => void;
  fetchUser: () => Promise<void>;
  initialize: () => Promise<void>;
}

const TOKENS_KEY = "manyoplan_tokens";

function loadTokens(): AuthTokens | null {
  try {
    const raw = sessionStorage.getItem(TOKENS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveTokens(tokens: AuthTokens | null) {
  if (tokens) {
    sessionStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
  } else {
    sessionStorage.removeItem(TOKENS_KEY);
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  tokens: loadTokens(),
  isLoading: false,
  isAuthenticated: false,

  setTokens: (tokens) => {
    saveTokens(tokens);
    set({ tokens });
  },

  login: async (data) => {
    set({ isLoading: true });
    try {
      const tokens = await authApi.login(data);
      saveTokens(tokens);
      set({ tokens, isAuthenticated: true });
      await get().fetchUser();
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (data) => {
    set({ isLoading: true });
    try {
      const { user, tokens } = await authApi.register(data);
      saveTokens(tokens);
      set({ user, tokens, isAuthenticated: true });
    } finally {
      set({ isLoading: false });
    }
  },

  registerWithResponse: async (data) => {
    set({ isLoading: true });
    try {
      const response = await authApi.register(data);
      saveTokens(response.tokens);
      set({ user: response.user, tokens: response.tokens, isAuthenticated: true });
      return response;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: () => {
    const refresh = get().tokens?.refresh;
    if (refresh) {
      authApi.logout(refresh).catch(() => {});
    }
    saveTokens(null);
    set({ user: null, tokens: null, isAuthenticated: false });
    // Also clear org state on logout
    import("./orgStore").then((m) => m.useOrgStore.getState().reset());
  },

  fetchUser: async () => {
    try {
      const user = await authApi.getMe();
      set({ user, isAuthenticated: true });
    } catch {
      get().logout();
    }
  },

  initialize: async () => {
    const tokens = get().tokens;
    if (tokens?.access) {
      set({ isLoading: true });
      try {
        await get().fetchUser();
      } finally {
        set({ isLoading: false });
      }
    }
  },
}));
