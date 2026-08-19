// The always-loaded glue: theme toggle, copy buttons, and the search trigger. Inlined into every
// page by src/templates/layout.ts — it is small, and a request per page for this much would cost
// more than it saves.
//
// The search dialog's own wiring (and Pagefind itself) live in /assets/search.js, fetched via
// dynamic import() only when the dialog is first opened, so Pagefind's JS/WASM bundle never loads
// for visitors who don't search.
//
// This was a concatenated string literal in the template until it grew into a real program: 25
// lines of behaviour that nothing formatted, nothing type-checked and no test could reach. It is
// now compiled and minified by esbuild at build time, so it is written as ordinary modern
// TypeScript rather than to the oldest syntax a browser might accept.
const COPIED_MS = 1500;
const FALLBACK_MS = 2000;

/** The timeout each copy button owns, so a second click restarts its own label rather than
 *  another button's. Kept beside the element rather than on it — an expando on a DOM node is
 *  invisible to the type system and to anyone reading the markup. */
const copyTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
const copyLabels = new WeakMap<HTMLElement, string>();

function setTheme(theme: "light" | "dark"): void {
  document.documentElement.setAttribute("data-theme", theme);
  document.querySelector("[data-theme-toggle]")?.setAttribute("aria-pressed", String(theme === "light"));
  try {
    localStorage.setItem("theme", theme);
  } catch {
    /* storage disabled: the theme still applies to this page */
  }
}

function currentTheme(): "light" | "dark" {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

async function openSearch(): Promise<void> {
  const { openSearch: open } = await import("/assets/search.js");
  open();
}

/** Restores the button's own label after a moment, whichever message it is showing. */
function flash(button: HTMLElement, message: string, milliseconds: number): void {
  const original = copyLabels.get(button) ?? button.textContent ?? "";
  copyLabels.set(button, original);
  button.textContent = message;

  clearTimeout(copyTimers.get(button));
  copyTimers.set(
    button,
    setTimeout(() => {
      button.textContent = original;
      copyLabels.delete(button);
    }, milliseconds),
  );
}

function copy(button: HTMLElement): void {
  navigator.clipboard.writeText(button.getAttribute("data-copy") ?? "").then(
    () => {
      flash(button, "Copied", COPIED_MS);
      const live = document.getElementById("live-region");
      if (live) live.textContent = "Copied to clipboard";
    },
    // Clipboard access rejects on insecure origins (any non-localhost host) and when permission
    // is denied. Without this the button silently does nothing at all.
    () => flash(button, "Press Ctrl+C", FALLBACK_MS),
  );
}

// The theme toggle's pressed state is set here rather than in the markup: the served HTML carries
// no theme, so the button cannot know which way it points until theme-init has read the stored
// preference.
document
  .querySelector("[data-theme-toggle]")
  ?.setAttribute("aria-pressed", String(currentTheme() === "light"));

document.addEventListener("click", (event) => {
  const target = event.target as Element | null;
  if (!target?.closest) return;

  if (target.closest("[data-theme-toggle]")) {
    setTheme(currentTheme() === "dark" ? "light" : "dark");
    return;
  }
  if (target.closest("[data-search-open]")) {
    event.preventDefault();
    void openSearch();
    return;
  }
  const copyButton = target.closest<HTMLElement>("[data-copy]");
  if (copyButton) copy(copyButton);
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "k") {
    event.preventDefault();
    void openSearch();
  }
});
