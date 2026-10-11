import hashlib
import re
from uuid import uuid4

import httpx
from fastapi import HTTPException
from psycopg.types.json import Jsonb

from app.db import one
from app.domain import SEED_USERS, user_activity

# Public stock voice identifiers, not credentials or cloned voices.
STOCK_VOICES = [
    "JBFqnCBsd6RMkjVDRZzb",
    "pNInz6obpgDQGcFmaJgB",
    "EXAVITQu4vr4xnSDxMaL",
    "21m00Tcm4TlvDq8ikWAM",
    "TxGEqnHWrfWFTfGW9XjX",
]

SCENE_GREETINGS = {
    "checkin": "What did I do today?",
    "mayor": "What's on your mind, neighbor?",
}


async def scene_greeting(conn, settings, user, kind):
    """One fixed line per speaker, requested by a scene-opening gesture; never a loop."""
    if kind not in SCENE_GREETINGS:
        raise HTTPException(404, "Unknown scene")
    if not settings.elevenlabs_api_key:
        return {"audio_url": None}
    # Serialize rapid/repeated opens, including multiple browser tabs.
    speaker = await one(conn, "SELECT * FROM users WHERE id=%s FOR UPDATE", (user["id"],))
    if kind == "checkin" and not (speaker.get("voice_id") and speaker.get("voice_consent")):
        return {"audio_url": None}
    if kind == "mayor" and not settings.mayor_voice:
        return {"audio_url": None}
    text = SCENE_GREETINGS[kind]
    line = await one(
        conn,
        "SELECT audio_key FROM voice_lines WHERE user_id=%s AND text=%s "
        "AND audio_key IS NOT NULL AND (%s::timestamptz IS NULL OR created_at >= %s) "
        "ORDER BY created_at DESC LIMIT 1",
        (
            speaker["id"],
            text,
            speaker.get("voice_consent_at") if kind == "checkin" else None,
            speaker.get("voice_consent_at") if kind == "checkin" else None,
        ),
    )
    if line:
        return {"audio_url": f"/api/assets/{line['audio_key']}"}
    try:
        return await create_line(
            conn, settings, speaker, text, stock=kind == "mayor", require_head=True
        )
    except HTTPException as exc:
        if exc.status_code in {502, 503}:
            return {"audio_url": None}
        raise


def voice_id(user):
    if user.get("voice_id") and user.get("voice_consent"):
        return user["voice_id"]
    slot = next((n for n, (uid, _, _) in enumerate(SEED_USERS) if uid == user["id"]), 0)
    return STOCK_VOICES[slot]


async def synthesize(settings, user, text):
    if not settings.elevenlabs_api_key:
        raise HTTPException(503, "Voice is not configured")
    from app.security import charge

    charge(settings, "elevenlabs")
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            response = await client.post(
                f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id(user)}",
                params={"output_format": "mp3_44100_128"},
                headers={"xi-api-key": settings.elevenlabs_api_key, "Accept": "audio/mpeg"},
                json={"text": text, "model_id": "eleven_flash_v2_5"},
            )
            response.raise_for_status()
            if not response.content or "audio/" not in response.headers.get("content-type", ""):
                raise ValueError("Invalid audio response")
            return response.content
    except (httpx.HTTPError, ValueError):
        raise HTTPException(502, "Voice provider unavailable") from None


async def create_line(
    conn, settings, user, text, *, stock=False, expr_user=None, require_head=False
):
    speaker = {**user, "voice_id": STOCK_VOICES[0], "voice_consent": True} if stock else user
    audio = await synthesize(settings, speaker, text)
    line_id = uuid4()
    key = f"voice/{user['id']}/{line_id}.mp3"
    path = settings.asset_dir / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(audio)
    try:
        await conn.execute(
            """INSERT INTO voice_lines (id,user_id,text,audio_key)
            VALUES (%s,%s,%s,%s)""",
            (line_id, user["id"], text, key),
        )
        target = expr_user or user
        manifest = await one(
            conn,
            "SELECT manifest FROM avatar_assets WHERE user_id=%s ORDER BY revision DESC LIMIT 1",
            (target["id"],),
        )
        has_head = manifest and manifest["manifest"].get("portrait", {}).get("kind") == "lam_head"
        job_id = None
        if not require_head or has_head:
            from app.security import charge

            charge(settings, "gpu")
            idem = hashlib.sha256(f"{target['id']}:{key}:voice_expr:a2e:v1".encode()).hexdigest()
            job = await one(
                conn,
                """INSERT INTO avatar_jobs(user_id,stage,idem_key,input)
                VALUES (%s,'voice_expr',%s,%s) RETURNING id""",
                (
                    target["id"],
                    idem,
                    Jsonb(
                        {"audio_key": key, "line_id": str(line_id), "user_id": str(target["id"])}
                    ),
                ),
            )
            job_id = job["id"]
            await conn.execute("UPDATE voice_lines SET job_id=%s WHERE id=%s", (job_id, line_id))
        await user_activity(conn, user["id"], "voice_line", {"line_id": str(line_id)})
    except Exception:
        path.unlink(missing_ok=True)
        raise
    return {"id": line_id, "audio_url": f"/api/assets/{key}", "expr_url": None, "job_id": job_id}


