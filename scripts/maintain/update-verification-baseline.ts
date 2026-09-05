// Rewrites the snapshot of what each page verifies.
//
// Run it after a change that legitimately moves those figures: a new page, examples added or
// removed, an exemption granted. Never run it to make a failing build pass: the test fails on a
// *reduction* precisely because a page can lose a check without anything else noticing, and
// regenerating in that state records the loss as the new normal.
//
// The diff is the review. One line per page, so what moved and by how much is readable.
import { writeFileSync } from "node:fs";
import { relative } from "node:path";
import { ROOT, VERIFICATION_BASELINE_FILE } from "../../src/paths.js";
import { verificationBaseline } from "../lib/verificationBaseline.js";

const baseline = await verificationBaseline();
writeFileSync(VERIFICATION_BASELINE_FILE, `${JSON.stringify(baseline, null, 2)}\n`);

const pages = Object.keys(baseline).length;
console.log(`Recorded ${pages} pages in ${relative(ROOT, VERIFICATION_BASELINE_FILE)}`);
console.log("Read the diff before committing: a figure that fell means a page checks less than it did.");
