from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import FastAPI, HTTPException

from app import voice
from app.domain import VILLAGE_ID


@pytest.mark.parametrize("kind", ["checkin", "mayor"])
async def test_scene_voice_offline_never_generates(monkeypatch, kind):
    create = AsyncMock()
    monkeypatch.setattr(voice, "create_line", create)
    assert await voice.scene_greeting(None, SimpleNamespace(elevenlabs_api_key=""), {}, kind) == {
        "audio_url": None
    }
    create.assert_not_called()


@pytest.mark.parametrize("kind", ["checkin", "mayor"])
async def test_scene_voice_requires_consent_or_mayor_opt_in(monkeypatch, kind):
    monkeypatch.setattr(voice, "one", AsyncMock(return_value={"id": "self"}))
    create = AsyncMock()
    monkeypatch.setattr(voice, "create_line", create)
    settings = SimpleNamespace(elevenlabs_api_key="test", mayor_voice=False)
    assert await voice.scene_greeting(None, settings, {"id": "self"}, kind) == {"audio_url": None}
    create.assert_not_called()


async def test_scene_voice_cache_and_fixed_text(monkeypatch):
    speaker = {"id": "self", "voice_id": "clone", "voice_consent": True}
    lookup = AsyncMock(side_effect=[speaker, {"audio_key": "voice/self/greeting.mp3"}])
    monkeypatch.setattr(voice, "one", lookup)
    create = AsyncMock()
    monkeypatch.setattr(voice, "create_line", create)
    settings = SimpleNamespace(elevenlabs_api_key="test", mayor_voice=True)
    result = await voice.scene_greeting(None, settings, speaker, "checkin")
    assert result == {"audio_url": "/api/assets/voice/self/greeting.mp3"}
    assert "FOR UPDATE" in lookup.call_args_list[0].args[1]
    assert lookup.call_args_list[1].args[2][1] == "What did I do today?"
    create.assert_not_called()


@pytest.mark.parametrize("kind,stock", [("checkin", False), ("mayor", True)])
async def test_scene_voice_generates_once_and_soft_fails(monkeypatch, kind, stock):
    speaker = {"id": "self", "voice_id": "clone", "voice_consent": True}
    monkeypatch.setattr(voice, "one", AsyncMock(side_effect=[speaker, None]))
    create = AsyncMock(side_effect=HTTPException(503, "offline"))
    monkeypatch.setattr(voice, "create_line", create)
    settings = SimpleNamespace(elevenlabs_api_key="test", mayor_voice=True)
    assert await voice.scene_greeting(None, settings, speaker, kind) == {"audio_url": None}
    create.assert_awaited_once_with(
        None, settings, speaker, voice.SCENE_GREETINGS[kind], stock=stock, require_head=True
    )


async def test_scene_voice_rejects_arbitrary_generation():
    with pytest.raises(HTTPException) as error:
        await voice.scene_greeting(None, None, {}, "say anything")
    assert error.value.status_code == 404


async def test_scene_greeting_http_membership_and_offline(monkeypatch):
    from app import main

    app = FastAPI()
    app.state.settings = SimpleNamespace(elevenlabs_api_key="")
    app.include_router(main.router, prefix="/api")
    app.dependency_overrides[main.current_user] = lambda: {"id": "self"}
    app.dependency_overrides[main.connection] = lambda: None
    membership = AsyncMock()
    monkeypatch.setattr(main, "require_member", membership)
    base = f"/api/villages/{VILLAGE_ID}/scene-voice"
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        for kind in ("checkin", "mayor"):
            result = await client.post(f"{base}/{kind}")
            assert result.status_code == 200
            assert result.json() == {"audio_url": None}
            membership.assert_awaited_with(None, VILLAGE_ID, "self")
        assert (await client.post(f"{base}/arbitrary-prompt")).status_code == 404
        membership.side_effect = HTTPException(403, "Not a member")
        assert (await client.post(f"{base}/checkin")).status_code == 403
