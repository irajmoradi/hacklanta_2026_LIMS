"""Consent-gated group segmentation and serialized, self-service crop claims."""

import hashlib
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from psycopg.types.json import Jsonb
from pydantic import Field

from app.assets import asset_path, save_image
from app.auth import member, require_member
from app.db import connection, many, one
from app.domain import activity
from app.models import Input

router = APIRouter(prefix="/villages/{vid}/group-photo")


class Claim(Input):
    crop_id: str = Field(min_length=1, max_length=100, pattern=r"^[A-Za-z0-9_-]+$")


async def job_for(conn, vid, job_id, *, lock=False):
    row = await one(
        conn,
        """SELECT j.* FROM avatar_jobs j JOIN group_photos g ON g.job_id=j.id
        WHERE g.village_id=%s AND j.id=%s"""
        + (" FOR UPDATE OF j" if lock else ""),
        (vid, job_id),
    )
    if not row:
        raise HTTPException(404, "Group photo not found")
    return row


def crops_for(settings, vid, job):
    if job["status"] != "done":
        return []
    result = job.get("result") or {}
    crops = result.get("crops")
    if not isinstance(crops, list):
        raise HTTPException(409, "Worker needs group-photo protocol v1 support")
    output = []
    seen = set()
    # Worker result shape: docs/cv/cv005.md (face_url under villages/<vid>/group/<job>/).
    prefix = f"villages/{vid}/group/{job['id']}/"
    for crop in crops:
        try:
            cid = Claim(crop_id=crop["crop_id"]).crop_id
            key = crop.get("face_asset_key") or crop["face_url"].removeprefix("/api/assets/")
            if cid in seen or not isinstance(key, str) or not key.startswith(prefix):
                raise ValueError()
            asset_path(settings, key)
        except (KeyError, TypeError, ValueError, HTTPException):
            raise HTTPException(409, "Worker crop artifacts are missing or invalid") from None
        seen.add(cid)
        output.append({"crop_id": cid, "url": "/api/assets/" + key, "bbox": crop.get("box_xyxy")})
    return output


@router.post("")
async def upload(
    vid: UUID,
    request: Request,
    file: UploadFile = File(...),
    consent: bool = Form(False),
    user=Depends(member),
    conn=Depends(connection, scope="function"),
):
    membership = await require_member(conn, vid, user["id"])
    if membership["role"] != "owner":
        raise HTTPException(403, "Village owner required")
    if not consent:
        raise HTTPException(422, "Consent from everyone pictured is required")
    await conn.execute("SELECT id FROM villages WHERE id=%s FOR UPDATE", (vid,))
    settings = request.app.state.settings
    job_id = uuid4()
    prefix = f"group-photos/{vid}/{job_id}"
    key, digest = await save_image(settings, file, prefix)
    idem = hashlib.sha256(f"{vid}:{digest}:group:segment:v1".encode()).hexdigest()
    prior = await one(conn, "SELECT id FROM avatar_jobs WHERE idem_key=%s", (idem,))
    if prior:
        (settings.asset_dir / key).unlink(missing_ok=True)
        # A demo reset may have removed the village-scoped association, but retains jobs.
        await conn.execute(
            "INSERT INTO group_photos(job_id,village_id) VALUES (%s,%s) ON CONFLICT DO NOTHING",
            (prior["id"], vid),
        )
        return {"job_id": prior["id"]}
    try:
        from app.security import charge

        charge(settings, "gpu")
        await conn.execute(
            """INSERT INTO avatar_jobs(id,user_id,stage,idem_key,input)
            VALUES (%s,%s,'segment',%s,%s)""",
            (
                job_id,
                user["id"],
                idem,
                Jsonb(
                    {
                        "asset_key": key,
                        "photo_asset_key": key,
                        "sha256": digest,
                        "user_id": str(user["id"]),
                        "village_id": str(vid),
                        "group_photo": True,
                        "protocol_version": 1,
                        "output_prefix": prefix,
                        "consent": True,
                        "auto_enqueue_head": False,
                    }
                ),
            ),
        )
        await conn.execute(
            "INSERT INTO group_photos(job_id,village_id) VALUES (%s,%s)", (job_id, vid)
        )
        await activity(conn, vid, user["id"], "group_photo_queued", {"job_id": str(job_id)})
    except Exception:
        (settings.asset_dir / key).unlink(missing_ok=True)
        raise
    return {"job_id": job_id}


