"""One synthetic ready photo object, restricted to the runner's disposable database."""

import os
import shutil
import sys
from pathlib import Path

import psycopg
from psycopg.conninfo import conninfo_to_dict

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "apps/api"))
from app.domain import SEED_USERS, VILLAGE_ID  # noqa: E402

dsn = os.environ["DATABASE_URL"]
if not conninfo_to_dict(dsn).get("dbname", "").startswith("run_"):
    raise RuntimeError("This fixture only runs in a disposable runner database")
owner = SEED_USERS[0][0]
job = "fe190000-0000-4000-8000-000000000001"
item = "fe190000-0000-4000-8000-000000000002"
relative = f"items/{owner}/{job}"
destination = Path(os.environ["ASSET_DIR"]) / relative
destination.mkdir(parents=True, exist_ok=True)
# Authored geometry and a material swatch, never a real person's photo.
shutil.copyfile(ROOT / "apps/web/public/models/community_hall.glb", destination / "object.glb")
shutil.copyfile(ROOT / "assets/materials/wood.png", destination / "preview.png")
with psycopg.connect(dsn) as conn:
    conn.execute(
        "UPDATE village_members SET house_level=4 WHERE village_id=%s AND user_id=%s",
        (VILLAGE_ID, owner),
    )
    conn.execute(
        "INSERT INTO avatar_jobs(id,user_id,stage,idem_key,input) "
        "VALUES(%s,%s,'segment',%s,'{}') ON CONFLICT DO NOTHING",
        (job, owner, "feat019-synthetic"),
    )
    conn.execute(
        "INSERT INTO custom_items(id,village_id,owner,kind,slot,glb_url,preview,source_job) "
        "VALUES(%s,%s,%s,'object','decoration',%s,%s,%s) ON CONFLICT DO NOTHING",
        (
            item,
            VILLAGE_ID,
            owner,
            f"/api/assets/{relative}/object.glb",
            f"/api/assets/{relative}/preview.png",
            job,
        ),
    )
print("Synthetic FEAT-019 photo object ready in scratch storage.")
