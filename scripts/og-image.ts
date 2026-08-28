// Draws public/og-default.png, the card social media shows when a page is shared.
//
//   npm run og
//
// Run by hand, not by the build. The output is a committed binary, so regenerating it on every
// build would put a new PNG in every diff whether or not the design had moved.
//
// The card is rendered against `styles/site.css` itself, with the real webfont inlined, rather
// than against a copy of the palette. That is the whole point of doing it in a browser: the
// previous card was drawn once and then the site was redesigned around it, leaving a share image
// with a wordmark, a typeface and a background colour the site no longer used. Anything this
// script hardcodes can drift the same way, so it hardcodes layout and nothing else.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer";
import { SITE } from "../src/config.js";
import { FONT_HREF, FONT_SOURCE, OG_IMAGE_FILE, PUBLIC_DIR, STYLES_DIR } from "../src/paths.js";

/** What Facebook, LinkedIn, Slack and X all crop to. Twice this in device pixels, so the card
 *  stays sharp on the displays that ask for it, which is still the 1200x630 image every one of
 *  those platforms documents. */
const CARD = { width: 1200, height: 630 } as const;
const SCALE = 2;

/** The stylesheet asks for the font by an absolute URL that only exists on the served site, so
 *  the file is read from where the build takes it and substituted in as data. */
function styleSheet(): string {
  const css = readFileSync(join(STYLES_DIR, "site.css"), "utf-8");
  const font = readFileSync(FONT_SOURCE).toString("base64");
  return css.replace(`url("${FONT_HREF}")`, `url("data:font/woff2;base64,${font}")`);
}

/** Layout only. Every colour, typeface and radius comes from the stylesheet above, and the
 *  class names are the site's own, so the wordmark here is the wordmark in the header. */
const CARD_CSS = `
  html { width: ${CARD.width}px; height: ${CARD.height}px; }
  body { margin: 0; width: 100%; height: 100%; display: flex; }
  .og {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--space-7);
    padding: 0 var(--space-9);
    background: var(--bg);
  }
  .og .logo { font-size: 30px; }
  .og h1 {
    font-family: var(--font-display);
    font-size: 88px;
    line-height: 1.04;
    letter-spacing: -0.02em;
    max-width: 14ch;
    margin: 0;
  }
  /* The hero's rule, at the hero's proportions. It is the one piece of ornament on the homepage,
     so it is the piece that makes the card recognisable as the same site. */
  .og h1::after {
    content: "";
    display: block;
    width: 72px;
    height: 5px;
    border-radius: 3px;
    background: var(--accent);
    margin-top: var(--space-6);
  }
  .og p { margin: 0; }
  .og-lede { color: var(--text-muted); font-size: 34px; line-height: 1.4; max-width: 40ch; }
`;

/** `data-theme` rather than a media emulation, because it is the site's own switch: the toggle
 *  and `theme-init.ts` set the same attribute, and every `light-dark()` token resolves from it. */
function cardHtml(): string {
  return `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8" />
<style>${styleSheet()}</style><style>${CARD_CSS}</style></head>
<body><div class="og">
<p class="logo"><span class="logo-glyph">&gt;_</span>debian<span class="accent">.tips</span></p>
<h1>${SITE.headline}</h1>
<p class="og-lede">${SITE.promise}</p>
</div></body></html>`;
}

const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ ...CARD, deviceScaleFactor: SCALE });
  await page.setContent(cardHtml(), { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ type: "png" });
  const out = join(PUBLIC_DIR, OG_IMAGE_FILE);
  writeFileSync(out, png);
  console.log(`wrote ${out} at ${CARD.width * SCALE}x${CARD.height * SCALE}`);
} finally {
  await browser.close();
}
