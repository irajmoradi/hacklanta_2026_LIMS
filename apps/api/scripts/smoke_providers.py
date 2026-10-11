"""Explicit opt-in smoke: exactly one Gemini prayer and one short stock TTS request.

No retries, no content/key output. Runtime artifacts stay inside apps/api/.runtime.
"""

import argparse
import asyncio
import sys
from dataclasses import replace
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx  # noqa: E402

from app.config import Settings  # noqa: E402
from app.db import one  # noqa: E402
from app.domain import SEED_USERS, VILLAGE_ID  # noqa: E402
from app.main import create_app  # noqa: E402
from app.runtime import selector_loop  # noqa: E402


async def smoke():
    settings = replace(
        Settings.from_env(),
        demo_auth=True,
        llm_provider="gemini",
        mayor_scheduler=False,
        asset_dir=Path(__file__).resolve().parents[1] / ".runtime/smoke/assets",
    )
    app = create_app(settings)
    gemini_ok = voice_ok = False
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://smoke",
            headers={"X-Demo-User": str(SEED_USERS[0][0])},
        ) as client:
            prayer = await client.post(
                f"/api/villages/{VILLAGE_ID}/mayor/pray",
                json={"text": "Give us one tiny friendly hackathon challenge."},
            )
            if prayer.status_code == 200:
                async with app.state.pool.connection() as conn:
                    event = await one(
                        conn, "SELECT model FROM mayor_events WHERE id=%s", (prayer.json()["id"],)
                    )
                    gemini_ok = event["model"].startswith("gemini-2.5-flash:")
            print(f"Gemini prayer: {'SUCCESS' if gemini_ok else 'FAILURE (fallback or API error)'}")
            speech = await client.post(
                "/api/voice/lines",
                json={"user_id": str(SEED_USERS[0][0]), "text": "Hello, Village!"},
            )
            if speech.status_code == 200:
                audio = await client.get(speech.json()["audio_url"])
                voice_ok = audio.status_code == 200 and len(audio.content) > 0
            print(f"ElevenLabs short line: {'SUCCESS' if voice_ok else 'FAILURE'}")
    return 0 if gemini_ok and voice_ok else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--allow-paid",
        action="store_true",
        required=True,
        help="Explicitly authorize one request to each configured provider",
    )
    parser.parse_args()
    try:
        code = asyncio.run(smoke(), loop_factory=selector_loop)
    except Exception as exc:
        print(f"Smoke failed ({type(exc).__name__}); no automatic retry.")
        code = 1
    sys.exit(code)
