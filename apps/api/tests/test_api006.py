import asyncio
from uuid import uuid4

import pytest
from psycopg.types.json import Jsonb

from app import domain
from app.db import one
from app.mayor import Mayor
from app.models import NudgeProposal
from scripts.migrate import apply_additions

SERVICE = {"X-Service-Key": "test-service-only"}
PHONE = "+15555550101"


@pytest.fixture
async def sender(api):
    client, app = api
    uid = uuid4()
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "INSERT INTO users(id,auth_issuer,auth_subject,display_name,phone_e164,agent_msgs_ok)"
            " VALUES (%s,'test',%s,'Test Messenger',%s,true)",
            (uid, str(uid), PHONE),
        )
        await conn.execute(
            "INSERT INTO village_members(village_id,user_id,house_slot) VALUES (%s,%s,9)",
            (domain.VILLAGE_ID, uid),
        )
    return uid


async def send(client, text, mid=None, phone=PHONE):
    return await client.post(
        "/api/internal/inbound",
        headers=SERVICE,
        json={"phone_e164": phone, "text": text, "message_id": mid or str(uuid4())},
    )


async def test_commands_and_replay(api, sender):
    client, app = api
    # Exercise the full conversation script within a configurable test-only allowance.
    app.state.settings.cost_limiter.caps["photon"] = (30, 30, 30)
    assert "active weekly goal" in (await send(client, "progress: first")).json()["reply_text"]
    assert "saved" in (await send(client, "goal: Finish a sketch")).json()["reply_text"]
    results = await asyncio.gather(
        send(client, "checkin: drew a tree", "same"), send(client, "checkin: drew a tree", "same")
    )
    assert results[0].json() == results[1].json()
    assert results[0].json()["processed_checkin"] is True
    assert (await send(client, "checkin: different", "same")).status_code == 409
    assert "+25 XP" in (await send(client, "progress: shaded the tree")).json()["reply_text"]
    status = (await send(client, "STATUS")).json()["reply_text"]
    assert (
        "55 XP" in status
        and "Streak: 1 days" in status
        and "checked in" in status
        and "Finish a sketch" in status
        and "coins" in status
    )
    async with app.state.pool.connection() as conn:
        row = await one(conn, "SELECT count(*) AS n FROM check_ins WHERE user_id=%s", (sender,))
        assert row["n"] == 2
        row = await one(
            conn, "SELECT goal_id FROM check_ins WHERE user_id=%s AND kind='progress'", (sender,)
        )
        assert row["goal_id"]
    for text in ["checkin:", "progress: ", "goal:", "pray:"]:
        assert "Write something" in (await send(client, text)).json()["reply_text"]
    assert "200 characters" in (await send(client, "goal: " + "x" * 201)).json()["reply_text"]


async def test_unknown_and_stop(api, sender):
    client, app = api
    unknown = (await send(client, "status", phone="+15555550999")).json()
    assert unknown == {
        "reply_text": "[AI Mayor] Please ask your village owner for an invite.",
        "processed_checkin": False,
    }
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "INSERT INTO mayor_outbox(village_id,user_id,phone_e164,text)"
            " VALUES (%s,%s,%s,'hello')",
            (domain.VILLAGE_ID, sender, PHONE),
        )
    assert len((await client.get("/api/internal/outbox", headers=SERVICE)).json()) == 1
    assert "now off" in (await send(client, " STOP ")).json()["reply_text"]
    async with app.state.pool.connection() as conn:
        assert not (await one(conn, "SELECT agent_msgs_ok FROM users WHERE id=%s", (sender,)))[
            "agent_msgs_ok"
        ]
        assert (await one(conn, "SELECT status FROM mayor_outbox WHERE user_id=%s", (sender,)))[
            "status"
        ] == "failed"
    assert (await client.get("/api/internal/outbox", headers=SERVICE)).json() == []
    assert (
        await client.post("/api/internal/inbound", json={"phone_e164": PHONE, "text": "STOP"})
    ).status_code == 401


