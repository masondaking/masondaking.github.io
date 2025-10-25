import { createContext, ReactNode, useCallback, useContext, useMemo, useReducer } from "react";
import { generateId } from "../utils/crypto";

export type ModerationActionType = "ban" | "unban" | "delete_review" | "blocked_content" | "note";

export interface ModerationLogEntry {
  id: string;
  type: ModerationActionType;
  timestamp: string;
  actorUserId?: string;
  actorUsername?: string;
  targetUserId?: string;
  targetUsername?: string;
  targetResourceId?: string;
  details?: string;
}

interface ModerationState {
  blockedWords: string[];
  logs: ModerationLogEntry[];
}

interface ModerationContextValue {
  blockedWords: string[];
  addBlockedWord: (word: string) => void;
  removeBlockedWord: (word: string) => void;
  clearBlockedWords: () => void;
  logs: ModerationLogEntry[];
  recordLog: (entry: Omit<ModerationLogEntry, "id" | "timestamp">) => void;
  validateText: (text: string) => { ok: true } | { ok: false; word: string; index: number };
}

const STORAGE_WORDS = "sf:blocked-words";
const STORAGE_LOGS = "sf:moderation-logs";

const DEFAULT_WORDS: string[] = [
  // Base set; devs can extend in UI
  // Including common slurs and harassment terms (lowercased)
  "nigger", // racial slur
  "retard", // ableist slur
  "rape",
  "kill yourself",
  "kys",
];

function loadWords(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_WORDS);
    const custom = raw ? (JSON.parse(raw) as string[]) : [];
    const merged = Array.from(new Set([...DEFAULT_WORDS, ...custom])).map((w) => w.toLowerCase());
    return merged;
  } catch {
    return DEFAULT_WORDS;
  }
}

function loadLogs(): ModerationLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_LOGS);
    return raw ? (JSON.parse(raw) as ModerationLogEntry[]) : [];
  } catch {
    return [];
  }
}

function persistWords(words: string[]) {
  const custom = words.filter((w) => !DEFAULT_WORDS.includes(w));
  localStorage.setItem(STORAGE_WORDS, JSON.stringify(custom));
}

function persistLogs(entries: ModerationLogEntry[]) {
  localStorage.setItem(STORAGE_LOGS, JSON.stringify(entries));
}

type Action =
  | { type: "add"; word: string }
  | { type: "remove"; word: string }
  | { type: "clear_words" }
  | { type: "log"; entry: ModerationLogEntry };

function reducer(state: ModerationState, action: Action): ModerationState {
  switch (action.type) {
    case "add": {
      const nextWords = Array.from(new Set([...state.blockedWords, action.word.toLowerCase()]));
      persistWords(nextWords);
      return { ...state, blockedWords: nextWords };
    }
    case "remove": {
      const nextWords = state.blockedWords.filter((w) => w !== action.word.toLowerCase());
      persistWords(nextWords);
      return { ...state, blockedWords: nextWords };
    }
    case "clear_words": {
      persistWords([]);
      return { ...state, blockedWords: DEFAULT_WORDS };
    }
    case "log": {
      const logs = [action.entry, ...state.logs].slice(0, 500);
      persistLogs(logs);
      return { ...state, logs };
    }
    default:
      return state;
  }
}

const ModerationContext = createContext<ModerationContextValue | undefined>(undefined);

export function ModerationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({ blockedWords: loadWords(), logs: loadLogs() }));

  const addBlockedWord = useCallback<ModerationContextValue["addBlockedWord"]>((word) => {
    const w = word.trim().toLowerCase();
    if (!w) return;
    dispatch({ type: "add", word: w });
  }, []);

  const removeBlockedWord = useCallback<ModerationContextValue["removeBlockedWord"]>((word) => {
    dispatch({ type: "remove", word: word.trim().toLowerCase() });
  }, []);

  const clearBlockedWords = useCallback(() => dispatch({ type: "clear_words" }), []);

  const recordLog = useCallback<ModerationContextValue["recordLog"]>((entry) => {
    dispatch({
      type: "log",
      entry: {
        id: generateId("mod"),
        timestamp: new Date().toISOString(),
        ...entry,
      },
    });
  }, []);

  const validateText = useCallback<ModerationContextValue["validateText"]>((text) => {
    const hay = (text || "").toLowerCase();
    for (const word of state.blockedWords) {
      const idx = hay.indexOf(word);
      if (idx >= 0) return { ok: false as const, word, index: idx };
    }
    return { ok: true as const };
  }, [state.blockedWords]);

  const value = useMemo<ModerationContextValue>(
    () => ({
      blockedWords: state.blockedWords,
      addBlockedWord,
      removeBlockedWord,
      clearBlockedWords,
      logs: state.logs,
      recordLog,
      validateText,
    }),
    [state.blockedWords, state.logs, addBlockedWord, removeBlockedWord, clearBlockedWords, recordLog, validateText]
  );

  return <ModerationContext.Provider value={value}>{children}</ModerationContext.Provider>;
}

export function useModeration() {
  const ctx = useContext(ModerationContext);
  if (!ctx) throw new Error("useModeration must be used within a ModerationProvider");
  return ctx;
}

