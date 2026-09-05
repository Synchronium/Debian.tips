import { html, raw, type Raw } from "../../html.js";

/** The homepage topic icons, as one inline SVG sprite.
 *
 *  Inline and hand-written rather than an icon library or a font: a glyph per topic is about a
 *  kilobyte of path data, against a request and a dependency for anything off the shelf. They
 *  are drawn on a 24-unit grid in `currentColor` strokes so a single CSS rule sizes and colours
 *  every one of them, in both themes.
 *
 *  The sprite is emitted by the homepage rather than the layout, because the homepage is the
 *  only page that uses it and every other page would be carrying it for nothing. */
const ICON_PATHS = {
  package: '<path d="M21 8.5 12 3.5 3 8.5v7l9 5 9-5z"/><path d="M3 8.5l9 5 9-5"/><path d="M12 13.5v7"/>',
  sliders:
    '<path d="M4 8h6M14 8h6M4 16h10M18 16h2"/><circle cx="12" cy="8" r="2"/><circle cx="16" cy="16" r="2"/>',
  text: '<path d="M4 7h16M4 12h10M4 17h14"/>',
  folder: '<path d="M3 7.5a2 2 0 0 1 2-2h3.5l2 2H19a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.4-4.4"/>',
  wifi: '<path d="M4.5 11.5a11 11 0 0 1 15 0"/><path d="M8 15a6 6 0 0 1 8 0"/><path d="M12 18.5h.01"/>',
  activity: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
  terminal: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M7.5 9.5l3 2.5-3 2.5M13 15h3.5"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="9.5" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
} as const;
export type IconName = keyof typeof ICON_PATHS;

/** `IconName` is what makes a typo a type error at the point it is written, in `HOME_TOPICS`,
 *  rather than an empty box or a throw when the homepage renders. */
export function icon(name: IconName): Raw {
  return html`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#i-${name}" /></svg>`;
}

export function iconSprite(): Raw {
  const symbols = Object.entries(ICON_PATHS).map((entry) =>
    raw(`<symbol id="i-${entry[0]}" viewBox="0 0 24 24">${entry[1]}</symbol>`),
  );
  // Sized to nothing and taken out of flow rather than `display: none`, which stops `<use>`
  // resolving in some browsers. The stroke settings live here so each symbol is only path data.
  return html`<svg class="icon-sprite" width="0" height="0" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${symbols}</svg>`;
}