async def get_line(conn, line_id):
    row = await one(
        conn,
        """SELECT l.*,j.status,j.result FROM voice_lines l
        LEFT JOIN avatar_jobs j ON j.id=l.job_id WHERE l.id=%s""",
        (line_id,),
    )
    if not row:
        raise HTTPException(404, "Voice line not found")
    expr = (row["result"] or {}).get("expr_url") if row["status"] == "done" else None
    return {
        "id": row["id"],
        "user_id": row["user_id"],
        "audio_url": f"/api/assets/{row['audio_key']}" if row["audio_key"] else None,
        "expr_url": expr or (f"/api/assets/{row['expr_key']}" if row["expr_key"] else None),
        "job_id": row["job_id"],
    }


CONSENT_VERSION = "village-voice-v1"
CONSENT_TEXT = (
    "I confirm these recordings are my own voice and consent to ElevenLabs cloning it "
    "for AI-generated speech in Village, including speech requested by village friends."
)
MAX_MEMO = 10 * 1024 * 1024
AUDIO_TYPES = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/aac": "aac",
    "audio/ogg": "ogg",
    "audio/webm": "webm",
    "audio/flac": "flac",
}


async def clone(conn, settings, user, files, consent):
    try:
        if not consent:
            raise HTTPException(422, "Voice cloning consent required")
        if not 1 <= len(files) <= 3:
            raise HTTPException(422, "Upload one to three audio memos")
        samples = []
        for index, file in enumerate(files):
            mime = (file.content_type or "").split(";", 1)[0].lower()
            if mime not in AUDIO_TYPES:
                raise HTTPException(415, "Upload an audio memo")
            content = await file.read(MAX_MEMO + 1)
            if not content or len(content) > MAX_MEMO:
                raise HTTPException(413, "Each audio memo must be nonempty and at most 10 MiB")
            samples.append(("files", (f"memo-{index}.{AUDIO_TYPES[mime]}", content, mime)))
        current = await one(conn, "SELECT * FROM users WHERE id=%s FOR UPDATE", (user["id"],))
        if current["voice_id"]:
            raise HTTPException(409, "Delete the existing voice before creating another clone")
        if not settings.elevenlabs_api_key:
            raise HTTPException(503, "Voice is not configured")
        from app.security import charge

        charge(settings, "elevenlabs")
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.post(
                    "https://api.elevenlabs.io/v1/voices/add",
                    headers={"xi-api-key": settings.elevenlabs_api_key},
                    data={
                        "name": "Village \u2014 " + current["display_name"],
                        "remove_background_noise": "false",
                    },
                    files=samples,
                )
                response.raise_for_status()
                clone_id = response.json()["voice_id"]
                if not isinstance(clone_id, str) or not re.fullmatch(
                    r"[A-Za-z0-9_-]{1,128}", clone_id
                ):
                    raise ValueError("Invalid voice ID")
        except (httpx.HTTPError, ValueError, KeyError, TypeError):
            raise HTTPException(502, "Voice provider unavailable") from None
        return await one(
            conn,
            """UPDATE users SET voice_id=%s,voice_consent=true,
            voice_consent_at=now(),voice_consent_version=%s WHERE id=%s
            RETURNING voice_id,voice_consent,voice_consent_at,voice_consent_version""",
            (clone_id, CONSENT_VERSION, user["id"]),
        )
    finally:
        for file in files:
            await file.close()


async def delete_clone(conn, settings, user):
    current = await one(conn, "SELECT * FROM users WHERE id=%s FOR UPDATE", (user["id"],))
    if current["voice_id"] and current["voice_consent"]:
        if not settings.elevenlabs_api_key:
            raise HTTPException(503, "Voice is not configured")
        try:
            async with httpx.AsyncClient(timeout=25) as client:
                response = await client.delete(
                    f"https://api.elevenlabs.io/v1/voices/{current['voice_id']}",
                    headers={"xi-api-key": settings.elevenlabs_api_key},
                )
                if response.status_code != 404:
                    response.raise_for_status()
        except httpx.HTTPError:
            raise HTTPException(502, "Voice provider unavailable") from None
    await conn.execute(
        """UPDATE users SET voice_id=NULL,voice_consent=false,
        voice_consent_at=NULL,voice_consent_version=NULL WHERE id=%s""",
        (user["id"],),
    )
    return {
        "voice_id": None,
        "voice_consent": False,
        "voice_consent_at": None,
        "voice_consent_version": None,
    }
