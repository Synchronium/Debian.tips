// Audits the editorial link graph: which pages the prose connects to which.
//
//   npm run audit:links                # defects in full, exits 1 if there are any
//   npm run audit:links -- --verbose   # also list the weakly-linked pages
//   npm run audit:links -- --advisory  # report only, always exits 0
//
// Part of `npm run check`, where the defects are the point and the advisory list would be
// twenty lines of noise on every run, hence --verbose, which is what the cross-link skill
// tells you to use.
//
// This is the opposite question to the one `src/linkcheck.ts` answers. Linkcheck asks
// whether every link that exists resolves; this asks whether the links that should exist
// do. A page nothing links to still builds, still validates and still appears on its
// category listing, so nothing else in `npm run check` has any opinion about it.
//
// Three things are reported:
//
//   orphaned        no other page links here, by `related:` or in prose
//   thin            fewer than MIN_OUTBOUND links out to other pages
//   weakly linked   reachable from exactly one other page
//
// The first two are defects and set the exit status; the third is advisory. Each is listed
// with the pages that could sensibly link to it, ranked by shared tags.
//
// What is deliberately not reported is one-way `related:`, meaning A lists B while B does not
// list A. The graph is hubs and spokes: `grep` and `exit-codes-and-error-handling` are
// linked from everywhere, and a related list reciprocating all of it would name half the
// site and help nobody. Asymmetry is the normal shape here, so flagging it is 50 rows of
// noise around the handful of pages that are genuinely hard to reach.
//
// Exit status: 0 when there are no orphans and no thin pages, 1 otherwise, 2 on a bad
// argument or a content error.
import { loadContent, type Page, isCommandPage } from "../src/content/loader.js";
import { STANDALONE_PAGES } from "../src/config.js";
import { EDGE_KIND, adjacency, affinity, collectEdges } from "./lib/linkGraph.js";

/** The style guide's floor: every page links at least this many others. */
const MIN_OUTBOUND = 2;

/** Below this many inbound links a page is reported as weakly linked. One route in means
 *  it is one page's edit away from being an orphan again. */
const MIN_INBOUND = 2;

/** How many candidate sources to suggest for a page that needs linking to. */
const SUGGESTIONS = 5;

/** Standalone pages are reached from the header and the homepage rather than from prose, so
 *  site chrome is their route in and an inbound prose link is a bonus. Taken from the same list
 *  the builder works from, so a new one is exempt the moment it exists. */
const CHROME_LINKED = new Set(STANDALONE_PAGES.map((page) => page.path));

/** Drafts are held to neither rule. A published page linking to one is a build error, so a
 *  draft can only ever be linked from another draft and would otherwise be reported as an
 *  orphan every time, which is an unfixable finding, and unfixable findings are the kind that
 *  get a whole report ignored. A draft is audited when it is published, which is when it matters. */
const auditable = (page: Page): boolean => !page.draft;

/** How a page is named in the report: `category/slug`, which is unique where a bare slug is
 *  no longer guaranteed to be. */
function name(page: Page): string {
  return `${page.category}/${page.slug}`;
}

function describe(page: Page): string {
  return `${name(page)}${isCommandPage(page) ? ` (${page.tier})` : ""}`;
}

async function main(): Promise<void> {
  const FLAGS = ["--advisory", "--verbose"];
  const args = process.argv.slice(2);
  const unknown = args.filter((arg) => !FLAGS.includes(arg));
  if (unknown.length) {
    console.error(`link-audit: unexpected argument ${unknown[0]} (accepts ${FLAGS.join(", ")})`);
    process.exit(2);
  }
  const advisory = args.includes("--advisory");
  const verbose = args.includes("--verbose");

  const { pages } = await loadContent();
  const edges = collectEdges(pages);
  const { outbound, inbound } = adjacency(pages, edges);

  /** The pages that could link to `page` and don't: sharing a tag is the cheapest proxy for
   *  "a reader of that page might want this one". Closest first.
   *
   *  Affinity is scored once per candidate rather than inside the comparator, which called it
   *  twice per comparison and re-intersected both tag lists each time. */
  const candidateSources = (page: Page): string[] =>
    pages
      .filter(
        (other) => other.url !== page.url && auditable(other) && !outbound.get(other.url)?.has(page.url),
      )
      .map((other) => ({ other, score: affinity(other, page) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, SUGGESTIONS)
      .map(({ other }) => name(other));

  const suggest = (page: Page, lead: string): string =>
    `    ${lead}: ${candidateSources(page).join(", ") || "nothing shares a tag"}`;

  /** Nodes are URLs; a report is easier to read as `category/slug`. */
  const nameByUrl = new Map(pages.map((page) => [page.url, name(page)]));
  const named = (urls: Iterable<string>): string[] => [...urls].map((url) => nameByUrl.get(url) ?? url);

  const audited = pages.filter(auditable);
  const inboundCount = (page: Page): number => inbound.get(page.url)?.size ?? 0;
  const linkable = audited.filter((page) => !CHROME_LINKED.has(page.url));

  const orphans = linkable.filter((page) => inboundCount(page) === 0);
  const weak = linkable.filter((page) => inboundCount(page) > 0 && inboundCount(page) < MIN_INBOUND);
  const thin = audited.filter((page) => (outbound.get(page.url)?.size ?? 0) < MIN_OUTBOUND);

  const proseEdges = edges.filter((edge) => edge.kind === EDGE_KIND.prose).length;
  const drafts = pages.length - audited.length;
  console.log(
    `${pages.length} pages, ${edges.length} links (${proseEdges} in prose)` +
      `${drafts ? `, ${drafts} draft(s) not audited` : ""}\n`,
  );

  if (orphans.length) {
    console.log(`orphaned, nothing links here (${orphans.length}):`);
    for (const page of orphans) {
      console.log(`  ${describe(page)}`);
      console.log(suggest(page, "could link from"));
    }
    console.log("");
  }

  if (thin.length) {
    console.log(`thin, fewer than ${MIN_OUTBOUND} links out (${thin.length}):`);
    for (const page of thin) {
      console.log(`  ${describe(page)} → ${named(outbound.get(page.url) ?? []).join(", ") || "nothing"}`);
    }
    console.log("");
  }

  if (weak.length && verbose) {
    console.log(`weakly linked, one way in (${weak.length}):`);
    for (const page of weak) {
      console.log(`  ${describe(page)} ← ${named(inbound.get(page.url) ?? []).join(", ")}`);
      console.log(suggest(page, "could also link from"));
    }
    console.log("");
  } else if (weak.length) {
    console.log(`${weak.length} page(s) are reachable from only one other; --verbose to list them.`);
  }

  const defects = orphans.length + thin.length;
  if (defects === 0) {
    console.log(`no orphans, every page links to at least ${MIN_OUTBOUND} others.`);
  } else {
    console.log(`${defects} page(s) need attention. See .claude/skills/cross-link-pages/SKILL.md`);
  }
  process.exit(defects === 0 || advisory ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
});
