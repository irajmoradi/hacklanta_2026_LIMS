"""Fixed, consent-gated voice barks. Only the explicit CLI generates audio."""

import hashlib

from fastapi import HTTPException

from app import voice
from app.db import many, one
from app.security import Identity, LimitExceeded, identity

# IDs are immutable: append new lines or introduce a new version to change text.
BANK = {
    "walk": [
        "Here we go.",
        "Legs still work.",
        "Taking the scenic route.",
        "Out for a stroll.",
        "One foot, then another.",
        "Places to be.",
        "Catch you over there.",
        "Fresh air sounds good.",
    ],
    "wave": [
        "Hey, you made it!",
        "Good to see you.",
        "Oh hey, neighbor!",
        "What's up, folks?",
        "Over here, buddy!",
        "Howdy, fancy seeing you.",
        "There you are!",
        "Hey hey, everyone!",
    ],
    "cheer": [
        "Hell yeah, let's go!",
        "You got this!",
        "That's what I'm saying!",
        "Look at us go!",
        "Big win, buddy!",
        "Keep it going!",
        "We're doing the thing!",
        "Give it up!",
    ],
    "spin": [
        "Check these moves.",
        "Nobody saw that.",
        "I meant to do that.",
        "Spin first, think later.",
        "Still got it.",
        "Round we go.",
        "My knees disagree.",
        "Watch this bit.",
    ],
    "cafe": [
        "Coffee first, everything later.",
        "Save me a seat.",
        "This is my spot.",
        "Just one more cup.",
        "Time for a break.",
        "That smells so good.",
        "Make mine a big one.",
        "Perfect people watching spot.",
    ],
    "attraction": [
        "Count me in!",
        "This looks fun.",
        "Best seat in town.",
        "Let's give this a go.",
        "Worth the wait.",
        "Hold my coffee.",
        "Okay, one more round.",
        "Now we're talking!",
    ],
    "checkin": [
        "Got it done.",
        "One more small win.",
        "That counts, right?",
        "Showing up counts.",
        "Put that on the board.",
        "Progress is progress.",
        "Today wasn't nothing.",
        "I'll take that win.",
    ],
    "cheered": [
        "Aw, thanks buddy.",
        "Needed that today.",
        "You're too kind.",
        "Right back at you.",
        "My people, right here.",
        "Thanks for showing up.",
        "That means a lot.",
        "You made my day.",
    ],
    "house": [
        "Home sweet home.",
        "Shoes off, please.",
        "Make yourself at home.",
        "Good to be back.",
        "Mind the mess.",
        "Come on in.",
        "Cozy in here.",
        "Finally, a comfy chair.",
    ],
}
LINES = {
    f"{trigger}-v1-{i}": (trigger, text)
    for trigger, texts in BANK.items()
    for i, text in enumerate(texts)
}
SUBSET = [line for line in LINES if int(line.rsplit("-", 1)[1]) < 3]


def cache_key(voice_id, line_id):
    digest = hashlib.sha256(f"{voice_id}\0{line_id}".encode()).hexdigest()
    return f"barks/{digest}.mp3"


def manifest(settings, user):
    if not user.get("voice_consent") or not user.get("voice_id"):
        return {}
    result = {}
    for line in SUBSET:
        if (settings.asset_dir / cache_key(user["voice_id"], line)).is_file():
            result.setdefault(LINES[line][0], []).append(f"/api/barks/{user['id']}/{line}")
    return result


async def generate(pool, settings, village, maximum):
    """Serialize each voice/line across processes; commit each finished clip separately."""
    report = dict(generated=0, cached=0, remaining=0, failed=0, capped=False, characters=0)
    async with pool.connection() as conn:
        users = await many(
            conn,
            "SELECT u.id FROM users u JOIN village_members m ON m.user_id=u.id "
            "WHERE m.village_id=%s ORDER BY u.id",
            (village,),
        )
    stopped = False
    for member in users:
        for line in SUBSET:
            async with pool.connection() as conn:
                # Same lock as voice deletion/cloning: consent cannot change during synthesis.
                user = await one(
                    conn, "SELECT * FROM users WHERE id=%s FOR UPDATE", (member["id"],)
                )
                if not user or not user["voice_consent"] or not user["voice_id"]:
                    break
                key = cache_key(user["voice_id"], line)
                await conn.execute(
                    "SELECT pg_advisory_xact_lock(%s)",
                    (
                        int.from_bytes(
                            hashlib.sha256(key.encode()).digest()[:8], "big", signed=True
                        ),
                    ),
                )
                path = settings.asset_dir / key
                if path.is_file():
                    report["cached"] += 1
                    continue
                if stopped or report["generated"] + report["failed"] >= maximum:
                    report["remaining"] += 1
                    continue
                token = identity.set(Identity("bark-batch", str(user["id"]), settings))
                try:
                    audio = await voice.synthesize(settings, user, LINES[line][1])
                    path.parent.mkdir(parents=True, exist_ok=True)
                    temporary = path.with_suffix(".tmp")
                    temporary.write_bytes(audio)
                    temporary.replace(path)
                    report["generated"] += 1
                    report["characters"] += len(LINES[line][1])
                except LimitExceeded:
                    report["capped"] = True
                    report["remaining"] += 1
                except HTTPException:
                    report["failed"] += 1
                    report["remaining"] += 1
                    stopped = True  # No retry loop on provider failure.
                finally:
                    identity.reset(token)
    return report
