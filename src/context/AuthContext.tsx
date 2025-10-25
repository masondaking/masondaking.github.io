import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { generateId, hashPassword } from '../utils/crypto';
import { isEmailBlacklisted, isPasswordBlacklisted } from '../utils/blacklist';

export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  isDev: boolean;
  isAdmin: boolean;
  createdAt: string;
  banned?: boolean;
  banReason?: string;
  bannedAt?: string;
  lastAppealAt?: string;
  roleId?: string | null;
  warnings?: UserWarning[];
  bio?: string;
  accentColor?: string;
  avatarEmoji?: string;
  subscriptions: string[];
}

export interface UserWarning {
  id: string;
  message: string;
  createdAt: string;
}

export interface BanAppeal {
  id: string;
  userId: string;
  username: string;
  email: string;
  message: string;
  submittedAt: string;
  status: "pending" | "approved" | "rejected";
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
}

interface AuthContextType {
  user: User | null;
  login: (creds: { email: string; password: string }) => Promise<void>;
  signup: (input: { displayName: string; email: string; password: string }) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  // Admin/dev tools
  getUsers: () => Array<User & { banned: boolean; banReason?: string; warnings: UserWarning[] }>;
  banUser: (username: string, reason: string) => void;
  unbanUser: (username: string) => void;
  updateProfile: (patch: { displayName?: string; email?: string; bio?: string; accentColor?: string; avatarEmoji?: string }) => void;
  updatePassword: (input: { currentPassword: string; newPassword: string }) => Promise<void>;
  toggleSubscription: (authorId: string) => void;
  warnUser: (username: string, message: string) => void;
  submitBanAppeal: (input: { email: string; message: string }) => { nextAllowedAt: string | null };
  getBanAppeals: () => BanAppeal[];
  resolveBanAppeal: (id: string, action: "approve" | "reject", note?: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Developer accounts configuration
const DEV_ACCOUNTS = ["masondaking"];
const ADMIN_ACCOUNTS = ["darnix"];
const DEFAULT_AVATAR_EMOJI = 'âœ¨';
const DEFAULT_ACCENT_COLOR = '#7c3aed';

async function digestPassword(password: string, username: string): Promise<string> {
  return hashPassword(password, username);
}

const LEGACY_SALT = 'dreamscribe_salt';
const APPEAL_COOLDOWN_MS = 1000 * 60 * 60 * 24 * 182; // ~6 months

function legacyHash(password: string): string {
  const value = `${password}${LEGACY_SALT}`;
  const scope = globalThis as unknown as WindowOrWorkerGlobalScope;
  if (typeof scope.btoa === 'function') {
    return scope.btoa(value);
  }
  return value;
}

// Storage keys
const USERS_KEY = 'dreamscribe_users';
const CURRENT_USER_KEY = 'dreamscribe_current_user';
const BAN_APPEALS_KEY = 'dreamscribe_ban_appeals';

type StoredUser = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  password: string;
  createdAt: string;
  banned?: boolean;
  banReason?: string;
  bannedAt?: string;
  lastAppealAt?: string;
  roleId?: string | null;
  warnings?: UserWarning[];
  bio?: string;
  accentColor?: string;
  avatarEmoji?: string;
  subscriptions?: string[];
};

const readUsers = (): Record<string, StoredUser> => {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '{}');
  } catch {
    return {} as Record<string, StoredUser>;
  }
};

const writeUsers = (users: Record<string, StoredUser>) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

const readCurrentUser = (): User | null => {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
};

const writeCurrentUser = (u: User | null) => {
  if (u) localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(u));
  else localStorage.removeItem(CURRENT_USER_KEY);
};

