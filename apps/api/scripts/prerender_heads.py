"""Pre-render cached head speech for the demo (bounded, explicit, operator-run).

For each eligible speaker (voice_consent + voice_id + LAM head + face_512.png) and each line:
  1. head_speech_cache (heads.cache_key) -> voice_lines row: reused if already ready, else one
     ElevenLabs TTS call (voice.synthesize, cost-guarded) + a voice_expr job for the bridge (A2E).
  2. waits for the expression job, so the LAM head lip-syncs instantly in HeadStudio/profile.
  3. renders the chorus talk video on Modal (gpu_client.talk_video_modal) and writes the
     <audio>.chorus.json marker that chorus.clip_state() serves.
Everything is serialized (one GPU job at a time). Lines are fixed and vetted, so no LLM moderation
call is made. No user_activity rows (no feed spam), no messages, no phones. Never prints secrets.

  python scripts/prerender_heads.py            # dry run: eligibility + cache status, no spend
  python scripts/prerender_heads.py --go --max-tts 30
"""

import argparse
import asyncio
import hashlib
import json
import sys
import time
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from psycopg.types.json import Jsonb  # noqa: E402

from app import gpu_client, voice  # noqa: E402
from app.assets import asset_path  # noqa: E402
from app.config import Settings  # noqa: E402
from app.db import make_pool, many, one  # noqa: E402
from app.heads import PRESETS, cache_key  # noqa: E402

# Chip lines first (HeadStudio shows presets[0:4]), then demo lines (typed in "Make it your own").
DEMO_LINES = [
    "Welcome to the Village.",
    "Check in today or the town burns.",
    "The Mayor is watching your streak.",
    "Get your people together.",
]
LINES = PRESETS[:4] + DEMO_LINES
EXPR_WAIT_S = 60  # per line; a bridge restart re-claims stale jobs later, so a final pass re-checks


def marker_for(settings, audio_key):
    return asset_path(settings, audio_key).with_suffix(".chorus.json")


def video_ready(settings, audio_key):
    try:
        value = json.loads(marker_for(settings, audio_key).read_text())
        return bool(value.get("video_key")) and (settings.asset_dir / value["video_key"]).is_file()
    except (OSError, ValueError):
        return False


async def eligible(conn, settings, only):
    rows = await many(
        conn,
        """SELECT u.*, a.manifest FROM users u LEFT JOIN LATERAL (SELECT manifest FROM avatar_assets
        WHERE user_id=u.id ORDER BY revision DESC LIMIT 1) a ON true
        WHERE u.voice_consent AND u.voice_id IS NOT NULL AND u.voice_id<>'' ORDER BY u.display_name""",
    )
    people = []
    for row in rows:
        kind = ((row["manifest"] or {}).get("portrait") or {}).get("kind")
        face = (settings.asset_dir / "avatars" / str(row["id"]) / "face_512.png").is_file()
        ok = kind == "lam_head" and face and (not only or str(row["id"]) in only)
        print(f"  {row['display_name']:<12} {row['id']} head={kind} face={face} "
              f"friends_can_play={row['allow_voice_by_friends']} -> {'YES' if ok else 'skip'}")
        if ok:
            people.append(row)
    return people


async def ensure_line(conn, settings, speaker, text, budget):
    """-> (line_id, audio_key, job_id, tts_seconds or None when cached)."""
    key = cache_key(speaker, text)
    old = await one(conn, "SELECT * FROM head_speech_cache WHERE cache_key=%s", (key,))
    if old and old["status"] == "ready" and old["line_id"]:
        line = await one(conn, "SELECT * FROM voice_lines WHERE id=%s", (old["line_id"],))
        if line and line["audio_key"] and asset_path(settings, line["audio_key"]).is_file():
            return key, line["id"], line["audio_key"], line["job_id"], None
    if budget["tts"] >= budget["max"]:
        raise RuntimeError("TTS budget reached")
    await conn.execute(
        """INSERT INTO head_speech_cache(cache_key,speaker_id,status) VALUES (%s,%s,'pending')
        ON CONFLICT(cache_key) DO UPDATE SET status='pending',updated_at=now()""",
        (key, speaker["id"]),
    )
    await conn.commit()
    started = time.monotonic()
    budget["tts"] += 1  # counted before the call: a failure still spent an attempt
    try:
        audio = await voice.synthesize(settings, speaker, text)
        tts_s = time.monotonic() - started
        line_id = uuid4()
        audio_key = f"voice/{speaker['id']}/{line_id}.mp3"
        path = settings.asset_dir / audio_key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(audio)
        await conn.execute(
            "INSERT INTO voice_lines (id,user_id,text,audio_key) VALUES (%s,%s,%s,%s)",
            (line_id, speaker["id"], text, audio_key),
        )
        # Same idempotency key and input as voice.create_line, so the bridge treats it identically.
        idem = hashlib.sha256(f"{speaker['id']}:{audio_key}:voice_expr:a2e:v1".encode()).hexdigest()
        job = await one(
            conn,
            """INSERT INTO avatar_jobs(user_id,stage,idem_key,input)
            VALUES (%s,'voice_expr',%s,%s) RETURNING id""",
            (speaker["id"], idem, Jsonb({"audio_key": audio_key, "line_id": str(line_id),
                                         "user_id": str(speaker["id"])})),
        )
        await conn.execute("UPDATE voice_lines SET job_id=%s WHERE id=%s", (job["id"], line_id))
        await conn.execute(
            "UPDATE head_speech_cache SET status='ready',line_id=%s,updated_at=now() WHERE cache_key=%s",
            (line_id, key),
        )
        await conn.commit()
        return key, line_id, audio_key, job["id"], tts_s
    except Exception:
        await conn.rollback()
        await conn.execute("UPDATE head_speech_cache SET status='failed' WHERE cache_key=%s", (key,))
        await conn.commit()
        raise


