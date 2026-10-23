import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mergeManifest, phaseInputs, type ExportStore, type ManifestEntry } from "@mychart/core";

/** One JSON file of an existing export dir, or undefined (absent/unparseable). */
export function readExportJson(outDir: string, rel: string): unknown {
  try {
    return JSON.parse(readFileSync(join(outDir, rel), "utf-8"));
  } catch {
    return undefined;
  }
}

/**
 * Partial run (`--only`): prime the store with the files the active phases
 * read from phases that aren't running, taken from the existing export.
 * Returns the inputs that weren't there (the caller says how to get them).
 */
export function seedPhaseInputs(
  store: ExportStore,
  outDir: string,
  active: ReadonlySet<string>,
): ReturnType<typeof phaseInputs> {
  const missing: ReturnType<typeof phaseInputs> = [];
  for (const input of phaseInputs(active)) {
    const v = readExportJson(outDir, input.rel);
    if (v === undefined) missing.push(input);
    else store.primeJson(input.rel, v);
  }
  return missing;
}

/**
 * Partial run: this run's manifest rows merged into the export's existing
 * `_manifest.json`, replacing only the re-run phases' rows. `merged` is false
 * when there was nothing to merge into, or the prior manifest predates phase
 * tags — then the manifest is this run's rows alone, as before.
 */
export function manifestForRerun(
  outDir: string,
  fresh: ManifestEntry[],
  rerun: ReadonlySet<string>,
): { manifest: ManifestEntry[]; merged: boolean; untagged: boolean } {
  const prior = readExportJson(outDir, "_manifest.json");
  if (!Array.isArray(prior)) return { manifest: fresh, merged: false, untagged: false };
  const merged = mergeManifest(prior as ManifestEntry[], fresh, rerun);
  return merged ? { manifest: merged, merged: true, untagged: false } : { manifest: fresh, merged: false, untagged: true };
}
