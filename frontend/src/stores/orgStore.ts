import { create } from "zustand";
import * as orgsApi from "../api/organizations";
import type { Organization } from "../types/models";

interface OrgState {
  myOrgs: Organization[];
  currentOrg: Organization | null;
  isLoading: boolean;
  hasFetched: boolean;

  fetchMyOrgs: () => Promise<Organization[]>;
  setCurrentOrg: (org: Organization | null) => void;
  setCurrentOrgById: (id: number | null) => void;
  refreshCurrentOrg: () => Promise<void>;
  reset: () => void;
}

const CURRENT_ORG_KEY = "manyoplan_current_org";

function loadCurrentOrgId(): number | null {
  try {
    const raw = sessionStorage.getItem(CURRENT_ORG_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

function saveCurrentOrgId(id: number | null) {
  if (id !== null) {
    sessionStorage.setItem(CURRENT_ORG_KEY, String(id));
  } else {
    sessionStorage.removeItem(CURRENT_ORG_KEY);
  }
}

export const useOrgStore = create<OrgState>((set, get) => ({
  myOrgs: [],
  currentOrg: null,
  isLoading: false,
  hasFetched: false,

  fetchMyOrgs: async () => {
    set({ isLoading: true });
    try {
      const orgs = await orgsApi.getMyOrgs();
      const persistedId = loadCurrentOrgId();
      const current =
        orgs.find((o) => o.id === persistedId) ?? orgs[0] ?? null;
      if (current) saveCurrentOrgId(current.id);
      set({ myOrgs: orgs, currentOrg: current, hasFetched: true });
      return orgs;
    } finally {
      set({ isLoading: false });
    }
  },

  setCurrentOrg: (org) => {
    saveCurrentOrgId(org?.id ?? null);
    set((s) => ({
      currentOrg: org,
      // Optimistically include the org in myOrgs so the UI doesn't think the user has none
      myOrgs:
        org && !s.myOrgs.some((o) => o.id === org.id)
          ? [...s.myOrgs, org]
          : s.myOrgs,
    }));
  },

  setCurrentOrgById: (id) => {
    if (id === null) {
      saveCurrentOrgId(null);
      set({ currentOrg: null });
      return;
    }
    const found = get().myOrgs.find((o) => o.id === id) ?? null;
    saveCurrentOrgId(found?.id ?? null);
    set({ currentOrg: found });
  },

  refreshCurrentOrg: async () => {
    const current = get().currentOrg;
    if (!current) return;
    const fresh = await orgsApi.getOrg(current.id);
    set((s) => ({
      currentOrg: fresh,
      myOrgs: s.myOrgs.map((o) => (o.id === fresh.id ? fresh : o)),
    }));
  },

  reset: () => {
    saveCurrentOrgId(null);
    set({ myOrgs: [], currentOrg: null, isLoading: false, hasFetched: false });
  },
}));