@router.get("/{job_id}")
async def status(
    vid: UUID,
    job_id: UUID,
    request: Request,
    user=Depends(member),
    conn=Depends(connection, scope="function"),
):
    job = await job_for(conn, vid, job_id)
    claims = {
        r["crop_id"]: r["user_id"]
        for r in await many(
            conn, "SELECT crop_id,user_id FROM group_photo_claims WHERE job_id=%s", (job_id,)
        )
    }
    crops = crops_for(request.app.state.settings, vid, job)
    return {
        "job_id": job_id,
        "status": job["status"],
        "error": "Group photo processing failed" if job["status"] == "failed" else None,
        "crops": [dict(c, claimed_by=claims.get(c["crop_id"])) for c in crops],
    }


@router.post("/{job_id}/claim")
async def claim(
    vid: UUID,
    job_id: UUID,
    data: Claim,
    request: Request,
    user=Depends(member),
    conn=Depends(connection, scope="function"),
):
    job = await job_for(conn, vid, job_id, lock=True)
    uid = user["id"]
    prior = await one(
        conn,
        """SELECT * FROM group_photo_claims WHERE job_id=%s
        AND (crop_id=%s OR user_id=%s)""",
        (job_id, data.crop_id, uid),
    )
    if prior:
        if prior["user_id"] == uid and prior["crop_id"] == data.crop_id:
            return {"crop_id": data.crop_id, "user_id": uid, "job_id": prior["head_job_id"]}
        raise HTTPException(409, "Crop or member already claimed")
    if job["status"] != "done":
        raise HTTPException(409, "Segmentation is not ready")
    settings = request.app.state.settings
    crop = next((c for c in crops_for(settings, vid, job) if c["crop_id"] == data.crop_id), None)
    if crop is None:
        raise HTTPException(404, "Crop not found")
    # The current head/body bridge expects a canonical PNG face for each user.
    await conn.execute("SELECT id FROM users WHERE id=%s FOR UPDATE", (uid,))
    if await one(
        conn,
        """SELECT 1 FROM avatar_jobs WHERE user_id=%s
        AND stage IN ('segment','head','body') AND status IN ('queued','running')
        AND NOT COALESCE((input->>'group_photo')::boolean,false)""",
        (uid,),
    ):
        raise HTTPException(409, "An avatar pipeline is already in progress")
    # The bridge copies the claimed crop into avatars/<uid>/, writes the manifest and chains
    # head -> body itself (docs/cv/cv005.md section 2); the API only enqueues a claim job.
    from app.security import charge

    charge(settings, "gpu", count=2)  # claimed crop -> head -> body
    head = await one(
        conn,
        """INSERT INTO avatar_jobs(user_id,stage,idem_key,input)
        VALUES (%s,'segment',%s,%s) RETURNING id""",
        (
            uid,
            hashlib.sha256(f"{uid}:{job_id}:{data.crop_id}:claim:v1".encode()).hexdigest(),
            Jsonb(
                {
                    "group_job_id": str(job_id),
                    "crop_id": data.crop_id,
                    "village_id": str(vid),
                    "user_id": str(uid),
                    "consent": True,
                }
            ),
        ),
    )
    await conn.execute(
        "INSERT INTO group_photo_claims(job_id,crop_id,user_id,head_job_id) VALUES (%s,%s,%s,%s)",
        (job_id, data.crop_id, uid, head["id"]),
    )
    await activity(
        conn, vid, uid, "group_photo_claimed", {"job_id": str(job_id), "crop_id": data.crop_id}
    )
    return {"crop_id": data.crop_id, "user_id": uid, "job_id": head["id"]}
