import json
import time
from types import SimpleNamespace

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from pydantic import ValidationError

from app.mayor import MODEL as GEMINI_MODEL
from app.mayor import Mayor
from app.models import MayorProposal
from app.voice import STOCK_VOICES, voice_id

# Capture the production implementation before the automatic external-provider mock.
GENERATE = Mayor.gemini
VALID = {
    "kind": "challenge",
    "title": "Tiny win",
    "body": "Take one step",
    "reward_xp": 20,
    "penalty": None,
}


@pytest.mark.parametrize(
    "raw",
    [
        "not JSON",
        "[]",
        "{}",
        json.dumps({**VALID, "kind": "delete_everything"}),
        json.dumps({**VALID, "reward_xp": 501}),
        json.dumps({**VALID, "reward_xp": -1}),
        json.dumps({**VALID, "reward_xp": 1.5}),
        json.dumps({**VALID, "reward_xp": "50"}),
        json.dumps({**VALID, "penalty": "ban"}),
        json.dumps({**VALID, "extra": "instruction"}),
    ],
)
async def test_actual_llm_json_validation(api, monkeypatch, raw):
    _, app = api
    app.state.settings.google_api_key = "mock-only"
    captured = []

    class FakeClient:
        def __init__(self, **kwargs):
            captured.append(kwargs)
            self.aio = self
            self.models = self

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def generate_content(self, **kwargs):
            assert kwargs["config"].response_schema is MayorProposal
            assert kwargs["model"] == GEMINI_MODEL
            return SimpleNamespace(text=raw)

        def close(self):
            pass

    monkeypatch.setattr("app.mayor.genai.Client", FakeClient)
    with pytest.raises(ValidationError):
        await GENERATE(Mayor(app.state.settings), MayorProposal, "Propose", {})
    assert captured[0]["vertexai"] is True


async def test_nudge_kind_instruction_and_failure_no_audio(api, monkeypatch):
    from fastapi import HTTPException

    from app.domain import SEED_USERS, VILLAGE_ID
    from app.models import NudgeProposal

    client, app = api
    target = SEED_USERS[1][0]
    async with app.state.pool.connection() as conn:
        await conn.execute("UPDATE users SET roast_ok=false WHERE id=%s", (target,))
    captured = []

    async def generate(self, schema, instruction, context):
        captured.append(instruction)
        return NudgeProposal(text="Keep going!")

    async def fail(*args):
        raise HTTPException(502, "Provider down")

    monkeypatch.setattr(Mayor, "generate", generate)
    monkeypatch.setattr("app.voice.synthesize", fail)
    response = await client.post(
        f"/api/villages/{VILLAGE_ID}/mayor/nudge", json={"target_user_id": str(target)}
    )
    assert response.status_code == 200
    assert response.json()["audio_url"] is None
    assert response.json()["text"].startswith("[AI as ")
    assert "No roasting" in captured[0]


async def test_auth0_rs256_mapping_and_rejections(api):
    client, app = api
    app.state.settings.demo_auth = False
    app.state.settings.auth0_domain = "unit-test.auth0.com"
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    calls = []

    class JWKS:
        def get_signing_key_from_jwt(self, token):
            calls.append(token)
            return SimpleNamespace(key=private_key.public_key())

    app.state.jwks = JWKS()
    claims = {
        "iss": "https://unit-test.auth0.com/",
        "sub": "auth0|not-a-uuid",
        "aud": "https://api.village.local",
        "iat": int(time.time()),
        "exp": int(time.time()) + 600,
        "name": "New Friend",
    }

    def headers(payload):
        return {"Authorization": "Bearer " + jwt.encode(payload, private_key, algorithm="RS256")}

    first = await client.get("/api/me", headers=headers(claims))
    second = await client.get("/api/me", headers=headers(claims))
    assert first.status_code == 200, first.text
    assert first.json()["user"]["id"] == second.json()["user"]["id"]
    assert first.json()["user"]["display_name"] == "New Friend"
    assert first.json()["villages"] == []
    for patch in ({"aud": "wrong"}, {"iss": "https://attacker/"}, {"exp": 0}):
        assert (
            await client.get("/api/me", headers=headers({**claims, **patch}))
        ).status_code == 401
    missing_exp = {k: v for k, v in claims.items() if k != "exp"}
    assert (await client.get("/api/me", headers=headers(missing_exp))).status_code == 401
    assert (await client.get("/api/me")).status_code == 401
    forged = jwt.encode(claims, "not-a-real-secret-for-unit-tests-only", algorithm="HS256")
    assert (
        await client.get("/api/me", headers={"Authorization": "Bearer " + forged})
    ).status_code == 401


async def test_health_gpu_down(api, monkeypatch):
    client, _ = api

    class Unreachable:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def get(self, url):
            raise httpx.ConnectError("offline")

    monkeypatch.setattr("app.main.httpx.AsyncClient", Unreachable)
    response = await client.get("/api/health")
    assert response.json() == {"ok": True, "db": "up", "gpu_worker": "down", "build": "API-004"}


def test_voice_consent_defaults():
    from app.domain import SEED_USERS

    user = {"id": SEED_USERS[0][0], "voice_id": "custom", "voice_consent": False}
    assert voice_id(user) == STOCK_VOICES[0]
    user["voice_consent"] = True
    assert voice_id(user) == "custom"
