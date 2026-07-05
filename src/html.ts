const ESC: Record<string, string> = {
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESC[c]!);
}

/** Marks a string as pre-escaped/trusted HTML. */
export class Raw {
  constructor(public readonly value: string) {}
}
export const raw = (s: string): Raw => new Raw(s);

/** Tagged template: escapes every interpolated value unless wrapped in raw().
 *  Arrays are joined with "". null/undefined/false render as "". */
export function html(strings: TemplateStringsArray, ...values: unknown[]): string {
  let out = "";
  strings.forEach((str, i) => {
    out += str;
    if (i < values.length) out += render(values[i]);
  });
  return out;
}

function render(v: unknown): string {
  if (v == null || v === false) return "";
  if (v instanceof Raw) return v.value;
  if (Array.isArray(v)) return v.map(render).join("");
  return escapeHtml(String(v));
}
