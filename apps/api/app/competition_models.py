from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, model_validator

from app.models import Input


class Grade(Input):
    ambition: int = Field(ge=1, le=5, strict=True)
    evidence_quality: int = Field(ge=1, le=5, strict=True)
    progress: int = Field(ge=1, le=5, strict=True)
    completed: bool
    rationale: str = Field(min_length=1, max_length=2000)


class Vote(Input):
    generation: int = Field(ge=1)


class CompetitionCreate(Input):
    payout_mode: Literal["winner_take_all", "proportional", "ranked"] = "winner_take_all"
    ranked_bps: list[Annotated[int, Field(strict=True, gt=0, le=10000)]] = Field(
        default_factory=list, max_length=10
    )
    entry_coins: int = Field(default=0, ge=0, le=1000000, strict=True)
    deadline: datetime | None = None
    scoring: Literal["cumulative", "scoreboard", "ordinal"] = "cumulative"
    unit: str | None = Field(default=None, min_length=1, max_length=40)
    target: float | None = Field(default=None, gt=0, le=1e12, allow_inf_nan=False)
    title: str = Field(min_length=1, max_length=200)
    terms: str = Field(min_length=1, max_length=4000)
    friendly: bool = False
    auditor_id: UUID | None = None
    entry_lamports: int = Field(default=0, ge=0, le=1000000000000, strict=True)
    auditor_fee_bps: int = Field(default=0, ge=0, le=10000, strict=True)

    @model_validator(mode="after")
    def terms_consistent(self):
        if self.payout_mode == "ranked":
            if (
                not self.ranked_bps
                or any(type(v) is not int or v <= 0 for v in self.ranked_bps)
                or sum(self.ranked_bps) != 10000
            ):
                raise ValueError("Ranked split needs 1-10 positive places totaling 10000 bps")
        elif self.ranked_bps:
            raise ValueError("Only ranked mode accepts a split")
        if self.deadline and self.deadline.tzinfo is None:
            raise ValueError("Deadline must include a timezone")
        if self.entry_lamports and (
            self.entry_coins or not self.deadline or self.deadline.tzinfo is None
        ):
            raise ValueError(
                "SOL competitions need a timezone-aware deadline and cannot stake coins"
            )
        if self.entry_lamports and self.auditor_fee_bps > 2000:
            raise ValueError("SOL auditor fee cannot exceed 20%")
        if self.friendly and self.entry_coins:
            raise ValueError("Friendly competitions cannot stake coins")
        if self.friendly and (self.auditor_id or self.entry_lamports or self.auditor_fee_bps):
            raise ValueError("Friendly mode has no auditor, stakes, or fees")
        if self.unit is not None:
            self.unit = self.unit.strip()
            if not self.unit:
                raise ValueError("Unit cannot be blank")
        if self.scoring == "scoreboard" and not self.unit:
            raise ValueError("Scoreboard requires a unit")
        if self.scoring == "cumulative" and (self.unit or self.target is not None):
            raise ValueError("Cumulative uses points without a target")
        return self


class Entry(Input):
    value: float | None = Field(default=None, ge=0, le=1e12, allow_inf_nan=False)
    body: str = Field(min_length=1, max_length=4000)
    evidence_asset_id: str | None = Field(default=None, max_length=500)
    idempotency_key: str = Field(min_length=1, max_length=200)


class EntryDecision(Input):
    value: float | None = Field(default=None, ge=0, le=1e12, allow_inf_nan=False)
    decision: Literal["confirmed", "rejected"]
    points: int = Field(ge=0, le=500, strict=True)
    reason: str = Field(min_length=1, max_length=2000)

    @model_validator(mode="after")
    def rejected_points(self):
        if self.decision == "rejected" and (self.points or self.value):
            raise ValueError("Rejected entries receive zero points")
        return self
