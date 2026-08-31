import { writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SANDBOX_FLAVOUR, isPrivileged, readSetupDirectives } from "../scripts/lib/replayMetadata.js";
import { hasSysAdmin } from "../scripts/lib/sandbox.js";

/* A page declares the sandbox it needs and the runner starts that one. Get the mapping wrong in
 * the weak direction and the page replays somewhere it cannot mount anything, which reports as
 * every figure being missing: it reads as a page that has drifted rather than as a container
 * started without the capabilities. Get it wrong in the strong direction and every page pays for
 * `--privileged` it never asked for. */

function setupScript(body: string): string {
  const path = join(mkdtempSync(join(tmpdir(), "flavour-")), "setup.sh");
  writeFileSync(path, body);
  return path;
}

describe("the sandbox a setup script asks for", () => {
  it("is the default when nothing is declared", () => {
    expect(readSetupDirectives(setupScript("#!/usr/bin/env bash\nmkdir -p x\n")).flavour).toBe(
      SANDBOX_FLAVOUR.default,
    );
  });

  it("is privileged when the script asks to mount something", () => {
    expect(readSetupDirectives(setupScript("# verify: --privileged\n")).flavour).toBe(
      SANDBOX_FLAVOUR.privileged,
    );
  });

  it("is systemd when the script asks for PID 1", () => {
    expect(readSetupDirectives(setupScript("# verify: --systemd\n")).flavour).toBe(SANDBOX_FLAVOUR.systemd);
  });

  it("is systemd when a script asks for both, whichever order they are written in", () => {
    // systemd is booted `--privileged`, so it satisfies both. Picking the one named last instead
    // would make the sandbox depend on the order of two lines that do not conflict.
    for (const body of [
      "# verify: --privileged\n# verify: --systemd\n",
      "# verify: --systemd --privileged\n",
    ]) {
      expect(readSetupDirectives(setupScript(body)).flavour).toBe(SANDBOX_FLAVOUR.systemd);
    }
  });

  it("still reads --user alongside a flavour", () => {
    const directives = readSetupDirectives(setupScript("# verify: --user --privileged\n"));
    expect(directives).toEqual({ asUser: true, flavour: SANDBOX_FLAVOUR.privileged });
  });

  it("rejects a directive nothing understands", () => {
    expect(() => readSetupDirectives(setupScript("# verify: --priviledged\n"))).toThrow(/unknown/);
  });
});

describe("which flavours can mount", () => {
  it("counts systemd as privileged, because it is booted that way", () => {
    expect(isPrivileged(SANDBOX_FLAVOUR.systemd)).toBe(true);
    expect(isPrivileged(SANDBOX_FLAVOUR.privileged)).toBe(true);
    expect(isPrivileged(SANDBOX_FLAVOUR.default)).toBe(false);
  });
});

describe("reading CAP_SYS_ADMIN out of a capability set", () => {
  // The values a real container reports: a `--privileged` one grants the lot, and the default
  // set Docker hands an unprivileged container has bit 21 clear.
  it("accepts the set a privileged container reports", () => {
    expect(hasSysAdmin("000001ffffffffff")).toBe(true);
  });

  it("rejects Docker's default set", () => {
    expect(hasSysAdmin("00000000a80425fb")).toBe(false);
  });

  it("tests one bit rather than the whole mask", () => {
    // Only bit 21, so a kernel that adds capabilities above it still reads as privileged and one
    // that grants everything except mounting does not.
    expect(hasSysAdmin((1n << 21n).toString(16))).toBe(true);
    expect(hasSysAdmin((~(1n << 21n) & ((1n << 40n) - 1n)).toString(16))).toBe(false);
  });

  it("treats anything that is not a hex number as unprivileged", () => {
    // `awk` printing nothing, because the field moved or the file could not be read. Refusing is
    // the safe direction: the page stops with a diagnostic instead of replaying somewhere it
    // cannot mount and reporting the fixtures as missing.
    for (const value of ["", "unknown", "0x40", "  "]) expect(hasSysAdmin(value)).toBe(false);
  });
});
