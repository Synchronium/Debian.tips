// Declarations every client script gets, prepended by `clientScript` in src/templates/layout.ts.
//
// Each script under src/client/ is wrapped in its own IIFE and inlined separately — theme-init
// into <head>, interaction at the end of <body> — so neither can import from the other, and an
// `import` would survive the transform rather than resolve. Prepending is what lets a value be
// written once and used in both. `tsconfig.client.json` already typechecks this directory as one
// global scope, so a name declared here is visible to both files without any further ceremony.
//
// Keep it to things two scripts genuinely share: everything here is parsed on every page, and
// esbuild only drops what the script it was prepended to never mentions.

/** The theme vocabulary. theme-init.ts writes it before first paint, interaction.ts toggles it,
 *  and the `[data-theme]` rules in styles/site.css are the third reader — that one no JavaScript
 *  constant can unify, so the names here are the two halves that can be. */
const THEME_ATTRIBUTE = "data-theme";
const THEME_STORAGE_KEY = "theme";
const LIGHT = "light";
const DARK = "dark";
type Theme = typeof LIGHT | typeof DARK;
