// Inlined into every page's <head> by src/templates/layout.ts, and deliberately not loaded as a
// file: it has to run before first paint, and a <script src> would let the page render in the
// wrong theme first.
//
// Sets the theme explicitly so the toggle wins over prefers-color-scheme in both directions, and
// marks the document as scripted so styles/site.css can hide controls that need JS.
//
// The theme names come from src/client/shared.ts, prepended to every client script.
try {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  const theme = stored ?? (matchMedia("(prefers-color-scheme: light)").matches ? LIGHT : DARK);
  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  document.documentElement.classList.add("js");
} catch {
  /* private mode, or storage disabled: the stylesheet's own defaults still apply */
}
