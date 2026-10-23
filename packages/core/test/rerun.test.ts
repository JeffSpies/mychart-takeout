import { describe, expect, test } from "bun:test";
import { FLOWSHEETS_REL, OTHER_DOCUMENTS_LIST_KEY } from "../src/phases/index";
import { mergeManifest, phaseInputs } from "../src/rerun";
import type { ManifestEntry } from "../src/types";
import { FakeClient, makeTestCtx } from "./fixtures/harness";

const row = (phase: string | undefined, endpoint: string): ManifestEntry => ({
  domain: "d",
  endpoint,
  status: 200,
  bytes: 0,
  note: "",
  outcome: "ok",
  ...(phase ? { phase } : {}),
});

describe("phaseInputs", () => {
  test("documents and flowsheets alone need the structured phase's lists", () => {
    expect(phaseInputs(new Set(["documents", "flowsheets"]))).toEqual([
      { phase: "documents", rel: OTHER_DOCUMENTS_LIST_KEY, from: "structured" },
      { phase: "flowsheets", rel: FLOWSHEETS_REL, from: "structured" },
    ]);
  });
  test("nothing to seed when the producing phase runs too, or for self-contained phases", () => {
    expect(phaseInputs(new Set(["structured", "documents", "flowsheets"]))).toEqual([]);
    expect(phaseInputs(new Set(["visits", "messages", "ccda", "report"]))).toEqual([]);
  });
});

describe("mergeManifest", () => {
  const prior = [row("structured", "a"), row("visits", "v1"), row("visits", "v2"), row("ccda", "c-old")];

  test("replaces only the re-run phases' rows, in place", () => {
    const merged = mergeManifest(prior, [row("visits", "v-new")], new Set(["visits"]));
    expect(merged!.map((e) => e.endpoint)).toEqual(["a", "v-new", "c-old"]);
  });
  test("a phase new to the export is appended", () => {
    const merged = mergeManifest(prior, [row("documents", "doc")], new Set(["documents"]));
    expect(merged!.map((e) => e.endpoint)).toEqual(["a", "v1", "v2", "c-old", "doc"]);
  });
  test("a re-run that yields no rows still clears that phase's old rows", () => {
    const merged = mergeManifest(prior, [], new Set(["ccda"]));
    expect(merged!.map((e) => e.endpoint)).toEqual(["a", "v1", "v2"]);
  });
  test("untagged prior rows (older export) → null: no safe merge", () => {
    expect(mergeManifest([row(undefined, "x")], [row("ccda", "c")], new Set(["ccda"]))).toBeNull();
  });
});

describe("ctx.rec phase tag", () => {
  test("rows carry the phase the driver set, and none when unset", () => {
    const { ctx } = makeTestCtx(new FakeClient({}));
    ctx.rec("d", "before", { status: 200, body: "" });
    ctx.phase = "visits";
    ctx.rec("d", "during", { status: 200, body: "" });
    ctx.phase = undefined;
    expect(ctx.manifest[0]!.phase).toBeUndefined();
    expect(ctx.manifest[1]!.phase).toBe("visits");
  });
});
