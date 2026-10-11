"""Read-only devnet RPC. No server signer, sender, airdrop or deployment."""

import base64
import hashlib
import struct

import httpx
from fastapi import HTTPException
from solders.pubkey import Pubkey
from solders.signature import Signature

GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1"
SYSTEM = "11111111111111111111111111111111"
MEMO = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def decode58(value):
    n = 0
    for c in value:
        n = n * 58 + ALPHABET.index(c)
    return b"\0" * (len(value) - len(value.lstrip("1"))) + n.to_bytes(
        (n.bit_length() + 7) // 8, "big"
    )


def key(value):
    try:
        return Pubkey.from_string(value)
    except (ValueError, TypeError):
        raise HTTPException(422, "Invalid Solana address") from None


def tag(name):
    return hashlib.sha256(("global:" + name).encode()).digest()[:8]


def instruction(program, accounts, data):
    return {
        "program": program,
        "accounts": [{"address": a, "role": r} for a, r in accounts],
        "data": base64.b64encode(data).decode(),
    }


def addresses(program, creator, week):
    pot, _ = Pubkey.find_program_address(
        [b"pot", bytes(key(creator)), struct.pack("<Q", week)], key(program)
    )
    vault, _ = Pubkey.find_program_address([b"vault", bytes(pot)], key(program))
    return str(pot), str(vault)


async def rpc(settings, method, params=()):
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                settings.solana_rpc_url,
                json={"jsonrpc": "2.0", "id": 1, "method": method, "params": list(params)},
            )
            r.raise_for_status()
            body = r.json()
            if "error" in body or "result" not in body:
                raise ValueError("RPC error")
            return body["result"]
    except (httpx.HTTPError, ValueError):
        raise HTTPException(
            503, "Devnet RPC unavailable; retry verification without paying again"
        ) from None


async def devnet(settings):
    if await rpc(settings, "getGenesisHash") != GENESIS:
        raise HTTPException(503, "Solana features require devnet")


async def transaction(settings, signature):
    try:
        Signature.from_string(signature)
    except ValueError:
        raise HTTPException(422, "Invalid transaction signature") from None
    await devnet(settings)
    tx = await rpc(
        settings,
        "getTransaction",
        [
            signature,
            {"encoding": "json", "commitment": "confirmed", "maxSupportedTransactionVersion": 1},
        ],
    )
    if not tx or not tx.get("meta"):
        raise HTTPException(409, "Transaction not confirmed yet; retry this signature")
    if tx["meta"].get("err") is not None:
        raise HTTPException(422, "Transaction failed on devnet")
    if tx.get("transaction", {}).get("signatures", [None])[0] != signature:
        raise HTTPException(422, "Signature mismatch")
    return tx


def verify_receipt(tx, intent):
    """Compare compiled instructions, memo nonce, signer and transfer, not UI assertions."""
    try:
        message = tx["transaction"]["message"]
        keys = (
            message["accountKeys"]
            + tx["meta"].get("loadedAddresses", {}).get("writable", [])
            + tx["meta"].get("loadedAddresses", {}).get("readonly", [])
        )
        signed = message["accountKeys"][: message["header"]["numRequiredSignatures"]]
        if intent["wallet"] not in signed:
            raise ValueError()
        timestamp = tx.get("blockTime")
        if (
            timestamp is None
            or not intent["created_at"].timestamp() - 5
            <= timestamp
            <= intent["expires_at"].timestamp()
        ):
            raise ValueError()
        actual = []
        for ix in message["instructions"]:
            program = keys[ix["programIdIndex"]]
            if program == "ComputeBudget111111111111111111111111111111":
                continue
            actual.append((program, [keys[i] for i in ix["accounts"]], decode58(ix["data"])))
        expected = [
            (i["program"], [a["address"] for a in i["accounts"]], base64.b64decode(i["data"]))
            for i in intent["instructions"]
        ]
        if actual != expected:
            raise ValueError()
    except (ValueError, KeyError, TypeError, IndexError):
        raise HTTPException(
            422,
            "Transaction does not match the reviewed intent, wallet, amount, destination or memo",
        ) from None


async def pot_participants(settings, row):
    result = await rpc(
        settings,
        "getAccountInfo",
        [row["pot_address"], {"encoding": "base64", "commitment": "confirmed"}],
    )
    value = result.get("value")
    if not value or value["owner"] != row["chain_config"]["program"] or value["executable"]:
        raise HTTPException(409, "Invalid or missing pot account")
    raw = base64.b64decode(value["data"][0])
    if len(raw) != 386 or raw[:8] != hashlib.sha256(b"account:Pot").digest()[:8]:
        raise HTTPException(409, "Pot layout mismatch; approved program upgrade required")
    count = struct.unpack_from("<I", raw, 98)[0]
    if count > 8:
        raise HTTPException(409, "Invalid pot participants")
    config = row["chain_config"]
    pot, vault = addresses(config["program"], config["creator"], int(config["week"]))
    split_offset = 106 + count * 32
    split_count = struct.unpack_from("<I", raw, split_offset)[0]
    from app.payouts import MODES

    if (
        pot != row["pot_address"]
        or vault != config["vault"]
        or raw[8:40] != bytes(key(config["creator"]))
        or struct.unpack_from("<Q", raw, 40)[0] != int(config["week"])
        or struct.unpack_from("<Q", raw, 48)[0] != row["entry_lamports"]
        or raw[56:88] != bytes(key(config["auditor"]))
        or struct.unpack_from("<H", raw, 88)[0] != row["auditor_fee_bps"]
        or struct.unpack_from("<q", raw, 90)[0] != int(row["deadline"].timestamp())
        or raw[105 + count * 32] != MODES[row["payout_mode"]]
        or split_count > 10
        or list(struct.unpack_from("<" + "H" * split_count, raw, split_offset + 4))
        != row["ranked_bps"]
    ):
        raise HTTPException(409, "On-chain pot terms do not match this competition")
    participants = [str(Pubkey.from_bytes(raw[102 + i * 32 : 134 + i * 32])) for i in range(count)]
    if len(set(participants)) != count or config["auditor"] in participants:
        raise HTTPException(409, "Invalid pot participant list")
    return participants
