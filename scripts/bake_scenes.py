"""Bake vert 3D terrain scenes for every activity that has a GPS track.

For each activity in src/static/activities.json with a decodable
summary_polyline, writes a points JSON and runs `vert-bake` (from
@geekplux/vert) to produce public/scenes/<run_id>.scene. Scenes are
coordinate-free (height grid + local-metre route), so they are safe to
commit. Resumable: activities whose .scene already exists are skipped.

Usage:
    python3 scripts/bake_scenes.py [--jobs 4] [--force] [--only RUN_ID ...]
"""

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ACTIVITIES_JSON = ROOT / "src" / "static" / "activities.json"
SCENES_DIR = ROOT / "public" / "scenes"

MIN_POINTS = 10


def decode_polyline(encoded: str):
    """Google encoded polyline -> [(lat, lon), ...] (matches @mapbox/polyline)."""
    points = []
    index = lat = lng = 0
    while index < len(encoded):
        for result_index in (0, 1):
            shift = result = 0
            while True:
                byte = ord(encoded[index]) - 63
                index += 1
                result |= (byte & 0x1F) << shift
                shift += 5
                if byte < 0x20:
                    break
            value = ~(result >> 1) if result & 1 else result >> 1
            if result_index == 0:
                lat += value
            else:
                lng += value
        points.append((lat / 1e5, lng / 1e5))
    return points


def bake_one(args_tuple):
    run_id, points, force = args_tuple
    scene_path = SCENES_DIR / f"{run_id}.scene"
    if scene_path.exists() and not force:
        return run_id, "skip"
    with tempfile.NamedTemporaryFile(
        "w", suffix=".json", delete=False, dir=SCENES_DIR.parent / ".vert-tmp"
    ) as f:
        json.dump(
            {
                "points": [
                    {"lat": lat, "lon": lng} for lat, lng in points
                ]
            },
            f,
        )
        points_path = f.name
    try:
        proc = subprocess.run(
            [
                shutil.which("pnpm") or "pnpm",
                "exec",
                "vert-bake",
                points_path,
                "--id",
                str(run_id),
                "--out",
                str(SCENES_DIR),
                "--trim",
                "60",
                # 公共 AWS 地形瓦片（terrarium），比默认代理更稳
                "--tiles",
                "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
            ],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=300,
        )
        if proc.returncode == 0:
            return run_id, "ok"
        return run_id, f"fail: {(proc.stderr or proc.stdout).strip().splitlines()[-1] if (proc.stderr or proc.stdout).strip() else 'unknown'}"
    except subprocess.TimeoutExpired:
        return run_id, "fail: timeout"
    finally:
        Path(points_path).unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--jobs", type=int, default=4)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--only", type=int, nargs="*", default=None)
    options = parser.parse_args()

    activities = json.loads(ACTIVITIES_JSON.read_text())
    SCENES_DIR.mkdir(parents=True, exist_ok=True)
    (SCENES_DIR.parent / ".vert-tmp").mkdir(exist_ok=True)

    jobs = []
    for act in activities:
        if options.only and act["run_id"] not in options.only:
            continue
        encoded = act.get("summary_polyline") or ""
        if not encoded:
            continue
        try:
            points = decode_polyline(encoded)
        except Exception as e:  # noqa: BLE001
            print(f"decode fail {act['run_id']}: {e}")
            continue
        if len(points) < MIN_POINTS:
            continue
        jobs.append((act["run_id"], points, options.force))

    print(f"baking {len(jobs)} scenes with {options.jobs} jobs ...")
    results = {"ok": 0, "skip": 0, "fail": 0}
    with ThreadPoolExecutor(max_workers=options.jobs) as pool:
        futures = [pool.submit(bake_one, job) for job in jobs]
        for i, future in enumerate(as_completed(futures), 1):
            run_id, status = future.result()
            results["ok" if status == "ok" else "skip" if status == "skip" else "fail"] += 1
            if status.startswith("fail"):
                print(f"  [{i}/{len(jobs)}] {run_id} {status}")
            elif i % 20 == 0:
                print(f"  [{i}/{len(jobs)}] done")

    shutil.rmtree(SCENES_DIR.parent / ".vert-tmp", ignore_errors=True)
    total = len(list(SCENES_DIR.glob("*.scene")))
    print(f"\ndone: {results['ok']} baked, {results['skip']} skipped, {results['fail']} failed; {total} scenes total")


if __name__ == "__main__":
    sys.exit(main())
