"""WEB-032: remove QA check-ins only from the seeded demo village. Dry run by default."""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import psycopg  # noqa: E402
from psycopg.rows import dict_row  # noqa: E402

from app.config import Settings  # noqa: E402
from app.domain import VILLAGE_ID  # noqa: E402


def cleanup(conn, apply=False):
    village = conn.execute(
        "SELECT id,invite_code FROM villages WHERE id=%s FOR UPDATE", (VILLAGE_ID,)
    ).fetchone()
    if not village or village["invite_code"] != "HACKLANTA":
        raise RuntimeError("Refusing cleanup: seeded demo village identity does not match")
    rows = conn.execute(
        "SELECT id FROM check_ins WHERE village_id=%s AND ltrim(body) ILIKE 'QA-%%' FOR UPDATE",
        (VILLAGE_ID,),
    ).fetchall()
    ids = [r["id"] for r in rows]
    if not apply or not ids:
        return len(ids)
    # Polymorphic references are not cascaded by the database.
    events = conn.execute(
        """SELECT id FROM activity_events WHERE village_id=%s AND
        (payload->>'check_in_id'=ANY(%s) OR
         (type IN ('checkin','check_in','status') AND ltrim(payload->>'body') ILIKE 'QA-%%'))""",
        (VILLAGE_ID, [str(i) for i in ids]),
    ).fetchall()
    event_ids = [r["id"] for r in events]
    conn.execute(
        """DELETE FROM reactions WHERE village_id=%s AND
        ((target_kind='check_in' AND target_id=ANY(%s)) OR
         (target_kind='activity' AND target_id=ANY(%s)))""", (VILLAGE_ID, ids, event_ids)
    )
    conn.execute("DELETE FROM evidence_reviews WHERE check_in_id=ANY(%s)", (ids,))
    conn.execute("DELETE FROM check_in_keys WHERE check_in_id=ANY(%s)", (ids,))
    conn.execute(
        "DELETE FROM activity_events WHERE village_id=%s AND id=ANY(%s)",
        (VILLAGE_ID, event_ids),
    )
    conn.execute("DELETE FROM check_ins WHERE village_id=%s AND id=ANY(%s)", (VILLAGE_ID, ids))
    return len(ids)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    try:
        with psycopg.connect(Settings.from_env().database_url, row_factory=dict_row,
                             connect_timeout=5) as conn:
            count = cleanup(conn, args.apply)
        print(f"{count} demo QA check-ins {'deleted' if args.apply else 'matched (dry run)'}")
    except Exception as exc:
        # Connection exceptions can contain credentials; never print their contents.
        print(f"Cleanup failed ({type(exc).__name__}); no partial transaction committed.")
        sys.exit(1)