const readBanAppeals = (): BanAppeal[] => {
  try {
    const raw = localStorage.getItem(BAN_APPEALS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BanAppeal[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeBanAppeals = (appeals: BanAppeal[]) => {
  localStorage.setItem(BAN_APPEALS_KEY, JSON.stringify(appeals));
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const initialise = async () => {
      try {
        const users = readUsers();
        const ensure = async (username: string, email: string, passwordPlain: string) => {
          const key = username;
          const normalizedEmail = email.trim().toLowerCase();
          const hashed = await digestPassword(passwordPlain, username);
          if (!users[key]) {
            users[key] = {
              id: generateId('user'),
              username,
              displayName: username,
              email: normalizedEmail,
              password: hashed,
              createdAt: new Date().toISOString(),
              banned: false,
              roleId: getDefaultRoleId(username),
              warnings: [],
              bio: '',
              accentColor: DEFAULT_ACCENT_COLOR,
              avatarEmoji: DEFAULT_AVATAR_EMOJI,
              subscriptions: [],
            };
          } else {
            if (DEV_ACCOUNTS.includes(username.toLowerCase())) {
              users[key].banned = false;
              users[key].banReason = undefined;
              users[key].bannedAt = undefined;
              users[key].roleId = getDefaultRoleId(username);
            }
            if (users[key].password !== hashed) {
              users[key].password = hashed;
            }
            users[key].email = normalizedEmail;
          }
          users[key].warnings = users[key].warnings ?? [];
          users[key].bio = users[key].bio ?? '';
          users[key].accentColor = users[key].accentColor ?? DEFAULT_ACCENT_COLOR;
          users[key].avatarEmoji = users[key].avatarEmoji ?? DEFAULT_AVATAR_EMOJI;
          users[key].subscriptions = users[key].subscriptions ?? [];
          users[key].lastAppealAt = users[key].lastAppealAt ?? undefined;
        };

        await Promise.all([
          ensure("masondaking", "masondaking@dev.local", "MasonDev#2025"),
          ensure("darnix", "darnix@dev.local", "DarnixDev#2025"),
        ]);

        writeUsers(users);

        const existing = readCurrentUser();
        if (existing) {
          const stored = Object.values(users).find((u) => u.id === existing.id);
          if (stored?.banned) {
            writeCurrentUser(null);
            if (!cancelled) {
              setUser(null);
            }
          } else {
            const hydrated: User = {
              ...existing,
              warnings: stored?.warnings ?? existing.warnings ?? [],
              bio: stored?.bio ?? existing.bio ?? '',
              accentColor: stored?.accentColor ?? existing.accentColor ?? DEFAULT_ACCENT_COLOR,
              avatarEmoji: stored?.avatarEmoji ?? existing.avatarEmoji ?? DEFAULT_AVATAR_EMOJI,
              subscriptions: stored?.subscriptions ?? existing.subscriptions ?? [],
              isAdmin: ADMIN_ACCOUNTS.includes((stored?.username ?? existing.username).toLowerCase()),
              bannedAt: stored?.bannedAt ?? existing.bannedAt,
              lastAppealAt: stored?.lastAppealAt ?? existing.lastAppealAt,
              banReason: stored?.banReason ?? existing.banReason,
              banned: stored?.banned ?? existing.banned,
            };
            writeCurrentUser(hydrated);
            if (!cancelled) {
              setUser(hydrated);
            }
          }
        }
      } catch (error) {
        console.error('Failed to initialise auth context', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void initialise();

    return () => {
      cancelled = true;
    };
  }, []);

  const login: AuthContextType['login'] = async ({ email, password }) => {
    const users = readUsers();
    const normalizedEmail = email.trim().toLowerCase();
    const match = Object.values(users).find((u) => u.email.toLowerCase() === normalizedEmail);

    if (isEmailBlacklisted(normalizedEmail)) {
      const lastAppealAtMs = match?.lastAppealAt ? Date.parse(match.lastAppealAt) : null;
      const nextAppealAt =
        match && lastAppealAtMs && Number.isFinite(lastAppealAtMs)
          ? new Date(lastAppealAtMs + APPEAL_COOLDOWN_MS).toISOString()
          : null;
      const canAppeal = match ? !lastAppealAtMs || Date.now() >= (lastAppealAtMs ?? 0) + APPEAL_COOLDOWN_MS : false;
      const error = new Error('This email is banned');
      (error as Error & { code?: string; ban?: Record<string, unknown> }).code = 'BANNED';
      (error as Error & { code?: string; ban?: Record<string, unknown> }).ban = {
        reason: match?.banReason ?? 'This account is banned',
        bannedAt: match?.bannedAt ?? null,
        lastAppealAt: match?.lastAppealAt ?? null,
        nextAppealAt,
        canAppeal,
      };
      throw error;
    }

    if (!match) {
      throw new Error('Invalid email or password');
    }

    if (isPasswordBlacklisted(password)) {
      const error = new Error('This password is banned');
      (error as Error & { code?: string }).code = 'BANNED_PASSWORD';
      throw error;
    }

    if (match.banned) {
      const reason = match.banReason ? `: ${match.banReason}` : '';
      const lastAppealAt = match.lastAppealAt ? Date.parse(match.lastAppealAt) : null;
      const nextAppealAt =
        lastAppealAt && Number.isFinite(lastAppealAt)
          ? new Date(lastAppealAt + APPEAL_COOLDOWN_MS).toISOString()
          : null;
      const canAppeal = !lastAppealAt || Date.now() >= lastAppealAt + APPEAL_COOLDOWN_MS;
      const error = new Error(`This account has been banned${reason}`);
      (error as Error & { code?: string; ban?: Record<string, unknown> }).code = 'BANNED';
      (error as Error & { code?: string; ban?: Record<string, unknown> }).ban = {
        reason: match.banReason ?? null,
        bannedAt: match.bannedAt ?? null,
        lastAppealAt: match.lastAppealAt ?? null,
        nextAppealAt,
        canAppeal,
      };
      throw error;
    }

    const key = match.username;
    const hashed = await digestPassword(password, match.username);
    let record = users[key];
    if (!record) {
      throw new Error('Invalid email or password');
    }
    if (record.password !== hashed) {
      const legacy = legacyHash(password);
      if (record.password === legacy) {
        record = { ...record, password: hashed };
        users[key] = record;
        writeUsers(users);
      } else {
        throw new Error('Invalid email or password');
      }
    }
    record.warnings = record.warnings ?? [];
    record.bio = record.bio ?? '';
    record.accentColor = record.accentColor ?? DEFAULT_ACCENT_COLOR;
    record.avatarEmoji = record.avatarEmoji ?? DEFAULT_AVATAR_EMOJI;
    record.subscriptions = record.subscriptions ?? [];
    users[key] = record;
    writeUsers(users);
    const next: User = {
      id: record.id,
      username: record.username,
      displayName: record.displayName || record.username,
      email: record.email,
      isDev: DEV_ACCOUNTS.includes(record.username.toLowerCase()),
      isAdmin: ADMIN_ACCOUNTS.includes(record.username.toLowerCase()),
      createdAt: record.createdAt,
      banned: !!record.banned,
      banReason: record.banReason,
      bannedAt: record.bannedAt,
      lastAppealAt: record.lastAppealAt,
      roleId: record.roleId ?? null,
      warnings: record.warnings ?? [],
      bio: record.bio,
      accentColor: record.accentColor,
      avatarEmoji: record.avatarEmoji,
      subscriptions: record.subscriptions,
    };
    setUser(next);
    writeCurrentUser(next);
  };

  const signup: AuthContextType['signup'] = async ({ displayName, email, password }) => {
    const username = displayName.trim();
    if (!username) throw new Error('Display name is required');
    const normalizedEmail = email.trim().toLowerCase();
    const users = readUsers();
    const emailMatch = Object.values(users).find((u) => u.email.toLowerCase() === normalizedEmail);
    if (emailMatch) {
      if (emailMatch.banned) {
        const reason = emailMatch.banReason ? `: ${emailMatch.banReason}` : '';
        throw new Error(`Sign up blocked â€” this email is banned${reason}`);
      }
      throw new Error('An account with this email already exists');
    }
    const usernameMatch = users[username];
    if (usernameMatch && usernameMatch.banned) {
      const reason = usernameMatch.banReason ? `: ${usernameMatch.banReason}` : '';
      throw new Error(`Sign up blocked â€” this username is banned${reason}`);
    }
    const id = generateId('user');
    const stored: StoredUser = {
      id,
      username,
      displayName: username,
      email: normalizedEmail,
      password: await digestPassword(password, username),
      createdAt: new Date().toISOString(),
      banned: false,
      roleId: 'free',
      warnings: [],
      bio: '',
      accentColor: DEFAULT_ACCENT_COLOR,
      avatarEmoji: DEFAULT_AVATAR_EMOJI,
      subscriptions: [],
      lastAppealAt: undefined,
    };
    users[username] = stored;
    writeUsers(users);

    const next: User = {
      id: stored.id,
      username: stored.username,
      displayName: stored.displayName,
      email: stored.email,
      isDev: DEV_ACCOUNTS.includes(stored.username.toLowerCase()),
      isAdmin: ADMIN_ACCOUNTS.includes(stored.username.toLowerCase()),
              isAdmin: ADMIN_ACCOUNTS.includes(stored.username.toLowerCase()),
      createdAt: stored.createdAt,
      banned: false,
      banReason: undefined,
      roleId: 'free',
      warnings: [],
      bio: stored.bio,
      accentColor: stored.accentColor,
      avatarEmoji: stored.avatarEmoji,
      subscriptions: stored.subscriptions ?? [],
      bannedAt: undefined,
      lastAppealAt: undefined,
    };
    setUser(next);
    writeCurrentUser(next);
  };

  const logout = () => {
    setUser(null);
    writeCurrentUser(null);
  };

  const updateProfile: AuthContextType['updateProfile'] = (patch) => {
    const current = user;
    if (!current) return;
    const users = readUsers();
    const record = users[current.username];
    if (!record) return;

    if (patch.email && patch.email.toLowerCase() !== record.email.toLowerCase()) {
      const conflict = Object.values(users).some((u) => u.email.toLowerCase() === patch.email!.toLowerCase());
      if (conflict) throw new Error('Email already in use');
      record.email = patch.email;
    }
    if (patch.displayName && patch.displayName.trim() && patch.displayName !== record.displayName) {
      record.displayName = patch.displayName.trim();
    }
    if (patch.bio !== undefined) {
      record.bio = patch.bio.trim().slice(0, 320);
    }
    if (patch.accentColor !== undefined) {
      const value = patch.accentColor.trim();
      const isValid = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
      record.accentColor = isValid ? value : DEFAULT_ACCENT_COLOR;
    }
    if (patch.avatarEmoji !== undefined) {
      const fallback = patch.avatarEmoji.trim();
      record.avatarEmoji = fallback ? fallback.slice(0, 4) : DEFAULT_AVATAR_EMOJI;
    }
    record.bio = record.bio ?? '';
    record.accentColor = record.accentColor ?? DEFAULT_ACCENT_COLOR;
    record.avatarEmoji = record.avatarEmoji ?? DEFAULT_AVATAR_EMOJI;
    users[current.username] = record;
    writeUsers(users);
    const nextUser: User = {
      ...current,
      displayName: record.displayName,
      email: record.email,
      bio: record.bio,
      accentColor: record.accentColor,
      avatarEmoji: record.avatarEmoji,
      subscriptions: record.subscriptions ?? current.subscriptions ?? [],
    };
    setUser(nextUser);
    writeCurrentUser(nextUser);
  };

  const updatePassword: AuthContextType['updatePassword'] = async ({ currentPassword, newPassword }) => {
    const current = user;
    if (!current) {
      throw new Error('You must be signed in to update your password');
    }
    const existingUsers = readUsers();
    const record = existingUsers[current.username];
    if (!record) {
      throw new Error('Account could not be found');
    }
    const currentInput = currentPassword.trim();
    const nextInput = newPassword.trim();
    if (!currentInput) {
      throw new Error('Current password is required');
    }
    if (nextInput.length < 8) {
      throw new Error('New password must be at least 8 characters long');
    }
    const hashedCurrent = await digestPassword(currentInput, record.username);
    if (record.password !== hashedCurrent) {
      const legacy = legacyHash(currentInput);
      if (record.password !== legacy) {
        throw new Error('Current password is incorrect');
      }
    }
    record.password = await digestPassword(nextInput, record.username);
    existingUsers[current.username] = record;
    writeUsers(existingUsers);
  };

  const submitBanAppeal: AuthContextType['submitBanAppeal'] = ({ email, message }) => {
    const normalizedEmail = email.trim().toLowerCase();
    const payload = message.trim();
    if (!normalizedEmail) {
      throw new Error('Email is required for an appeal');
    }
    if (!payload) {
      throw new Error('Please share details for your appeal');
    }
    const users = readUsers();
    const record = Object.values(users).find((entry) => entry.email.toLowerCase() === normalizedEmail);
    if (!record || !record.banned) {
      throw new Error('No banned account found for this email');
    }
    const lastAppeal = record.lastAppealAt ? Date.parse(record.lastAppealAt) : null;
    if (lastAppeal && Number.isFinite(lastAppeal) && Date.now() < lastAppeal + APPEAL_COOLDOWN_MS) {
      const next = new Date(lastAppeal + APPEAL_COOLDOWN_MS).toISOString();
      const error = new Error('You can send another appeal after the cooldown period');
      (error as Error & { code?: string; nextAllowedAt?: string }).code = 'APPEAL_COOLDOWN';
      (error as Error & { code?: string; nextAllowedAt?: string }).nextAllowedAt = next;
      throw error;
    }
    const now = new Date();
    const appeal: BanAppeal = {
      id: generateId('appeal'),
      userId: record.id,
      username: record.username,
      email: record.email,
      message: payload,
      submittedAt: now.toISOString(),
      status: 'pending',
    };
    const appeals = [appeal, ...readBanAppeals()].slice(0, 300);
    writeBanAppeals(appeals);
    record.lastAppealAt = appeal.submittedAt;
    users[record.username] = record;
    writeUsers(users);
    const nextAllowedAt = new Date(now.getTime() + APPEAL_COOLDOWN_MS).toISOString();
    return { nextAllowedAt };
  };

  const getBanAppeals: AuthContextType['getBanAppeals'] = () => {
    return [...readBanAppeals()].sort(
      (a, b) => Date.parse(b.submittedAt || '') - Date.parse(a.submittedAt || '')
    );
  };

  const resolveBanAppeal: AuthContextType['resolveBanAppeal'] = (id, action, note) => {
    if (!user?.isDev) return;
    const appeals = readBanAppeals();
    const index = appeals.findIndex((entry) => entry.id === id);
    if (index === -1) return;
    const target = appeals[index];
    if (target.status !== 'pending') return;
    const resolution = action === 'approve' ? 'approved' : 'rejected';
    const resolvedAt = new Date().toISOString();
    appeals[index] = {
      ...target,
      status: resolution,
      resolvedAt,
      resolvedBy: user.username,
      resolutionNote: note?.trim() || undefined,
    };
    writeBanAppeals(appeals);
    if (action === 'approve') {
      const users = readUsers();
      const recordEntry = Object.values(users).find((entry) => entry.id === target.userId);
      if (recordEntry) {
        recordEntry.banned = false;
        recordEntry.banReason = undefined;
        recordEntry.bannedAt = undefined;
        users[recordEntry.username] = recordEntry;
        writeUsers(users);
      }
    }
  };

  const toggleSubscription: AuthContextType['toggleSubscription'] = (authorId) => {
    if (!user) return;
    if (!authorId || authorId === user.id) return;
    const users = readUsers();
    const record = users[user.username];
    if (!record) return;
    const existing = record.subscriptions ?? [];
    const updated = existing.includes(authorId)
      ? existing.filter((entry) => entry !== authorId)
      : [...existing, authorId];
    record.subscriptions = updated;
    users[user.username] = record;
    writeUsers(users);
    const nextUser: User = {
      ...user,
      subscriptions: updated,
    };
    setUser(nextUser);
    writeCurrentUser(nextUser);
  };


  const warnUser: AuthContextType['warnUser'] = (username, message) => {
    if (!message.trim()) return;
    const users = readUsers();
    const record = users[username];
    if (!record) return;
    const entry = {
      id: generateId('warn'),
      message: message.trim(),
      createdAt: new Date().toISOString(),
    };
    record.warnings = [...(record.warnings ?? []), entry];
    users[username] = record;
    writeUsers(users);
    if (user && user.username === username) {
      const nextUser: User = { ...user, warnings: record.warnings };
      setUser(nextUser);
      writeCurrentUser(nextUser);
    }
  };

  const value: AuthContextType = {
    user,
    login,
    signup,
    logout,
    isAuthenticated: !!user,
    isLoading,
    getUsers: () => {
      const users = readUsers();
      return Object.values(users).map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName || u.username,
        email: u.email,
        isDev: DEV_ACCOUNTS.includes(u.username.toLowerCase()),
        createdAt: u.createdAt,
        banned: !!u.banned,
        banReason: u.banReason,
        bannedAt: u.bannedAt,
        lastAppealAt: u.lastAppealAt,
        roleId: u.roleId ?? null,
        warnings: u.warnings ?? [],
        bio: u.bio ?? '',
        accentColor: u.accentColor ?? DEFAULT_ACCENT_COLOR,
        avatarEmoji: u.avatarEmoji ?? DEFAULT_AVATAR_EMOJI,
        subscriptions: u.subscriptions ?? [],
      }));
    },
    banUser: (username: string, reason: string) => {
      const users = readUsers();
      const record = users[username];
      if (record) {
        // Prevent banning developer accounts
        if (DEV_ACCOUNTS.includes(record.username.toLowerCase())) {
          return; // ignore attempts to ban devs
        }
        const banReason = (reason || '').trim();
        if (!banReason) {
          return; // require a reason; do nothing if missing
        }
        record.banned = true;
        record.banReason = banReason;
        record.bannedAt = new Date().toISOString();
        users[username] = record;
        writeUsers(users);
        if (user && user.username === username) {
          // revoke current session if banning self/active
          setUser(null);
          writeCurrentUser(null);
        }
      }
    },
    unbanUser: (username: string) => {
      const users = readUsers();
      const record = users[username];
      if (record) {
        record.banned = false;
        record.banReason = undefined;
        record.bannedAt = undefined;
        record.lastAppealAt = undefined;
        users[username] = record;
        writeUsers(users);
      }
    },
    updateProfile,
    updatePassword,
    submitBanAppeal,
    getBanAppeals,
    resolveBanAppeal,
    toggleSubscription,
    warnUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}






