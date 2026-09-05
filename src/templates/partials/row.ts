import { html, raw, type Raw } from "../../html.js";
import { type Page, isCommandPage } from "../../content/loader.js";

/** One page in a list, as a full-width row: title, description, and a chevron drawn in CSS.
 *
 *  A row list is read in one dimension and costs the same to scan at eighty entries as at six,
 *  which is the length `/commands/` is heading for. A grid of cards is read in two, so a reader
 *  scanning for one name sweeps across as well as down, and the sweep gets longer as the site
 *  grows.
 *
 *  `level` must match whatever actually precedes the list in a given template: h3 when rows sit
 *  under a real h2 section heading (home sections, grouped command listings), h2 when they sit
 *  directly under the page's own h1 (tag pages, non-grouped category listings). Getting this
 *  wrong skips a heading level, which screen-reader users navigate by. */
export function pageRow(p: Page, level: "h2" | "h3" = "h3"): Raw {
  // A command page's title is something the reader will type, and is set in mono to say so.
  // Every other title is prose: `bulk-rename-files` is a slug, not a command.
  const mono = isCommandPage(p) ? " row-mono" : "";
  // The anchor wraps the description as well as the title, which is what makes the whole row the
  // target. Without a label that also makes the link's accessible name the whole row, so a screen
  // reader moving by link reads a sentence of description per entry, dozens of times down a
  // listing. `aria-label` rather than `aria-labelledby`, because the ids that would need is the
  // one thing a row cannot generate: the same page appears in two lists on the home page, so an
  // id derived from the page would be emitted twice in one document.
  return html`<li class="row${mono}"><a href="${p.url}" aria-label="${p.title}">
${raw(`<${level} class="row-title">`)}${p.title}${raw(`</${level}>`)}
<p class="row-desc">${p.description}</p>
</a></li>`;
}

/** Wraps rows in the list element they need. Every row on the site goes through here, so the
 *  markup a row assumes around it exists in one place rather than at each call site. */
export function rowList(pages: Page[], level: "h2" | "h3" = "h3"): Raw {
  return html`<ul class="row-list">${pages.map((p) => pageRow(p, level))}</ul>`;
}
