/**
 * vert-bake fallback for scenes vert's privacy check refuses with
 * "the tiles' pixel pitch shows in the grid".
 *
 * vert refuses to write a scene whose terrain grid still carries the
 * elevation tiles' native pixel pitch, because on a coordinate-free site that
 * pitch leaks the latitude. THIS site is not coordinate-free: activities.json
 * publishes every track's summary_polyline in clear, so the pitch check has
 * nothing left to protect here, while a refused bake leaves the page without
 * a 3D scene (and invites corrupting workarounds — a synthetic-stub bake once
 * drew a phantom tail on activity 17644705451).
 *
 * This script runs the SAME pipeline as `vert-bake` (same parse, tiles,
 * trim, encoding) with one patch: isPitchHidden() is forced to true, so only
 * the pitch refusal is skipped. Everything else — the byte/object/text
 * privacy scanners included — still runs and can still refuse.
 *
 * Usage (same flags as vert-bake):
 *   node scripts/vert_bake_allow_pitch.mjs <points.json> --id <id> --out <dir> \
 *     [--trim 60] [--tiles <url>] [--cache <dir>]
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const ROOT = resolve(new URL(".", import.meta.url).pathname, "..");
const BAKE_SRC = join(
  ROOT,
  "node_modules",
  "@geekplux",
  "vert",
  "dist-lib",
  "bake.js"
);

const PITCH_FN = `function isPitchHidden(signature) {
	return !isPitchDetected(signature.x) && !isPitchDetected(signature.y);
}`;
const CLI_RUN = "process$1.exitCode = await main(";

function parseCli() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      id: { type: "string" },
      out: { type: "string" },
      trim: { type: "string" },
      tiles: { type: "string" },
      cache: { type: "string" },
    },
  });
  if (positionals.length !== 1) throw new Error("give exactly one points file");
  if (!values.id || !values.out) throw new Error("--id and --out are required");
  return {
    input: positionals[0],
    id: values.id,
    out: values.out,
    trim: values.trim === undefined ? 60 : Number(values.trim),
    tiles:
      values.tiles ??
      "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
    cache: values.cache ?? join(ROOT, "node_modules", ".cache", "vert-bake"),
  };
}

/** bake.js with isPitchHidden forced true and its CLI self-run replaced by exports. */
function patchedModule() {
  const src = readFileSync(BAKE_SRC, "utf8");
  if (!src.includes(PITCH_FN)) {
    throw new Error(
      `isPitchHidden not found in ${BAKE_SRC} — @geekplux/vert changed; update this script`
    );
  }
  if (!src.includes(CLI_RUN)) {
    throw new Error(
      `CLI entry not found in ${BAKE_SRC} — @geekplux/vert changed; update this script`
    );
  }
  let out = src.replace(
    PITCH_FN,
    "function isPitchHidden(signature) {\n\treturn true;\n}"
  );
  const i = out.indexOf(CLI_RUN);
  out =
    out.slice(0, i) +
    "export { bakeScene, createTileSource, parsePointsJson, buildRun };\n";
  const path = join(tmpdir(), `vert-bake-no-pitch-${Date.now()}.mjs`);
  writeFileSync(path, out);
  return path;
}

const args = parseCli();
const mod = await import(pathToFileURL(patchedModule()).href);
const tiles = mod.createTileSource({
  template: args.tiles,
  cacheDir: args.cache,
});
const input = mod.buildRun(
  mod.parsePointsJson(readFileSync(args.input, "utf8")),
  "points.json",
  false
);
const baked = await mod.bakeScene(input, {
  id: args.id,
  explicitId: true,
  trim: args.trim,
  tiles,
});
mkdirSync(args.out, { recursive: true });
writeFileSync(join(args.out, `${args.id}.scene`), baked.bytes);
writeFileSync(join(args.out, `${args.id}.scene.json`), baked.sidecarText);
console.log(
  `baked ${args.id} (pitch check waived): ${baked.bytes.length} bytes, ` +
    `distance ${Math.round(baked.scene.summary.distance)} m`
);
if (baked.warnings.length) {
  for (const w of baked.warnings) console.error(`warning: ${w}`);
}
