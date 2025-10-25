import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { generateId } from "../utils/crypto";

export interface Role {
  id: string;
  name: string; // system key
  label: string; // shown to users
  color: string; // background color (hex or rgba)
  textColor: string; // text color
  emoji?: string; // optional emoji prefix
}

interface RolesContextValue {
  roles: Role[];
  getRole: (id?: string | null) => Role | undefined;
  createRole: (input: Omit<Role, "id">) => Role;
  updateRole: (id: string, patch: Partial<Omit<Role, "id">>) => void;
  deleteRole: (id: string) => void;
  // per-user role assignments (by username)
  getUserRoleId: (username: string, flags?: { isDev?: boolean; isAdmin?: boolean }) => string; // falls back to defaults
  assignRole: (username: string, roleId: string | null) => void;
}

const STORAGE_KEY = "sf:roles";
const STORAGE_USER_ROLES = "sf:user-roles";

const defaultRoles: Role[] = [
  { id: "paid", name: "paid", label: "PAID member", color: "#f59e0b", textColor: "#1a1306", emoji: "ðŸ’Ž" },
  { id: "free", name: "broke", label: "Broke", color: "rgba(255,255,255,0.14)", textColor: "#ffffff", emoji: "ðŸ˜¢" },
];

function loadRoles(): Role[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultRoles;
    const custom = JSON.parse(raw) as Role[];
    // Merge by id; defaults first so custom overrides if matching ids exist
    const map = new Map<string, Role>(defaultRoles.map((r) => [r.id, r]));
    for (const r of custom) map.set(r.id, r);
    return Array.from(map.values());
  } catch {
    return defaultRoles;
  }
}

function persistRoles(roles: Role[]) {
  // Only persist non-default or modified items; for simplicity persist all
  localStorage.setItem(STORAGE_KEY, JSON.stringify(roles));
}

const RolesContext = createContext<RolesContextValue | undefined>(undefined);

export function RolesProvider({ children }: { children: ReactNode }) {
  const [roles, setRoles] = useState<Role[]>(() => loadRoles());
  const [userRoles, setUserRoles] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_USER_ROLES) || "{}") as Record<string, string>;
    } catch {
      return {} as Record<string, string>;
    }
  });

  const getRole = useCallback<RolesContextValue["getRole"]>((id) => roles.find((r) => r.id === id), [roles]);

  const createRole = useCallback<RolesContextValue["createRole"]>((input) => {
    const role: Role = { id: generateId("role"), ...input };
    setRoles((prev) => {
      const next = [...prev, role];
      persistRoles(next);
      return next;
    });
    return role;
  }, []);

  const updateRole = useCallback<RolesContextValue["updateRole"]>((id, patch) => {
    setRoles((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, ...patch } : r));
      persistRoles(next);
      return next;
    });
  }, []);

  const deleteRole = useCallback<RolesContextValue["deleteRole"]>((id) => {
    setRoles((prev) => {
      const next = prev.filter((r) => r.id !== id);
      persistRoles(next);
      return next;
    });
  }, []);

  const getUserRoleId = useCallback<RolesContextValue["getUserRoleId"]>((username, isDev) => {
    const assigned = userRoles[username];
    if (assigned) return assigned;
    return isDev ? "paid" : "free";
  }, [userRoles]);

  const assignRole = useCallback<RolesContextValue["assignRole"]>((username, roleId) => {
    setUserRoles((prev) => {
      const next = { ...prev } as Record<string, string>;
      if (!roleId) {
        delete next[username];
      } else {
        next[username] = roleId;
      }
      localStorage.setItem(STORAGE_USER_ROLES, JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo<RolesContextValue>(
    () => ({ roles, getRole, createRole, updateRole, deleteRole, getUserRoleId, assignRole }),
    [roles, getRole, createRole, updateRole, deleteRole, getUserRoleId, assignRole]
  );

  return <RolesContext.Provider value={value}>{children}</RolesContext.Provider>;
}

export function useRoles() {
  const ctx = useContext(RolesContext);
  if (!ctx) throw new Error("useRoles must be used within a RolesProvider");
  return ctx;
}

