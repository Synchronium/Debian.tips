// The always-loaded glue: theme toggle, copy buttons, and the search trigger. Inlined into every
// page by src/templates/layout.ts. It is small, and a request per page for this much would cost
// more than it saves.
//
// The search dialog's own wiring (and Pagefind itself) live in src/client/search.ts, compiled to
// /assets/search.js and fetched via dynamic import() only when the dialog is first opened, so
// Pagefind's JS/WASM bundle never loads for visitors who don't search.
//
// Anything this file and theme-init.ts both need is declared in src/client/shared.ts, which is
// prepended to both. Anything the *templates* decide reaches this file as a data- attribute
// instead; see the expand-all labels.
const COPIED_MS = 1500;
const FALLBACK_MS = 2000;

/** The timeout each copy button owns, so a second click restarts its own label rather than
 *  another button's. Kept beside the element rather than on it, because an expando on a DOM node is
 *  invisible to the type system and to anyone reading the markup. */
const copyTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
const copyLabels = new WeakMap<HTMLElement, string>();

function setTheme(theme: Theme): void {
  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  document.querySelector("[data-theme-toggle]")?.setAttribute("aria-pressed", String(theme === LIGHT));
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* storage disabled: the theme still applies to this page */
  }
}

function currentTheme(): Theme {
  return document.documentElement.getAttribute(THEME_ATTRIBUTE) === LIGHT ? LIGHT : DARK;
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

/** Expand or collapse every output on a command page at once, per page and per visit. Nothing
 *  is stored. A remembered preference could only be applied after first paint: `open` is DOM
 *  state no stylesheet can set, and the `<details>` elements do not exist yet while the head
 *  script runs. On a page with dozens of them that is a reflow, and following an `#example-3`
 *  link would land the reader somewhere else once the blocks above it opened.
 *
 *  The reason to want it is browser find: Firefox will not match text inside a closed
 *  `<details>` at all, and Chrome's behaviour is not consistent. Expand, then Ctrl+F.
 *
 *  Both labels come from the button's own attributes, written by src/templates/command.ts. */
function toggleOutputs(button: HTMLElement): void {
  const expand = button.getAttribute("aria-pressed") !== "true";
  for (const details of document.querySelectorAll<HTMLDetailsElement>("details.example-output")) {
    details.open = expand;
  }
  button.setAttribute("aria-pressed", String(expand));
  button.textContent = button.getAttribute(expand ? "data-collapse-label" : "data-expand-label") ?? "";

  const live = document.getElementById("live-region");
  if (live) live.textContent = expand ? "All output expanded" : "All output collapsed";
}

/** Filters a listing's rows against what has been typed, matching on the text the row already
 *  shows. Substring rather than fuzzy: on a page of command names, a reader typing "gr" means
 *  the ones containing "gr", and anything cleverer starts returning `chgrp` for `grep`.
 *
 *  A group heading whose rows have all been hidden is hidden with them, so `/commands/` does not
 *  leave a column of empty topic headings behind. `hidden` rather than a class, because it is
 *  exactly what the attribute means and it takes the rows out of the accessibility tree too. */
function filterListing(input: HTMLInputElement): void {
  const query = input.value.trim().toLowerCase();
  const rows = document.querySelectorAll<HTMLElement>(".row");
  let shown = 0;

  for (const row of rows) {
    const match = query === "" || (row.textContent ?? "").toLowerCase().includes(query);
    row.hidden = !match;
    if (match) shown += 1;
  }

  for (const group of document.querySelectorAll<HTMLElement>(".listing-group")) {
    group.hidden = group.querySelectorAll<HTMLElement>(".row:not([hidden])").length === 0;
  }

  const status = document.querySelector("[data-listing-filter-status]");
  if (status) {
    status.textContent =
      query === "" ? "" : `${shown} of ${rows.length} shown${shown === 0 ? ". Try a shorter search." : ""}`;
  }
  document.querySelector(".listing-empty")?.toggleAttribute("hidden", shown > 0);
}

// The theme toggle's pressed state is set here rather than in the markup: the served HTML carries
// no theme, so the button cannot know which way it points until theme-init has read the stored
// preference.
document.querySelector("[data-theme-toggle]")?.setAttribute("aria-pressed", String(currentTheme() === LIGHT));

document.addEventListener("click", (event) => {
  const target = event.target as Element | null;
  if (!target?.closest) return;

  if (target.closest("[data-theme-toggle]")) {
    setTheme(currentTheme() === DARK ? LIGHT : DARK);
    return;
  }
  if (target.closest("[data-search-open]")) {
    event.preventDefault();
    void openSearch();
    return;
  }
  const outputToggle = target.closest<HTMLElement>("[data-toggle-outputs]");
  if (outputToggle) {
    toggleOutputs(outputToggle);
    return;
  }
  const copyButton = target.closest<HTMLElement>("[data-copy]");
  if (copyButton) copy(copyButton);
});

document.addEventListener("input", (event) => {
  const filter = (event.target as Element | null)?.closest<HTMLInputElement>("[data-listing-filter]");
  if (filter) filterListing(filter);
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "k") {
    event.preventDefault();
    void openSearch();
  }
});
