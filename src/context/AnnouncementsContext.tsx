import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { generateId } from "../utils/crypto";

export interface GlobalAnnouncement {
  id: string;
  message: string;
  createdAt: string;
  allowHearts: boolean;
}

interface AnnouncementsState {
  current: GlobalAnnouncement | null;
  dismissedBy: Record<string, string>;
  heartedBy: Record<string, string>;
}

interface AnnouncementsContextValue {
  announcement: GlobalAnnouncement | null;
  dismissedBy: Record<string, string>;
  heartedBy: Record<string, string>;
  publishAnnouncement: (input: { message: string; allowHearts?: boolean }) => GlobalAnnouncement;
  clearAnnouncement: () => void;
  dismissForUser: (userId: string) => void;
  toggleHeart: (userId: string) => void;
}

const STORAGE_KEY = "sf:announcement";

const defaultState: AnnouncementsState = {
  current: null,
  dismissedBy: {},
  heartedBy: {},
};

function readInitialState(): AnnouncementsState {
  if (typeof window === "undefined") {
    return defaultState;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as AnnouncementsState;
    if (parsed && typeof parsed === "object") {
      return {
        current: parsed.current ?? null,
        dismissedBy: parsed.dismissedBy ?? {},
        heartedBy: parsed.heartedBy ?? {},
      };
    }
    return defaultState;
  } catch {
    return defaultState;
  }
}

const AnnouncementsContext = createContext<AnnouncementsContextValue | undefined>(undefined);

export function AnnouncementsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AnnouncementsState>(() => readInitialState());

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore persistence errors
    }
  }, [state]);

  const publishAnnouncement = useCallback<AnnouncementsContextValue["publishAnnouncement"]>((input) => {
    const trimmed = input.message.trim();
    if (!trimmed) {
      throw new Error("Announcement message cannot be empty");
    }
    const announcement: GlobalAnnouncement = {
      id: generateId("ann"),
      message: trimmed,
      createdAt: new Date().toISOString(),
      allowHearts: Boolean(input.allowHearts),
    };
    setState({ current: announcement, dismissedBy: {}, heartedBy: {} });
    return announcement;
  }, []);

  const clearAnnouncement = useCallback(() => {
    setState(defaultState);
  }, []);

  const dismissForUser = useCallback<AnnouncementsContextValue["dismissForUser"]>((userId) => {
    setState((prev) => {
      if (!prev.current || !userId) return prev;
      if (prev.dismissedBy[userId]) return prev;
      return {
        ...prev,
        dismissedBy: { ...prev.dismissedBy, [userId]: new Date().toISOString() },
      };
    });
  }, []);

  const toggleHeart = useCallback<AnnouncementsContextValue["toggleHeart"]>((userId) => {
    setState((prev) => {
      if (!prev.current || !prev.current.allowHearts || !userId) return prev;
      const hearted = { ...prev.heartedBy };
      if (hearted[userId]) {
        delete hearted[userId];
      } else {
        hearted[userId] = new Date().toISOString();
      }
      return { ...prev, heartedBy: hearted };
    });
  }, []);

  const value = useMemo<AnnouncementsContextValue>(
    () => ({
      announcement: state.current,
      dismissedBy: state.dismissedBy,
      heartedBy: state.heartedBy,
      publishAnnouncement,
      clearAnnouncement,
      dismissForUser,
      toggleHeart,
    }),
    [state, publishAnnouncement, clearAnnouncement, dismissForUser, toggleHeart]
  );

  return <AnnouncementsContext.Provider value={value}>{children}</AnnouncementsContext.Provider>;
}

export function useAnnouncements() {
  const ctx = useContext(AnnouncementsContext);
  if (!ctx) {
    throw new Error("useAnnouncements must be used within an AnnouncementsProvider");
  }
  return ctx;
}
