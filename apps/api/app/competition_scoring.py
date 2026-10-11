"""Shared live and settlement scoring, independent of XP and payment intents."""


def score_competition(row, participants, entries):
    mode = row.get("scoring", "cumulative")
    scores = []
    for participant in participants:
        uid = participant["user_id"]
        accepted = sorted(
            (e for e in entries if e["user_id"] == uid and e["decision"] == "confirmed"),
            key=lambda e: (e.get("confirmed_at") or e["created_at"], e["created_at"], str(e["id"])),
        )
        total, finish, submitted = 0, None, None
        for e in accepted:
            total += e["points"] if mode == "cumulative" else (e.get("value") or 0)
            if mode == "ordinal" and finish is None and total >= (row.get("target") or 1):
                finish = e.get("confirmed_at") or e["created_at"]
                submitted = e["created_at"]
        scores.append(
            {
                "user_id": str(uid),
                "points": total,
                "completed_at": finish.isoformat() if finish else None,
                "submitted_at": submitted.isoformat() if submitted else None,
            }
        )
    if mode == "ordinal":
        scores.sort(
            key=lambda s: (s["completed_at"] or "~", s["submitted_at"] or "~", s["user_id"])
        )
        winners = [scores[0]["user_id"]] if scores and scores[0]["completed_at"] else []
    else:
        scores.sort(key=lambda s: (-s["points"], s["user_id"]))
        maximum = scores[0]["points"] if scores else 0
        winners = [s["user_id"] for s in scores if s["points"] == maximum and maximum > 0]
    return scores, winners
