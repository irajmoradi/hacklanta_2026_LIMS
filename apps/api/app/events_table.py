"Server-owned difficulty/effect policy; generated prose cannot change mechanics."

import random
import re
from typing import Literal

from pydantic import model_validator

from app.models import MayorDecision, MayorProposal

TEMPLATES = {
    "small_step": dict(tier="solo", people=1, hours=0.25, xp=[25, 50], penalty=None),
    "buddy_chat": dict(tier="pair", people=2, hours=0.5, xp=[50, 80], penalty="fog"),
    "game_night": dict(tier="group", people=3, hours=1, xp=[80, 120], penalty="sad_pet"),
    "village_project": dict(tier="group", people=3, hours=2, xp=[120, 200], penalty="crater"),
    "weekend_build": dict(
        tier="group", people=3, hours=4, xp=[200, 300], penalty="house_downgrade"
    ),
    "encouragement": dict(tier="solo", people=1, hours=0, xp=[0, 0], penalty=None),
}
RECOVERY = (
    "Complete the linked shared repair with check-ins. Disasters are "
    "recoverable; nothing is deleted."
)


class TemplateProposal(MayorProposal):
    template_id: Literal[
        "small_step",
        "buddy_chat",
        "game_night",
        "village_project",
        "weekend_build",
        "encouragement",
    ]
    penalty: Literal["fog", "sad_pet", "crater", "house_downgrade"] | None

    @model_validator(mode="after")
    def vetted(self):
        if self.kind == "recap":
            raise ValueError("Event templates cannot generate recaps")
        validate(self)
        return self


class TemplateDecision(MayorDecision):
    event: TemplateProposal | None = None


def validate(proposal):
    if proposal.kind == "recap":
        if proposal.reward_xp != 0 or proposal.penalty is not None:
            raise ValueError("Recaps cannot carry effects")
        return None
    key = getattr(proposal, "template_id", None)
    if key not in TEMPLATES:
        raise ValueError("An explicit vetted template is required")
    template = TEMPLATES[key]
    low, high = template["xp"]
    if not low <= proposal.reward_xp <= high or proposal.penalty != template["penalty"]:
        raise ValueError("Effects outside selected template")
    if key == "encouragement" and proposal.kind != "prayer_response":
        raise ValueError("Encouragement must be a prayer response")
    if key != "encouragement" and proposal.kind not in {"challenge", "random_event"}:
        raise ValueError("Rewarded templates must be challenges or events")
    return template


def prompt():
    import json

    return " Select template_id and effects exactly from this table: " + json.dumps(TEMPLATES)


def requested_template(wish):
    """Recognize table names in untrusted wishes, never interpret them as instructions.

    Ambiguous or unrecognized wishes stay pending. Human-readable table names and
    movie night (a game-night-sized gathering) are accepted without another LLM call.
    """
    words = " " + " ".join(re.findall(r"[a-z0-9]+", wish.lower())) + " "
    matches = {
        key
        for key in TEMPLATES
        if key != "encouragement" and " " + key.replace("_", " ") + " " in words
    }
    if " movie night " in words:
        matches.add("game_night")
    return next(iter(matches)) if len(matches) == 1 else None


def with_bribes(proposal, pending, member_count):
    """Weight eligible requests against the proposed event, then cap its reward.

    Only an already-approved event action reaches this function. Bribes cannot
    bypass idle decisions, cooldowns, membership requirements, or table effects.
    """
    validate(proposal)
    if member_count < TEMPLATES[proposal.template_id]["people"]:
        raise ValueError("Not enough village members for template")
    grouped = {}
    for row in pending:
        key = requested_template(row["wish"])
        if key and member_count >= TEMPLATES[key]["people"]:
            grouped.setdefault(key, []).append(row)
    if not grouped:
        return proposal, []
    weights = {proposal.template_id: 1.0}
    for key, rows in grouped.items():
        # Aggregate influence is capped too, so splitting envelopes cannot evade it.
        weights[key] = weights.get(key, 0) + min(
            11.0, sum(float(row["selection_weight"]) for row in rows)
        )
    key = random.choices(list(weights), weights=list(weights.values()), k=1)[0]
    used = grouped.get(key, [])
    table = TEMPLATES[key]
    values = proposal.model_dump()
    if key != proposal.template_id:
        values.update(
            template_id=key,
            title=key.replace("_", " ").title(),
            body=f"Gather {table['people']} villager(s) for {key.replace('_', ' ')}: "
            f"plan an activity lasting at least {table['hours']} hours together.",
            reward_xp=table["xp"][0],
            penalty=table["penalty"],
        )
    values["reward_xp"] = min(
        table["xp"][1],
        values["reward_xp"] + min(100, sum(row["reward_bonus_xp"] for row in used)),
    )
    return TemplateProposal.model_validate(values), used
