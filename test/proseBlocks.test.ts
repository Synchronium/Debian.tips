import { describe, expect, it } from "vitest";
import { parseProsePage } from "../src/content/proseBlocks.js";

/* The pairing rule decides which claims on a prose page get checked. A rule that pairs too
 * little leaves a claim unverified; one that pairs too much attributes an output to a
 * command that never produced it, and then reports the page as passing. */

const fence = (lang: string, body: string): string => "```" + lang + "\n" + body + "\n```";

describe("parseProsePage", () => {
  it("pairs a bash fence with the output fence directly beneath it", () => {
    const { pairs } = parseProsePage(`${fence("bash", "echo hi")}\n${fence("", "hi")}`);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.command).toBe("echo hi");
    expect(pairs[0]!.output).toBe("hi");
    expect(pairs[0]!.comparison).toBe("exact");
  });

  it("does not pair across intervening prose", () => {
    // The bug this rule exists for: a page ran `apt install -t backports golang-go`, then
    // explained itself, then showed the output of two *simulated* installs. Pairing on
    // document order attributed that block to the real command and called the page correct.
    const source = [
      fence("bash", "apt install golang-go"),
      "",
      "Simulating both:",
      "",
      fence("", "Inst golang-go"),
    ].join("\n");
    const { pairs, unpaired } = parseProsePage(source);
    expect(pairs).toHaveLength(0);
    expect(unpaired).toBe(1);
  });

  it("leaves a bash fence with no output alone", () => {
    // Most commands on a prose page make no claim about what they print.
    const { pairs, unpaired } = parseProsePage(`${fence("bash", "sudo apt update")}\n\nSome prose.`);
    expect(pairs).toHaveLength(0);
    expect(unpaired).toBe(0);
  });

  it("counts a config block as unpaired rather than as output", () => {
    // A .sources stanza is not something a command printed.
    const { pairs, unpaired } = parseProsePage(`Put this in the file:\n\n${fence("", "Types: deb")}`);
    expect(pairs).toHaveLength(0);
    expect(unpaired).toBe(1);
  });

  it("reads a shape directive and its note", () => {
    const source = `<!-- verify: shape the PID differs -->\n${fence("bash", "systemctl status ssh")}\n${fence("", "Main PID: 42")}`;
    const { pairs } = parseProsePage(source);
    expect(pairs[0]!.comparison).toBe("shape");
    expect(pairs[0]!.note).toBe("the PID differs");
  });

  it("reads a skip directive and its reason", () => {
    const source = `<!-- verify: skip needs a second terminal -->\n${fence("bash", "tail -f app.log")}\n${fence("", "line")}`;
    const { pairs } = parseProsePage(source);
    expect(pairs[0]!.comparison).toBe("skip");
    expect(pairs[0]!.note).toBe("needs a second terminal");
  });

  it("ignores a directive that is not directly above the fence", () => {
    const source = `<!-- verify: skip stale -->\n\n${fence("bash", "echo hi")}\n${fence("", "hi")}`;
    expect(parseProsePage(source).pairs[0]!.comparison).toBe("exact");
  });

  it("does not treat a tagged fence as command output", () => {
    // ```text or ```ini is explicitly not something a command printed.
    const { pairs } = parseProsePage(`${fence("bash", "echo hi")}\n${fence("text", "hi")}`);
    expect(pairs).toHaveLength(0);
  });

  it("keeps blank lines and leading padding inside an output block", () => {
    const { pairs } = parseProsePage(`${fence("bash", "wc -l a b")}\n${fence("", "  3 a\n\n  7 b")}`);
    expect(pairs[0]!.output).toBe("  3 a\n\n  7 b");
  });

  it("handles several pairs in one page", () => {
    const source = [
      fence("bash", "one"),
      fence("", "1"),
      "",
      "Prose between.",
      "",
      fence("bash", "two"),
      fence("", "2"),
    ].join("\n");
    const { pairs, unpaired } = parseProsePage(source);
    expect(pairs.map((p) => p.command)).toEqual(["one", "two"]);
    expect(unpaired).toBe(0);
  });
});

describe("fence info strings", () => {
  it("pairs a command fence that carries more than the language", () => {
    // `/^```(\S*)\s*$/` did not recognise this line as a fence at all, so it was read as
    // content and every open/close pairing after it on the page inverted. The page still
    // rendered, the replay reported "1 block not checkable", and nothing failed — verification
    // lost silently, which is the one thing this harness exists to prevent.
    const page = parseProsePage('```bash title="one"\necho hi\n```\n```\nhi\n```\n');
    expect(page.unpaired).toBe(0);
    expect(page.pairs).toHaveLength(1);
    expect(page.pairs[0]).toMatchObject({ command: "echo hi", output: "hi" });
  });

  it("does not let a fence line inside an output block close it", () => {
    // A closing fence carries no info string, so a line like ```bash inside an output block —
    // output that happens to contain Markdown — is content, not the end of the block.
    const page = parseProsePage("```bash\ncat post.md\n```\n```\n```bash x\nhi\n```\n");
    expect(page.pairs).toHaveLength(1);
    expect(page.pairs[0]?.output).toBe("```bash x\nhi");
  });
});
