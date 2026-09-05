const ESC: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESC[c]!);
}

/** Markup that is already safe to emit, and the only thing `html` will interpolate without
 *  escaping first.
 *
 *  A distinct class rather than a branded string on purpose: it cannot be produced by accident,
 *  and it cannot be produced by any of the string operations that would otherwise let untrusted
 *  text reach a page unescaped. */
export class Raw {
  constructor(public readonly value: string) {}
  /** So a `Raw` can be written or concatenated without reaching for `.value`. `render` below
   *  checks `instanceof Raw` before it stringifies anything, so this never becomes the path by
   *  which content skips escaping. */
  toString(): string {
    return this.value;
  }
}

/** Promotes a plain string to trusted markup.
 *
 *  Reserve it for HTML this module did not produce: rendered Markdown, Shiki's output, the icon
 *  sprite. `html` returns `Raw` already, so composing two templates needs nothing, and a `raw()`
 *  in the templates is now a signal that something external is being trusted rather than
 *  punctuation. */
export const raw = (s: string): Raw => new Raw(s);

/** What a partial returns when it has nothing to render: an empty related list, a series nav on a
 *  page that is not in a series. Named so those returns read as a decision rather than as a string
 *  that happens to be empty, and so the return type stays `Raw` rather than widening to
 *  `Raw | string`, which would put the wrapper back at every call site. */
export const EMPTY_HTML = new Raw("");

/** Tagged template: escapes every interpolated value unless it is already `Raw`.
 *  Arrays are joined with "". null/undefined/false render as "".
 *
 *  Returns `Raw`, so a template composes into another template directly and a nested one needs no
 *  wrapper. That is what leaves `raw` meaning something: every remaining call to it is a place
 *  where markup from outside these templates is being trusted. */
export function html(strings: TemplateStringsArray, ...values: unknown[]): Raw {
  let out = "";
  strings.forEach((str, i) => {
    out += str;
    if (i < values.length) out += render(values[i]);
  });
  return new Raw(out);
}

/** Joins trusted fragments with a literal separator.
 *
 *  An array interpolated into `html` is joined with nothing, which is what a list of `<li>` wants
 *  and not what a sentence does. `separator` is punctuation the template author writes, so it is
 *  emitted as given; anything a fragment carries was already escaped on its way into `Raw`.
 *
 *  Reach for this rather than `Array.join`, which stringifies each fragment and hands back a plain
 *  string. Interpolating that escapes the markup inside it. */
export function joinHtml(parts: readonly Raw[], separator: string): Raw {
  return new Raw(parts.map((part) => part.value).join(separator));
}

function render(v: unknown): string {
  if (v == null || v === false) return "";
  if (v instanceof Raw) return v.value;
  if (Array.isArray(v)) return v.map(render).join("");
  return escapeHtml(String(v));
}
