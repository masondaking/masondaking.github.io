import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react";
import { generateId } from "../utils/crypto";

export type DebugLogLevel = "info" | "request" | "response" | "error";

export interface DebugLogEntry {
  id: string;
  level: DebugLogLevel;
  timestamp: string;
  summary: string;
  payload?: unknown;
}

interface DebugState {
  entries: DebugLogEntry[];
}

interface DebugContextValue {
  logs: DebugLogEntry[];
  append: (entry: Omit<DebugLogEntry, "id" | "timestamp"> & { payload?: unknown }) => void;
  clear: () => void;
  isConsoleOpen: boolean;
  toggleConsole: () => void;
}

const DebugContext = createContext<DebugContextValue | undefined>(undefined);

function debugReducer(state: DebugState, action: { type: "append"; entry: DebugLogEntry } | { type: "clear" }): DebugState {
  switch (action.type) {
    case "append":
      return { entries: [action.entry, ...state.entries].slice(0, 200) };
    case "clear":
      return { entries: [] };
    default:
      return state;
  }
}

export function DebugProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(debugReducer, { entries: [] });
  const [isConsoleOpen, setConsoleOpen] = useState(false);

  const append = useCallback<DebugContextValue["append"]>((entry) => {
    dispatch({
      type: "append",
      entry: {
        id: generateId("log"),
        timestamp: new Date().toISOString(),
        ...entry,
      },
    });
  }, []);

  const clear = useCallback(() => dispatch({ type: "clear" }), []);

  const toggleConsole = useCallback(() => setConsoleOpen((prev) => !prev), []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === "d") {
        event.preventDefault();
        setConsoleOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const value = useMemo(() => ({ logs: state.entries, append, clear, isConsoleOpen, toggleConsole }), [state.entries, append, clear, isConsoleOpen, toggleConsole]);

  return <DebugContext.Provider value={value}>{children}</DebugContext.Provider>;
}

export function useDebug() {
  const ctx = useContext(DebugContext);
  if (!ctx) {
    throw new Error("useDebug must be used within a DebugProvider");
  }
  return ctx;
}
