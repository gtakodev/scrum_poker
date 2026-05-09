import { useSyncExternalStore } from "react";

export type ThemeName = "light" | "dark" | "retro" | "sketch" | "bohemian";

export interface ThemeConfig {
  name: ThemeName;
  label: string;
  description: string;
  swatches: [string, string, string]; // 3 CSS colors for tri-color preview
}

export const THEMES: ThemeConfig[] = [
  {
    name: "light",
    label: "Daylight",
    description: "Warm indigo refinement",
    swatches: ["#f8f7f2", "#4338ca", "#e4a853"],
  },
  {
    name: "dark",
    label: "Obsidian",
    description: "Midnight violet depths",
    swatches: ["#1c1833", "#a78bfa", "#5eead4"],
  },
  {
    name: "retro",
    label: "Neon Arcade",
    description: "CRT phosphor glow",
    swatches: ["#110a02", "#f59e0b", "#84cc16"],
  },
  {
    name: "sketch",
    label: "Blueprint",
    description: "Drawn on graph paper",
    swatches: ["#f5e6c8", "#2b2b2b", "#c4956a"],
  },
  {
    name: "bohemian",
    label: "Desert Atelier",
    description: "Earthy terracotta luxury",
    swatches: ["#251a12", "#c87040", "#d4a03c"],
  },
];

const STORAGE_KEY = "sprintvote_theme";
const DEFAULT_TOASTER_THEME: "light" | "dark" = "light";

const themeListeners = new Set<() => void>();

function notifyThemeListeners(): void {
  for (const listener of themeListeners) {
    listener();
  }
}

function getStoredTheme(): ThemeName {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && THEMES.some((t) => t.name === stored)) {
      return stored as ThemeName;
    }
  } catch {
    // ignore
  }
  // Default: check system preference
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export function applyTheme(theme: ThemeName): void {
  const html = document.documentElement;

  // Remove all theme classes
  html.classList.remove("dark", "theme-retro", "theme-sketch", "theme-bohemian");
  html.removeAttribute("data-theme");

  // Apply theme
  html.setAttribute("data-theme", theme);

  switch (theme) {
    case "dark":
      html.classList.add("dark");
      break;
    case "retro":
      html.classList.add("dark", "theme-retro");
      break;
    case "sketch":
      html.classList.add("theme-sketch");
      break;
    case "bohemian":
      html.classList.add("dark", "theme-bohemian");
      break;
    // "light" — no extra classes
  }
}

function getThemeSnapshot(): ThemeName {
  if (typeof window === "undefined") {
    return "light";
  }

  return getStoredTheme();
}

function subscribeToTheme(listener: () => void): () => void {
  themeListeners.add(listener);

  return () => {
    themeListeners.delete(listener);
  };
}

export function setTheme(theme: ThemeName): void {
  applyTheme(theme);

  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore
  }

  notifyThemeListeners();
}

export function useTheme() {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getThemeSnapshot
  );

  return { theme, setTheme, themes: THEMES };
}

export function getToasterTheme(theme: ThemeName): "light" | "dark" {
  switch (theme) {
    case "dark":
    case "retro":
    case "bohemian":
      return "dark";
    case "light":
    case "sketch":
      return "light";
    default:
      return DEFAULT_TOASTER_THEME;
  }
}

/** Get confetti colors matching the current theme */
export function getThemeConfettiColors(theme: ThemeName): string[] {
  switch (theme) {
    case "light":
      return ["#4338ca", "#6366f1", "#e4a853", "#f472b6", "#34d399"];
    case "dark":
      return ["#a78bfa", "#c084fc", "#5eead4", "#f9a8d4", "#fbbf24"];
    case "retro":
      return ["#f59e0b", "#84cc16", "#ef4444", "#fbbf24", "#a3e635"];
    case "sketch":
      return ["#2b2b2b", "#c4956a", "#8b7355", "#d4a853", "#e8d5a3"];
    case "bohemian":
      return ["#c87040", "#d4a03c", "#7a9a5a", "#bf6060", "#ece1d4"];
  }
}
