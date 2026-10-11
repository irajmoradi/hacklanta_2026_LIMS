import asyncio
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from pathlib import Path

import pytest
from fastapi import HTTPException

from app import barks, voice
from app.config import Settings
from app.domain import SEED_USERS, VILLAGE_ID
from app.realtime import Movement
from app.security import DailyLimiter, LimitExceeded, charge, durable_voice_reserve

SELF, FRIEND = [u[0] for u in SEED_USERS[:2]]


def test_cli_help_and_bound_validation_before_any_configuration():
    script = Path(__file__).resolve().parents[1] / "scripts/generate_barks.py"
    help_result = subprocess.run(
        [sys.executable, str(script), "--help"], capture_output=True, text=True, timeout=10
    )
    assert help_result.returncode == 0 and "--max" in help_result.stdout
    invalid = subprocess.run(
        [sys.executable, str(script), "--village", str(VILLAGE_ID), "--max", "-1"],
        capture_output=True,
        text=True,
        timeout=10,
    )
    assert invalid.returncode == 2 and "between 0 and 1000" in invalid.stderr


def test_activity_event_is_allowlisted_and_forwarded():
    from pydantic import ValidationError

    fields = dict(x=0.0, z=0.0, heading=0.0, moving=False, running=False)
    # FEAT-023 replaced the movement Room with the overworld; the allowlist lives on Movement.
    assert Movement(**fields, activity="cafe").activity == "cafe"
    with pytest.raises(ValidationError):
        Movement(**fields, activity="generate_voice")


def test_bank_and_keys():
    assert len(barks.BANK) == 9 and len(barks.SUBSET) == 27
    assert all(len(lines) == 8 for lines in barks.BANK.values())
    assert all(2 <= len(text.split()) <= 6 for _, text in barks.LINES.values())
    key = barks.cache_key("clone-a", "walk-v1-0")
    assert key == barks.cache_key("clone-a", "walk-v1-0")
    assert key != barks.cache_key("clone-b", "walk-v1-0")
    assert key != barks.cache_key("clone-a", "wave-v1-0")
    assert "clone-a" not in key


async def consenting(app, uid=SELF, voice_id="synthetic-clone"):
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "UPDATE users SET voice_id=%s,voice_consent=true WHERE id=%s", (voice_id, uid)
        )


async def test_consent_cache_resume_and_read_revocation(api, outsider, monkeypatch):
    client, app = api
    calls = []

    async def synth(settings, user, text):
        calls.append((user["id"], text))
        return b"ID3synthetic"

    monkeypatch.setattr(voice, "synthesize", synth)
    settings, pool = app.state.settings, app.state.pool
    assert (await barks.generate(pool, settings, VILLAGE_ID, 3))["generated"] == 0
    await consenting(app)
    result = await barks.generate(pool, settings, VILLAGE_ID, 3)
    assert result["generated"] == 3 and result["remaining"] == 24
    result = await barks.generate(pool, settings, VILLAGE_ID, 0)
    assert result["cached"] == 3 and len(calls) == 3
    manifest = (await client.get(f"/api/villages/{VILLAGE_ID}/barks")).json()
    url = manifest[str(SELF)]["walk"][0]
    assert (await client.get(url)).content == b"ID3synthetic"
    assert (await client.get(url)).headers["cache-control"] == "private, no-store"
    assert (await client.get(url, headers=outsider)).status_code == 403
    assert (
        await client.get(f"/api/villages/{VILLAGE_ID}/barks", headers=outsider)
    ).status_code == 403
    # Raw cache keys cannot bypass consent or peer authorization.
    assert (
        await client.get("/api/assets/" + barks.cache_key("synthetic-clone", barks.SUBSET[0]))
    ).status_code == 403
    async with pool.connection() as conn:
        await conn.execute("UPDATE users SET voice_consent=false WHERE id=%s", (SELF,))
    assert (await client.get(url)).status_code == 404
    assert (await client.get(f"/api/villages/{VILLAGE_ID}/barks")).json()[str(SELF)] == {}
    assert (await barks.generate(pool, settings, VILLAGE_ID, 27))["generated"] == 0
    await consenting(app)
    result = await barks.generate(pool, settings, VILLAGE_ID, 27)
    assert result["generated"] == 24 and result["cached"] == 3
    assert (await barks.generate(pool, settings, VILLAGE_ID, 27))["generated"] == 0
    assert len(calls) == 27


async def test_batch_cap_restart_and_next_day(api, monkeypatch):
    _, app = api
    await consenting(app)
    settings, pool = app.state.settings, app.state.pool
    now = [86400]
    settings.cost_limiter = DailyLimiter({"elevenlabs": (2, 2, 2)}, clock=lambda: now[0])
    calls = []

    async def synth(settings, user, text):
        charge(settings, "elevenlabs")
        calls.append(text)
        return b"ID3synthetic"

    monkeypatch.setattr(voice, "synthesize", synth)
    result = await barks.generate(pool, settings, VILLAGE_ID, 27)
    assert result["generated"] == 2 and result["remaining"] == 25 and result["capped"]
    settings.cost_limiter = DailyLimiter({"elevenlabs": (2, 2, 2)}, clock=lambda: now[0])
    assert (await barks.generate(pool, settings, VILLAGE_ID, 27))["generated"] == 0
    now[0] += 86400
    result = await barks.generate(pool, settings, VILLAGE_ID, 27)
    assert result["generated"] == 2 and result["cached"] == 2 and len(calls) == 4


async def test_concurrent_batches_share_voice_cache(api, monkeypatch):
    _, app = api
    await consenting(app)
    await consenting(app, FRIEND)  # Same voice: cache identity is voice + line, not member.
    calls = []

    async def synth(*args):
        calls.append(1)
        await asyncio.sleep(0.01)
        return b"ID3synthetic"

    monkeypatch.setattr(voice, "synthesize", synth)
    await asyncio.gather(
        *(barks.generate(app.state.pool, app.state.settings, VILLAGE_ID, 27) for _ in range(2))
    )
    assert len(calls) == 27


async def test_failure_stops_without_poisoning_cache(api, monkeypatch):
    _, app = api
    await consenting(app)
    calls = []

    async def fail(*args):
        calls.append(1)
        raise HTTPException(502, "Synthetic failure")

    monkeypatch.setattr(voice, "synthesize", fail)
    report = await barks.generate(app.state.pool, app.state.settings, VILLAGE_ID, 27)
    assert report["failed"] == 1 and report["remaining"] == 27 and len(calls) == 1
    assert not list(app.state.settings.asset_dir.rglob("*.mp3"))


@pytest.mark.parametrize("caps", [(3, 10, 10), (10, 3, 10), (10, 10, 3)])
def test_durable_cap_all_dimensions_across_instances(tmp_path, caps):
    settings = Settings(
        database_url="", asset_dir=tmp_path, cost_limiter=DailyLimiter({"elevenlabs": caps})
    )

    def attempt(_):
        other = replace(settings, cost_limiter=DailyLimiter({"elevenlabs": caps}))
        try:
            durable_voice_reserve(other, ip="same", seat="same")
            return 1
        except LimitExceeded:
            return 0

    with ThreadPoolExecutor(max_workers=8) as pool:
        assert sum(pool.map(attempt, range(20))) == 3
