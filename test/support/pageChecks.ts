import type { PageChecks } from "../../src/content/pageChecks.js";

/** Filler for a synthetic page in a test that is not about the replay figures. Here rather than
 *  in `src/`, because nothing the build does needs it. */
export const NO_CHECKS: PageChecks = { checked: 0, byShape: 0, exempt: 0, fixtures: 0 };
