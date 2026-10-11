import base64
from datetime import UTC, datetime, timedelta

import pytest
from solders.pubkey import Pubkey
from solders.signature import Signature

from app import solana_rpc as chain
from app.competition_models import CompetitionCreate
from app.domain import SEED_USERS, VILLAGE_ID
from app.payouts import allocate

BASE = f"/api/villages/{VILLAGE_ID}"
WALLET = str(Pubkey.new_unique())
DEST = str(Pubkey.new_unique())


def encode58(raw):
    n = int.from_bytes(raw, "big")
    value = ""
    while n:
        n, r = divmod(n, 58)
        value = chain.ALPHABET[r] + value
    return "1" * (len(raw) - len(raw.lstrip(b"\0"))) + value


def receipt(intent, signature):
    keys = [intent["wallet"]]
    for ix in intent["instructions"]:
        for k in [ix["program"]] + [a["address"] for a in ix["accounts"]]:
            if k not in keys:
                keys.append(k)
    return {
        "blockTime": int(datetime.now(UTC).timestamp()),
        "meta": {"err": None},
        "transaction": {
            "signatures": [signature],
            "message": {
                "accountKeys": keys,
                "header": {"numRequiredSignatures": 1},
                "instructions": [
                    {
                        "programIdIndex": keys.index(ix["program"]),
                        "accounts": [keys.index(a["address"]) for a in ix["accounts"]],
                        "data": encode58(base64.b64decode(ix["data"])),
                    }
                    for ix in intent["instructions"]
                ],
            },
        },
    }


@pytest.mark.parametrize(
    "mode,split,expected",
    [
        ("winner_take_all", [], [21, 0, 0]),
        ("proportional", [], [10, 10, 1]),
        ("ranked", [6000, 3000, 1000], [13, 6, 2]),
    ],
)
def test_payout_conservation(mode, split, expected):
    assert allocate(21, [5, 5, 1], mode, split) == expected
    assert sum(expected) == 21


@pytest.mark.parametrize("split", [[], [6000, 3000], [10000, 0], [1000] * 11])
def test_bad_splits(split):
    with pytest.raises(ValueError):
        CompetitionCreate(title="Test", terms="Test", payout_mode="ranked", ranked_bps=split)


@pytest.mark.parametrize(
    "failure", [None, "amount", "recipient", "unconfirmed", "failed", "memo", "signer", "mainnet"]
)
async def test_treasury_verifies_rpc_and_replay(api, monkeypatch, failure):
    client, app = api
    app.state.settings.solana_treasury = DEST
    tx = None

    async def rpc(settings, method, params=()):
        if method == "getGenesisHash":
            return "wrong" if failure == "mainnet" else chain.GENESIS
        assert method == "getTransaction"
        assert params[1]["maxSupportedTransactionVersion"] == 1
        return None if failure == "unconfirmed" else tx

    monkeypatch.setattr(chain, "rpc", rpc)
    before = (await client.get(BASE + f"/users/{SEED_USERS[0][0]}")).json()["villager"]["xp"]
    response = await client.post(
        BASE + "/solana/intents", json={"action": "treasury", "wallet": WALLET, "xp": 100}
    )
    if failure == "mainnet":
        assert response.status_code == 503
        return
    assert response.status_code == 200, response.text
    intent = response.json()
    signature = str(Signature.new_unique())
    tx = receipt(intent, signature)
    ix = tx["transaction"]["message"]["instructions"][0]
    if failure == "amount":
        raw = bytearray(base64.b64decode(intent["instructions"][0]["data"]))
        raw[-1] = 1
        ix["data"] = encode58(raw)
    if failure == "recipient":
        ix["accounts"][1] = 0
    if failure == "memo":
        tx["transaction"]["message"]["instructions"].pop()
    if failure == "signer":
        tx["transaction"]["message"]["header"]["numRequiredSignatures"] = 0
    if failure == "failed":
        tx["meta"]["err"] = {"InstructionError": [0, "Custom"]}
    path = BASE + f"/solana/intents/{intent['id']}/confirm"
    result = await client.post(path, json={"signature": signature})
    assert result.status_code == (409 if failure == "unconfirmed" else 422 if failure else 200), (
        result.text
    )
    after = (await client.get(BASE + f"/users/{SEED_USERS[0][0]}")).json()["villager"]
    assert after["xp"] == before + (0 if failure else 100)
    if not failure:
        assert after["treasury_xp"] == 100
        assert (await client.post(path, json={"signature": signature})).json()["xp_awarded"] == 0
        another = (
            await client.post(
                BASE + "/solana/intents", json={"action": "treasury", "wallet": WALLET}
            )
        ).json()
        assert (
            await client.post(
                BASE + f"/solana/intents/{another['id']}/confirm", json={"signature": signature}
            )
        ).status_code == 409


