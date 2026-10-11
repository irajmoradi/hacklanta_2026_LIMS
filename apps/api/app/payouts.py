"""Integer payout policy shared with the on-chain program (join order breaks ties)."""

from decimal import Decimal

MODES = {"winner_take_all": 0, "proportional": 1, "ranked": 2}


def allocate(total, scores, mode, split=()):
    order = sorted(
        (i for i, score in enumerate(scores) if score > 0), key=lambda i: (-scores[i], i)
    )
    weights = [0] * len(scores)
    if not order:
        return weights
    if mode == "winner_take_all":
        weights[order[0]] = 1
    elif mode == "proportional":
        weights = list(scores)
    else:
        for i, weight in zip(order, split):
            weights[i] = weight
    denominator = sum(weights)
    payouts = [total * w // denominator for w in weights]
    dust = total - sum(payouts)
    for i, weight in enumerate(weights):
        if dust and weight:
            payouts[i] += 1
            dust -= 1
    return payouts


def score_units(row, participants, entries):
    from app.competition_scoring import score_competition

    scores, _ = score_competition(row, participants, entries)
    by_id = {s["user_id"]: s for s in scores}
    if row.get("scoring") == "ordinal":
        join_order = {str(p["user_id"]): i for i, p in enumerate(participants)}
        finished = sorted(
            (s for s in scores if s["completed_at"]),
            key=lambda s: (s["completed_at"], s["submitted_at"], join_order[s["user_id"]]),
        )
        units = {s["user_id"]: len(finished) - i for i, s in enumerate(finished)}
        return [units.get(str(p["user_id"]), 0) for p in participants]
    return [int(Decimal(str(by_id[str(p["user_id"])]["points"])) * 1_000_000) for p in participants]


def projection(row, participants, entries):
    total = len(participants) * (row.get("entry_coins", 0) or row["entry_lamports"])
    scores = score_units(row, participants, entries)
    fee = total * row["auditor_fee_bps"] // 10000 if any(scores) else 0
    amounts = allocate(
        total - fee, scores, row.get("payout_mode", "winner_take_all"), row.get("ranked_bps", [])
    )
    return {
        "currency": "coins" if row.get("entry_coins") else "lamports",
        "fee": str(fee),
        "refund": not any(scores),
        "payouts": [
            {
                "user_id": str(p["user_id"]),
                "amount": str(
                    a if any(scores) else (row.get("entry_coins", 0) or row["entry_lamports"])
                ),
            }
            for p, a in zip(participants, amounts)
        ],
    }
