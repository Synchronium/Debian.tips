import { EMPTY_HTML, html, raw, type Raw } from "../../html.js";

/** How many cards a listing or tag page shows before it splits.
 *
 *  A tag can accumulate every page on the site, so tag pages and the flat category listings
 *  are bounded. `/commands/` deliberately is not: its `COMMAND_GROUPS` sectioning *is* its
 *  navigation, and splitting an index across page boundaries makes a specific command harder to
 *  find rather than easier. When that index does grow too heavy the lever is a compact one-line
 *  listing rather than pagination, which keeps one URL to search. */
export const PAGE_SIZE = 24;

export interface PageSlice<T> {
  items: T[];
  /** 1-based. */
  number: number;
  total: number;
  /** Path of this slice: the bare listing path for slice 1, `<path>page/N/` after that. */
  path: string;
  prevPath?: string;
  nextPath?: string;
}

/** Splits `items` into the slices a listing publishes, one per emitted page. A set that fits on
 *  one page yields exactly one slice with no prev/next, so an unpaginated listing and a
 *  paginated one are the same code path. */
export function paginate<T>(items: T[], basePath: string, size: number = PAGE_SIZE): PageSlice<T>[] {
  const total = Math.max(1, Math.ceil(items.length / size));
  const pathFor = (number: number): string => (number === 1 ? basePath : `${basePath}page/${number}/`);

  return Array.from({ length: total }, (_unused, index) => {
    const number = index + 1;
    const slice: PageSlice<T> = {
      items: items.slice(index * size, (index + 1) * size),
      number,
      total,
      path: pathFor(number),
    };
    if (number > 1) slice.prevPath = pathFor(number - 1);
    if (number < total) slice.nextPath = pathFor(number + 1);
    return slice;
  });
}

/** The prev/next control under a split listing. Nothing is rendered for a listing that fits on
 *  one page: a lone "Page 1 of 1" is noise. */
export function paginationNav(slice: PageSlice<unknown>): Raw {
  if (slice.total < 2) return EMPTY_HTML;
  return html`<nav class="pager" aria-label="Pagination">
${slice.prevPath ? html`<a class="pager-prev" href="${slice.prevPath}">&larr; Previous</a>` : raw("<span></span>")}
<span class="pager-position">Page ${slice.number} of ${slice.total}</span>
${slice.nextPath ? html`<a class="pager-next" href="${slice.nextPath}">Next &rarr;</a>` : raw("<span></span>")}
</nav>`;
}