async def test_cap_reservations_and_auth(api, monkeypatch):
    client, app = api
    app.state.settings.solana_treasury = DEST

    async def rpc(*args):
        return chain.GENESIS

    monkeypatch.setattr(chain, "rpc", rpc)
    r = await client.post(
        BASE + "/solana/intents", json={"action": "treasury", "wallet": WALLET, "xp": 1000}
    )
    assert r.status_code == 200, r.text
    assert (
        await client.post(
            BASE + "/solana/intents", json={"action": "treasury", "wallet": WALLET, "xp": 1}
        )
    ).status_code == 409
    assert (
        await client.post(
            BASE + f"/solana/intents/{r.json()['id']}/confirm",
            headers={"X-Demo-User": str(SEED_USERS[1][0])},
            json={"signature": str(Signature.new_unique())},
        )
    ).status_code == 404


async def test_coin_payouts_and_sol_requires_receipt(api):
    client, app = api
    for mode, split in [
        ("winner_take_all", []),
        ("proportional", []),
        ("ranked", [6000, 3000, 1000]),
    ]:
        r = await client.post(
            BASE + "/competitions",
            json={
                "title": "Coins",
                "terms": "Test",
                "entry_coins": 1,
                "payout_mode": mode,
                "ranked_bps": split,
                "auditor_id": str(SEED_USERS[1][0]),
            },
        )
        assert r.status_code == 200, r.text
        path = BASE + f"/competitions/{r.json()['id']}"
        assert (await client.post(path + "/join")).status_code == 200
        # No points means exact refunds, no fee.
        result = await client.post(path + "/settle", headers={"X-Demo-User": str(SEED_USERS[1][0])})
        assert result.status_code == 200, result.text
        assert result.json()["result"]["payouts"]["refund"]
        assert result.json()["result"]["payments_executed"]
    r = await client.post(
        BASE + "/competitions",
        json={
            "title": "SOL",
            "terms": "Test",
            "entry_lamports": 100,
            "deadline": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
        },
    )
    assert r.status_code == 200, r.text
    assert (await client.post(BASE + f"/competitions/{r.json()['id']}/join")).status_code == 409


@pytest.mark.parametrize("action", ["settle", "refund"])
async def test_sol_create_join_score_finalize_receipts(api, monkeypatch, action):
    from app.db import one

    client, app = api
    app.state.settings.solana_program_id = "4m7xFhBQcWfa7u3kP8i78QaTYjkQXSxt5iUfj2689Ehu"
    auditor_wallet = str(Pubkey.new_unique())
    auditor_headers = {"X-Demo-User": str(SEED_USERS[1][0])}
    tx = None

    async def rpc(settings, method, params=()):
        if method == "getGenesisHash":
            return chain.GENESIS
        if method == "getMinimumBalanceForRentExemption":
            return 1000
        assert method == "getTransaction"
        return tx

    async def participants(*args):
        return [WALLET]

    monkeypatch.setattr(chain, "rpc", rpc)
    monkeypatch.setattr(chain, "pot_participants", participants)
    c = (
        await client.post(
            BASE + "/competitions",
            json={
                "title": "Devnet",
                "terms": "Auditor confirms points",
                "entry_lamports": 1000,
                "auditor_id": str(SEED_USERS[1][0]),
                "payout_mode": "ranked",
                "ranked_bps": [6000, 3000, 1000],
                "deadline": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
            },
        )
    ).json()

    async def prepare(action, wallet=WALLET, headers=None):
        r = await client.post(
            BASE + "/solana/intents",
            headers=headers,
            json={
                "action": action,
                "wallet": wallet,
                "competition_id": c["id"],
                "auditor_wallet": auditor_wallet,
            },
        )
        assert r.status_code == 200, r.text
        return r.json()

    async def confirm(intent, headers=None):
        nonlocal tx
        sig = str(Signature.new_unique())
        tx = receipt(intent, sig)
        r = await client.post(
            BASE + f"/solana/intents/{intent['id']}/confirm",
            headers=headers,
            json={"signature": sig},
        )
        assert r.status_code == 200, r.text
        return sig

    await confirm(await prepare("create"))
    await confirm(await prepare("join"))
    path = BASE + f"/competitions/{c['id']}"
    detail = (await client.get(path)).json()
    assert detail["participants"][0]["wallet_address"] == WALLET
    assert detail["pot_address"]
    # Scratch DB clock advance and synthetic accepted evidence. No provider or chain sends.
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "UPDATE competitions SET deadline=now()-(%s * interval '1 hour') WHERE id=%s",
            (73 if action == "refund" else 1, c["id"]),
        )
        entry = await one(
            conn,
            "INSERT INTO competition_entries "
            "(competition_id,user_id,body,idempotency_key,decision,points) "
            "VALUES(%s,%s,'Synthetic','sol-test','confirmed',10) RETURNING id",
            (c["id"], SEED_USERS[0][0]),
        )
    headers = auditor_headers if action == "settle" else None
    wallet = auditor_wallet if action == "settle" else WALLET
    intent = await prepare(action, wallet, headers)
    if action == "settle":
        assert (
            await client.post(
                path + f"/entries/{entry['id']}/decision",
                headers=auditor_headers,
                json={"decision": "confirmed", "points": 20, "reason": "Changed"},
            )
        ).status_code == 409
    await confirm(intent, headers)
    result = (await client.get(path)).json()
    assert result["status"] == "settled" and result["result"]["payments_executed"]
    assert result["chain_status"] == ("settled" if action == "settle" else "refunded")