async def wait_expr(conn, job_id, limit=EXPR_WAIT_S):
    if not job_id:
        return "none", 0.0
    started = time.monotonic()
    while True:
        row = await one(conn, "SELECT status FROM avatar_jobs WHERE id=%s", (job_id,))
        await conn.commit()
        status = row["status"] if row else "missing"
        if status in ("done", "failed", "missing") or time.monotonic() - started > limit:
            return status, time.monotonic() - started
        await asyncio.sleep(2)


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--go", action="store_true", help="spend: TTS + Modal (default: dry run)")
    parser.add_argument("--max-tts", type=int, default=30)
    parser.add_argument("--users", default="", help="comma-separated user ids (default: all eligible)")
    parser.add_argument("--no-video", action="store_true")
    parser.add_argument("--line", action="append", default=[], help="render only these lines (repeatable)")
    args = parser.parse_args()
    lines = args.line or LINES
    settings = Settings.from_env()
    only = {u.strip() for u in args.users.split(",") if u.strip()}
    pool = make_pool(settings)
    await pool.open()
    budget = {"tts": 0, "max": args.max_tts}
    report, usd = [], 0.0
    try:
        async with pool.connection() as conn:
            print("eligible speakers:")
            people = await eligible(conn, settings, only)
            await conn.commit()
            print(f"lines ({len(lines)}): {lines}")
            for text in lines:
                for speaker in people:
                    key = cache_key(speaker, text)
                    if not args.go:
                        row = await one(conn, "SELECT status,line_id FROM head_speech_cache WHERE cache_key=%s", (key,))
                        await conn.commit()
                        print(f"  plan {speaker['display_name']:<10} {key[:12]} cache={row and row['status']} | {text}")
                        continue
                    entry = {"speaker": speaker["display_name"], "text": text, "cache_key": key}
                    try:
                        key, line_id, audio_key, job_id, tts_s = await ensure_line(conn, settings, speaker, text, budget)
                        entry.update(line_id=str(line_id), audio_key=audio_key,
                                     tts_s=None if tts_s is None else round(tts_s, 1))
                        status, expr_s = await wait_expr(conn, job_id)
                        entry.update(expr=status, expr_wait_s=round(expr_s, 1))
                        if not args.no_video and not video_ready(settings, audio_key):
                            started = time.monotonic()
                            vkey, meta = await asyncio.wait_for(
                                gpu_client.talk_video_modal(settings, speaker["id"], audio_key),
                                gpu_client.MODAL_TIMEOUT)
                            marker = marker_for(settings, audio_key)
                            tmp = marker.with_suffix(".tmp")
                            tmp.write_text(json.dumps({"status": "ready", "video_key": vkey}))
                            tmp.replace(marker)
                            usd += float(meta.get("est_usd_total") or 0)
                            entry.update(video_key=vkey, video_s=round(time.monotonic() - started, 1),
                                         cold=meta.get("cold"), est_usd=meta.get("est_usd_total"))
                        else:
                            entry.update(video="cached" if not args.no_video else "skipped")
                    except Exception as error:  # keep going; report the failure (no secrets in messages)
                        await conn.rollback()
                        entry["error"] = f"{type(error).__name__}: {str(error)[:160]}"
                    report.append(entry)
                    print(json.dumps(entry), flush=True)
            pending = [e for e in report if e.get("expr") not in (None, "done", "none")]
            for entry in pending:  # final pass: expression jobs re-claimed after a bridge restart
                line = await one(conn, "SELECT job_id FROM voice_lines WHERE id=%s", (entry["line_id"],))
                await conn.commit()
                status, waited = await wait_expr(conn, line and line["job_id"], 420)
                entry.update(expr=status, expr_final_wait_s=round(waited, 1))
                print(json.dumps({"final_expr": entry["speaker"], "text": entry["text"], "expr": status}), flush=True)
    finally:
        await pool.close()
    if args.go:
        print(json.dumps({"tts_calls": budget["tts"], "lines": len(report),
                          "errors": sum("error" in e for e in report), "modal_est_usd": round(usd, 4)}))


if __name__ == "__main__":
    asyncio.run(main())
