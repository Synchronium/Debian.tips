import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    /** Several tests here walk the whole corpus: every `examples.yaml` parsed through the schema,
     *  every prose page's fences paired. That work is bounded by how much content exists, so it
     *  grows with the site, and vitest gives each test file an isolated worker, so the walks
     *  contend for one machine rather than taking turns. Under that contention a walk can pass the
     *  default five seconds and be killed, which reports as a broken test on whichever file lost
     *  the race and sends the next person looking for a defect in the content it was reading.
     *
     *  This is the ceiling for a test that has hung, not an allowance for a slow one. A corpus
     *  walk approaching it has become quadratic in the size of the site and wants fixing rather
     *  than more room. */
    testTimeout: 30_000,
  },
});
