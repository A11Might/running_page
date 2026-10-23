"""One-off repair: rebuild start_date_local from start_date (UTC).

The strava_web sync had a double-timezone-conversion bug: local times were
stored as UTC+16h (e.g. a 19:49 evening run saved as 03:49 next day). Records
synced via the OAuth API were unaffected. This script recomputes every row as
BASE_TIMEZONE wall-clock time and reports what changed.
"""

import datetime
import sys

import pytz
from config import BASE_TIMEZONE, SQL_FILE
from generator.db import Activity, init_db


def main():
    local_tz = pytz.timezone(BASE_TIMEZONE)
    session = init_db(SQL_FILE)
    fixed = 0
    already = 0
    unparsable = 0
    for act in session.query(Activity).all():
        raw = act.start_date or ""
        try:
            utc_dt = datetime.datetime.strptime(
                raw.replace("T", " ").split("+")[0].strip(),
                "%Y-%m-%d %H:%M:%S",
            ).replace(tzinfo=datetime.UTC)
        except ValueError:
            unparsable += 1
            continue
        correct = utc_dt.astimezone(local_tz).strftime("%Y-%m-%d %H:%M:%S")
        if act.start_date_local == correct:
            already += 1
            continue
        print(f"fix {act.run_id} {act.type}: {act.start_date_local} -> {correct}")
        act.start_date_local = correct
        fixed += 1
    session.commit()
    print(f"\ndone: {fixed} fixed, {already} already correct, {unparsable} unparsable")
    if fixed and "--regen" in sys.argv:
        from config import JSON_FILE
        from generator import Generator

        gen = Generator(SQL_FILE)
        activities_list = gen.load(include_zero_distance=True)
        with open(JSON_FILE, "w") as f:
            import json

            json.dump(activities_list, f, indent=0)
        print(f"regenerated {JSON_FILE} with {len(activities_list)} activities")


if __name__ == "__main__":
    main()
