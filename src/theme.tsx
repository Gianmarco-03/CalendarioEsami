import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import * as db from "./db";

export type Theme = "light" | "dark";
const STORAGE_KEY = "ui.theme";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  // Initial load: read setting from DB; if missing, fall back to system pref.
  useEffect(() => {
    void (async () => {
      try {
        const stored = await db.getSetting(STORAGE_KEY);
        if (stored === "dark" || stored === "light") {
          setThemeState(stored);
          applyTheme(stored);
          return;
        }
        const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
        const initial: Theme = prefersDark ? "dark" : "light";
        setThemeState(initial);
        applyTheme(initial);
      } catch {
        // DB not ready (init error); leave default light.
      }
    })();
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    applyTheme(t);
    void db.setSetting(STORAGE_KEY, t).catch(() => { /* ignore */ });
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be inside ThemeProvider");
  return ctx;
}