async def test_conversation_context_and_prayer(api, sender, monkeypatch):
    client, app = api
    await send(client, "goal: Run a mile")
    await send(client, "checkin: Half a mile today")
    async with app.state.pool.connection() as conn:
        before = (await one(conn, "SELECT count(*) AS n FROM mayor_events"))["n"]
    captured = []

    async def generate(self, schema, instruction, context):
        assert schema is NudgeProposal
        captured.append(context)
        return NudgeProposal(text="Half a mile is progress toward your mile!")

    monkeypatch.setattr(Mayor, "generate", generate)
    result = await send(client, "How am I doing?")
    assert result.json()["reply_text"].startswith("[AI Mayor] Half a mile")
    assert captured[0]["goals"][0]["title"] == "Run a mile"
    assert captured[0]["check_ins"][0]["body"] == "Half a mile today"
    assert all(row["user_id"] == sender for row in captured[0]["check_ins"])
    assert PHONE not in str(captured)
    async with app.state.pool.connection() as conn:
        assert (await one(conn, "SELECT count(*) AS n FROM mayor_events"))["n"] == before
    # The default fixture's mocked event schema is replaced explicitly for the prayer.
    from app.events_table import TemplateProposal

    async def prayer(self, schema, instruction, context):
        assert context["prayer"] == "Help me keep going"
        assert schema is TemplateProposal
        return TemplateProposal(
            template_id="encouragement",
            kind="prayer_response",
            title="Keep going",
            body="One small step.",
            reward_xp=0,
            penalty=None,
        )

    monkeypatch.setattr(Mayor, "generate", prayer)
    assert (await send(client, "pray: Help me keep going")).json()[
        "reply_text"
    ] == "[AI Mayor] One small step."

    async def down(*args):
        raise RuntimeError("provider unavailable")

    monkeypatch.setattr(Mayor, "generate", down)
    assert "Use goal: to set a goal" in (await send(client, "Hello")).json()["reply_text"]


async def test_membership_and_placeholder_metadata(api, sender):
    client, app = api
    async with app.state.pool.connection() as conn:
        await conn.execute("UPDATE users SET portrait_placeholder=true WHERE id=%s", (sender,))
        await conn.execute(
            "INSERT INTO avatar_assets(user_id,revision,manifest) VALUES (%s,1,%s)",
            (sender, Jsonb({"portrait": {"kind": "lam_head"}})),
        )
        assert (await domain.avatar(conn, sender))["portrait"]["placeholder"] is True
        await conn.execute(
            "UPDATE avatar_assets SET manifest=%s WHERE user_id=%s",
            (Jsonb({"portrait": {"kind": "lam_head", "placeholder": False}}), sender),
        )
        assert (await domain.avatar(conn, sender))["portrait"]["placeholder"] is False
    me = (await client.get("/api/me", headers={"X-Demo-User": str(sender)})).json()
    assert me["villages"][0]["joined_at"]
    assert domain.preset(sender)["portrait"]["placeholder"] is True


def test_migration_idempotent(test_database):
    import psycopg

    settings, _ = test_database
    with psycopg.connect(settings.database_url) as conn:
        apply_additions(conn)
        apply_additions(conn)


async def test_outbox_bounded_claim_and_membership_order(api, sender):
    client, app = api
    async with app.state.pool.connection() as conn:
        for _ in range(2):
            await conn.execute(
                "INSERT INTO mayor_outbox(village_id,user_id,phone_e164,text)"
                " VALUES (%s,%s,%s,'test')",
                (domain.VILLAGE_ID, sender, PHONE),
            )
        vid = uuid4()
        await conn.execute(
            "INSERT INTO villages(id,name,seed,invite_code) VALUES (%s,'New village',1,%s)",
            (vid, uuid4().hex),
        )
        await conn.execute(
            "INSERT INTO village_members(village_id,user_id,house_slot,joined_at)"
            " VALUES (%s,%s,0,now()-interval '1 year')",
            (vid, sender),
        )
    assert len((await client.get("/api/internal/outbox?limit=1", headers=SERVICE)).json()) == 1
    assert len((await client.get("/api/internal/outbox?limit=1", headers=SERVICE)).json()) == 1
    assert (await client.get("/api/internal/outbox?limit=0", headers=SERVICE)).status_code == 422
    me = (await client.get("/api/me", headers={"X-Demo-User": str(sender)})).json()
    assert me["villages"][0]["id"] == str(vid)
    await send(client, "checkin: Oldest membership")
    async with app.state.pool.connection() as conn:
        assert (await one(conn, "SELECT village_id FROM check_ins WHERE user_id=%s", (sender,)))[
            "village_id"
        ] == vid
