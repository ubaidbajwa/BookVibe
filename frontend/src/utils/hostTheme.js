/**
 * @file hostTheme.js
 * @description Global Theme Manager for BookVibe
 *
 * Controls the light/dark theme for ALL user types (guest, host, admin, anonymous).
 * The active theme is signalled via `html[data-theme='light']` — absence of the
 * attribute means dark mode (the default).
 *
 * Preference is persisted in localStorage under the key 'bv_theme'.
 * The 'system' option respects the OS prefers-color-scheme media query and
 * updates automatically when the user changes their system preference.
 */

const STORAGE_KEY = "bv_theme";

// --- Read Stored Preference ---

/**
 * @function getStoredTheme
 * @description Returns the stored theme preference ('light', 'dark', or 'system').
 * Falls back to 'dark' if localStorage is unavailable.
 * @returns {string} The stored theme preference.
 */
export const getStoredTheme = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) || "dark";
  } catch {
    return "dark";
  }
};

// --- Resolution Helpers ---

/**
 * @function resolveTheme
 * @description Resolves the 'system' virtual preference to an actual 'light' or 'dark' value.
 * @param {string} preference - The theme preference.
 * @returns {string} The resolved theme ('light' or 'dark').
 */
const resolveTheme = (preference) => {
  if (preference === "system") {
    const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    if (prefersLight) {
      return "light";
    } else {
      return "dark";
    }
  }
  return preference;
};

// --- DOM Application ---

/**
 * @function applyTheme
 * @description Applies the resolved theme to the document root.
 * @param {string} preference - 'light', 'dark', or 'system'
 */
export const applyTheme = (preference) => {
  const resolved = resolveTheme(preference);
  const html = document.documentElement;

  if (resolved === "light") {
    html.setAttribute("data-theme", "light");
    html.setAttribute("data-host-theme", "light");
  } else {
    html.removeAttribute("data-theme");
    html.removeAttribute("data-host-theme");
  }
};

// --- Public API ---

/**
 * @function setTheme
 * @description Persists the preference to localStorage then immediately applies it.
 * @param {string} preference - 'light', 'dark', or 'system'
 */
export const setTheme = (preference) => {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // ignore write errors
  }
  applyTheme(preference);
};

/**
 * @function toggleTheme
 * @description Toggles between light and dark (ignoring the 'system' option).
 * @returns {string} The new theme string.
 */
export const toggleTheme = () => {
  const current = getStoredTheme();
  let next;
  if (current === "light") {
    next = "dark";
  } else {
    next = "light";
  }
  setTheme(next);
  return next;
};

/**
 * @function isLightTheme
 * @description Returns true when the document is currently in light mode.
 * @returns {boolean} True if light mode is active.
 */
export const isLightTheme = () => {
  return document.documentElement.hasAttribute("data-theme");
};

/**
 * @function initTheme
 * @description Initializes the theme on app boot and registers a listener for OS changes.
 */
export const initTheme = () => {
  applyTheme(getStoredTheme());

  // When the user changes their OS color scheme and the stored preference
  // is 'system', re-resolve and apply the new effective theme
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (getStoredTheme() === "system") {
        applyTheme("system");
      }
    });
};

// --- Backward-Compatibility Aliases ---

/**
 * @deprecated Use getStoredTheme() directly
 */
export const getStoredHostTheme = getStoredTheme;

/**
 * @deprecated Use applyTheme() directly
 */
export const applyHostTheme = applyTheme;
