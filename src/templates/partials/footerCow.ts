import { readFileSync } from "node:fs";
import { join } from "node:path";
import { html, raw } from "../../html.js";
import { ART_DIR, COW_ART_FILE } from "../../paths.js";

/** The footer's own line, and the only copy of it. It is spoken by the cow and repeated for
 *  assistive technology, which cannot read a picture made of punctuation — two renderings of one
 *  string, never two strings. */
const TAGLINE = "Made for the terminal-curious. Tested on Debian stable.";

/** Columns of text inside the balloon, before the frame. cowsay's own default is 40; this is
 *  narrower so the tagline breaks between its two sentences rather than mid-clause. */
const WRAP_COLUMNS = 34;

function wrap(text: string, columns: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line === "") line = word;
    else if (line.length + 1 + word.length <= columns) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line !== "") lines.push(line);
  return lines;
}

/** cowsay's balloon, to its rules: one line gets angle brackets, several get a drawn box with
 *  the corners leaning outwards. Built from the string rather than stored as art, so editing the
 *  tagline cannot leave the frame the wrong width. */
function balloon(text: string): string {
  const lines = wrap(text, WRAP_COLUMNS);
  const width = Math.max(...lines.map((line) => line.length));
  const pad = (line: string): string => line.padEnd(width, " ");

  const top = ` ${"_".repeat(width + 2)}`;
  const bottom = ` ${"-".repeat(width + 2)}`;
  const body =
    lines.length === 1
      ? [`< ${pad(lines[0] ?? "")} >`]
      : lines.map((line, index) => {
          const [left, right] =
            index === 0 ? ["/", "\\"] : index === lines.length - 1 ? ["\\", "/"] : ["|", "|"];
          return `${left} ${pad(line)} ${right}`;
        });

  // The tether, at cowsay's own indent. It lands over the cow's head because the art puts the
  // head in its first fifth — see src/art/holstein.py.
  return [top, ...body, bottom, "        \\", "         \\"].join("\n");
}

let artCache: string | undefined;
function cowArt(): string {
  artCache ??= readFileSync(join(ART_DIR, COW_ART_FILE), "utf-8").replace(/\n+$/, "");
  return artCache;
}

/** The foot of every page: the tagline, said by a cow.
 *
 *  Two elements at two sizes, which is the whole trick. The balloon is set large enough to read
 *  as words; the cow is set small enough that its characters read as tone rather than as text.
 *  `line-height: 0.6` on the art is what makes the cells square — a monospace advance is about
 *  0.6em, and unitless line-height tracks the font size, so the proportion holds at every size
 *  the stylesheet picks.
 *
 *  The whole drawing is `aria-hidden`: a screen reader given this announces several thousand
 *  punctuation marks. The tagline follows it as real text, positioned off-screen. */
export function footerCow(): string {
  return html`<div class="footer-cow">
<div class="cow-drawing" aria-hidden="true">
<pre class="cow-balloon">${balloon(TAGLINE)}</pre>
<pre class="cow-art">${cowArt()}</pre>
</div>
${raw(html`<p class="footer-tagline visually-hidden">${TAGLINE}</p>`)}
</div>`;
}
