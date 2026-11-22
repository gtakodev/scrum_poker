const THEMES = [
  { id: "night-table", label: "Night Table" },
  { id: "light", label: "Daylight" },
  { id: "evergreen", label: "Evergreen" },
  { id: "afterglow", label: "Afterglow" },
] as const;

type ThemeId = (typeof THEMES)[number]["id"];

const DEFAULT_THEME: ThemeId = THEMES[0].id;
const STORAGE_KEY = "sprintvote_theme";

function parseTheme(value: string | null | undefined): ThemeId {
  return THEMES.find(({ id }) => id === value)?.id ?? DEFAULT_THEME;
}

function currentTheme(): ThemeId {
  return parseTheme(document.documentElement.dataset.theme);
}

function applyTheme(theme: ThemeId): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  const background = getComputedStyle(root).getPropertyValue("--background").trim();
  if (background) {
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", background);
  }
}

function initializeTheme(): void {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage may be unavailable.
  }
  applyTheme(parseTheme(stored));
}

function selectTheme(theme: ThemeId): void {
  applyTheme(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // The choice still applies to this tab when storage is unavailable.
  }
}

export { currentTheme, initializeTheme, selectTheme, THEMES };
