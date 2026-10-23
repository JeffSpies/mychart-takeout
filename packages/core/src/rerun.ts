/**
 * Partial re-runs (CLI `--only PHASE` into an existing export dir).
 *
 * A re-run of one phase must leave the rest of the export intact:
 *  - some phases read a file ANOTHER phase writes (documents and flowsheets
 *    read lists the structured phase saved) — when that phase isn't running,
 *    the driver seeds those files from the existing export (`phaseInputs`);
 *  - the run manifest must still describe the WHOLE export, so the re-run's
 *    rows replace only the re-run phases' rows (`mergeManifest`).
 */
import { FLOWSHEETS_REL, OTHER_DOCUMENTS_LIST_KEY, type PhaseName } from "./phases/index";
import type { ManifestEntry } from "./types";

/** Store files a phase reads that another phase writes. */
const INPUTS: Partial<Record<PhaseName, { rel: string; from: PhaseName }[]>> = {
  documents: [{ rel: OTHER_DOCUMENTS_LIST_KEY, from: "structured" }],
  flowsheets: [{ rel: FLOWSHEETS_REL, from: "structured" }],
};

/** Inputs the active phases need from phases that are NOT running this time. */
export function phaseInputs(active: ReadonlySet<string>): { phase: PhaseName; rel: string; from: PhaseName }[] {
  const out: { phase: PhaseName; rel: string; from: PhaseName }[] = [];
  for (const [phase, inputs] of Object.entries(INPUTS) as [PhaseName, { rel: string; from: PhaseName }[]][]) {
    if (!active.has(phase)) continue;
    for (const i of inputs) if (!active.has(i.from)) out.push({ phase, ...i });
  }
  return out;
}

/**
 * The prior manifest with the re-run phases' rows replaced by this run's.
 * Rows are matched by their `phase` tag (ctx.phase); returns null when the
 * prior manifest has untagged rows (an export from before tagging), since
 * there is then no safe way to tell which rows to replace.
 */
export function mergeManifest(
  prior: ManifestEntry[],
  fresh: ManifestEntry[],
  rerun: ReadonlySet<string>,
): ManifestEntry[] | null {
  if (prior.some((e) => typeof e.phase !== "string")) return null;
  // Fresh rows go where the replaced rows were, so the manifest keeps run order.
  const at = prior.findIndex((e) => rerun.has(e.phase as string));
  const kept = (rows: ManifestEntry[]) => rows.filter((e) => !rerun.has(e.phase as string));
  if (at < 0) return [...prior, ...fresh];
  return [...kept(prior.slice(0, at)), ...fresh, ...kept(prior.slice(at))];
}
