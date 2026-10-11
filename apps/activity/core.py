from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class Account:
    user_id: str
    external_id: str
    consent_at: datetime


@dataclass(frozen=True)
class Signal:
    kind: str
    title: str
    minutes: float
    started_at: datetime


class Sessions:
    """Observed time only; one activity per user/kind/title across all Discord guilds."""

    def __init__(self, repository):
        self.repository = repository
        self.active = {}

    async def reconcile(self, observed, now):
        accounts = {a.external_id: a for a in await self.repository.accounts("discord")}
        desired = {}
        for external_id, activities in observed.items():
            account = accounts.get(external_id)
            if account:
                for kind, title in activities:
                    key = (account, kind, title[:256])
                    desired[key] = self.active.get(key, now)
        for (account, kind, title), started in list(self.active.items()):
            if (account, kind, title) not in desired and accounts.get(
                account.external_id
            ) == account:
                minutes = (now - started).total_seconds() / 60
                if minutes > 0:
                    await self.repository.record(
                        account, "discord", Signal(kind, title, minutes, started)
                    )
                self.active.pop((account, kind, title), None)
        self.active = desired

    def disconnect(self):
        # Unknown offline intervals must never be attributed as observed activity.
        self.active.clear()


def summary(name, signal):
    duration = f"{signal.minutes / 60:g}h" if signal.minutes >= 60 else f"{signal.minutes:g}m"
    verb = {"playing": "played", "listening": "listened to", "voice": "was in", "online": "was"}[
        signal.kind
    ]
    return f"{name} {verb} {signal.title} for {duration}"
