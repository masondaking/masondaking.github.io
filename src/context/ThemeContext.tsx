import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

export type ThemeId = "radiant" | "dark";

interface ThemeOption {
  id: ThemeId;
  label: string;
  description: string;
}

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (next: ThemeId) => void;
  toggleTheme: () => void;
  options: ThemeOption[];
}

const STORAGE_KEY = "sf:theme";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function readInitialTheme(): ThemeId {
  if (typeof window === "undefined") {
    return "radiant";
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    if (stored === "radiant" || stored === "dark") {
      return stored;
    }
  } catch {
    // ignore
  }
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "radiant";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(readInitialTheme);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore persistence errors
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;
    const handler = (event: MediaQueryListEvent) => {
      setThemeState((prev) => {
        if (prev !== "radiant" && prev !== "dark") {
          return prev;
        }
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored === "radiant" || stored === "dark") {
          return prev;
        }
        return event.matches ? "dark" : "radiant";
      });
    };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  const setTheme = (next: ThemeId) => {
    setThemeState(next === "dark" ? "dark" : "radiant");
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === "dark" ? "radiant" : "dark"));
  };

  const options = useMemo<ThemeOption[]>(
    () => [
      { id: "radiant", label: "Radiant", description: "Signature Dreamscribe glow" },
      { id: "dark", label: "Dark Mode", description: "Low-light friendly contrast" },
    ],
    []
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      options,
    }),
    [theme, options]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