@pytest.mark.parametrize("amount", [200, 2000])
async def test_treasury_xp_adds_auditor_chance_without_village_xp(api, monkeypatch, amount):
    from app import weekly, world
    from app.domain import award, balance, coin_balance
    from app.overworld import World, WorldRoom
    from app.weekly import choose_auditor

    client, app = api
    async with app.state.pool.connection() as conn:
        uid = SEED_USERS[0][0]
        coins = await coin_balance(conn, VILLAGE_ID, uid)
        before = await world.state(conn, VILLAGE_ID)
        await award(conn, VILLAGE_ID, uid, amount, "treasury_devnet", "synthetic-treasury")
        after = await world.state(conn, VILLAGE_ID)
        assert before["xp"] == after["xp"]
        assert await coin_balance(conn, VILLAGE_ID, uid) == coins
        room = WorldRoom(app.state.pool, VILLAGE_ID, World(0, []))
        await room.refresh(conn)
        assert room.world.world["level"] == after["level"]
        tickets = []
        monkeypatch.setattr(
            weekly.secrets, "choice", lambda values: tickets.extend(values) or values[0]
        )
        await choose_auditor(conn, VILLAGE_ID, [uid])
        assert len(tickets) == 1 + min(10, await balance(conn, VILLAGE_ID, uid) // 100)


@pytest.mark.parametrize(
    "mode,split,expected",
    [
        ("winner_take_all", [], [21, 0, 0]),
        ("proportional", [], [10, 10, 1]),
        ("ranked", [6000, 3000, 1000], [13, 6, 2]),
    ],
)
async def test_coin_positive_payouts_conserve_and_do_not_replay(api, mode, split, expected):
    from app.db import many

    client, app = api
    members = [SEED_USERS[i][0] for i in [0, 2, 3]]
    r = await client.post(
        BASE + "/competitions",
        json={
            "title": "Exact coin split",
            "terms": "Synthetic scores",
            "entry_coins": 7,
            "auditor_id": str(SEED_USERS[1][0]),
            "payout_mode": mode,
            "ranked_bps": split,
        },
    )
    assert r.status_code == 200, r.text
    cid = r.json()["id"]
    path = BASE + f"/competitions/{cid}"
    for uid in members:
        joined = await client.post(path + "/join", headers={"X-Demo-User": str(uid)})
        assert joined.status_code == 200, joined.text
    async with app.state.pool.connection() as conn:
        for uid, points in zip(members, [5, 5, 1]):
            await conn.execute(
                "INSERT INTO competition_entries "
                "(competition_id,user_id,body,idempotency_key,decision,points) "
                "VALUES(%s,%s,'Synthetic','coins','confirmed',%s)",
                (cid, uid, points),
            )
    for _ in range(2):
        r = await client.post(path + "/settle", headers={"X-Demo-User": str(SEED_USERS[1][0])})
        assert r.status_code == 200, r.text
        assert [int(p["amount"]) for p in r.json()["result"]["payouts"]["payouts"]] == expected
    async with app.state.pool.connection() as conn:
        rows = await many(
            conn, "SELECT delta FROM coin_ledger WHERE source_key LIKE %s", (f"payout:{cid}:%",)
        )
        assert len(rows) == 3 and sum(r["delta"] for r in rows) == 21


async def test_concurrent_treasury_reservations_serialize(api, monkeypatch):
    import asyncio

    client, app = api
    app.state.settings.solana_treasury = DEST

    async def rpc(*args):
        return chain.GENESIS

    monkeypatch.setattr(chain, "rpc", rpc)
    results = await asyncio.gather(
        *(
            client.post(
                BASE + "/solana/intents", json={"action": "treasury", "wallet": WALLET, "xp": 600}
            )
            for _ in range(2)
        )
    )
    assert [r.status_code for r in results] == [200, 200]
    assert results[0].json()["id"] == results[1].json()["id"]
    assert (
        await client.post(
            BASE + "/solana/intents", json={"action": "treasury", "wallet": WALLET, "xp": 500}
        )
    ).status_code == 409


def test_deadline_requires_timezone_even_for_free_competitions():
    with pytest.raises(ValueError, match="timezone"):
        CompetitionCreate(title="Deadline", terms="Test", deadline=datetime(2027, 1, 1))
