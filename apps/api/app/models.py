from enum import StrEnum
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.catalog_registry import load_catalog

# Only repository-vetted styles enter API enums and model instructions.
VOICE_STYLE_PROMPTS = {
    entry["id"].removeprefix("voice_"): entry["voice_style"]["prompt"]
    for entry in load_catalog().entries.values()
    if entry.get("voice_style", {}).get("supported") is True
}
VoiceStyle = StrEnum(
    "VoiceStyle", {value.upper(): value for value in VOICE_STYLE_PROMPTS}, module=__name__
)


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class HouseColors(Input):
    wall: Annotated[str, Field(pattern=r"^#[0-9a-f]{6}$")]
    roof: Annotated[str, Field(pattern=r"^#[0-9a-f]{6}$")]
    trim: Annotated[str, Field(pattern=r"^#[0-9a-f]{6}$")]
    door: Annotated[str, Field(pattern=r"^#[0-9a-f]{6}$")]
    accent: Annotated[str, Field(pattern=r"^#[0-9a-f]{6}$")]


class ProfilePatch(Input):
    idle_activity: Literal[
        "working_out", "gaming", "studying", "gardening", "dancing",
        "reading", "home", "food", "walk_pet"
    ] = "home"
    village_id: UUID | None = None
    house_style: Literal["cottage", "modern", "aframe", "tudor", "beach", "townhouse"] | None = None
    house_colors: HouseColors | None = None
    house_variant: dict[str, str] | None = None
    house_materials: dict[str, str] | None = None

    @field_validator("house_variant", "house_materials")
    @classmethod
    def valid_house_options(cls, value, info):
        from app.house_options import validate_options

        return validate_options(info.field_name, value)

    display_name: str = Field(default=None, min_length=1, max_length=100)
    phone_e164: str | None = Field(default=None, pattern=r"^\+[1-9][0-9]{6,14}$")
    roast_ok: bool = None
    agent_msgs_ok: bool = None
    allow_voice_by_friends: bool = None
    receive_villagergrams: bool = None


class CreateVillage(Input):
    name: str = Field(min_length=1, max_length=100)


class JoinVillage(Input):
    invite_code: str = Field(min_length=1, max_length=32)


class SetGoal(Input):
    title: str = Field(min_length=1, max_length=200)
    detail: str | None = Field(default=None, max_length=4000)


class CheckInInput(Input):
    repair_task: Literal['hangout', 'checkins', 'workout_together', 'study_session', 'cook_together', 'call_a_friend', 'help_a_neighbor'] | None = None
    stretch_tier: int | None = Field(default=None, ge=1, le=3)
    kind: Literal["status", "progress"]
    body: str = Field(min_length=1, max_length=4000)
    goal_id: UUID | None = None
    evidence_asset_id: str | None = Field(default=None, max_length=500)
    idempotency_key: str = Field(min_length=1, max_length=200)


class Purchase(Input):
    item_id: str = Field(min_length=1, max_length=100)


class Prayer(Input):
    text: str = Field(min_length=1, max_length=2000)


class Nudge(Input):
    target_user_id: UUID


class VoiceInput(Input):
    village_id: UUID | None = None
    user_id: UUID
    text: str = Field(min_length=1, max_length=1000)


class Inbound(Input):
    message_id: str | None = Field(default=None, min_length=1, max_length=500)
    phone_e164: str = Field(pattern=r"^\+[1-9]\d{6,14}$")
    text: str = Field(min_length=1, max_length=4000)


class MayorProposal(Input):
    kind: Literal["challenge", "recap", "random_event", "prayer_response"]
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=4000)
    reward_xp: int = Field(ge=0, le=500, strict=True)
    penalty: Literal["crater", "house_downgrade"] | None


class NudgeProposal(Input):
    text: str = Field(min_length=1, max_length=1000)


class EvidenceReview(Input):
    verdict: Literal["verified", "suspicious", "rejected", "error"]
    confidence: float = Field(ge=0, le=1, allow_inf_nan=False)
    reason: str = Field(min_length=1, max_length=2000)


class ReviewOverride(Input):
    reason: str = Field(min_length=1, max_length=2000)


class GoalStatus(Input):
    status: Literal["done", "missed"]


class EventCompletion(Input):
    user_ids: list[UUID] = Field(min_length=1, max_length=100)


class Sent(Input):
    provider_msg_id: str | None = Field(default=None, max_length=500)


class Failed(Input):
    error: str = Field(min_length=1, max_length=1000)


class MayorDecision(Input):
    action: Literal["nudge", "event", "weather", "none"]
    weather: Literal["clear", "rain", "fog", "festival_night"] | None = None
    target_user_id: UUID | None = None
    reason: str = Field(min_length=1, max_length=2000)
    event: MayorProposal | None = None
