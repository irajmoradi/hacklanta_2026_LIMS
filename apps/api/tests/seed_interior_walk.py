"""Browser-test fixture; refuses all databases except the disposable runner DB."""
import os
import psycopg
from psycopg.conninfo import conninfo_to_dict

dsn = os.environ["DATABASE_URL"]
if not conninfo_to_dict(dsn).get("dbname", "").startswith("run_"):
    raise RuntimeError("Interior walking QA requires a disposable runner database")
with psycopg.connect(dsn) as conn:
    conn.execute(
        "UPDATE village_members SET house_level=4 WHERE user_id=%s",
        ("13370000-0000-4000-8000-000000000001",),
    )
