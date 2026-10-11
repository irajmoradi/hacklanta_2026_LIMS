"""Bounded public repair proposals; no rewards or world mutations."""

import re
from dataclasses import replace
from typing import Literal

from pydantic import Field, model_validator

from app.models import Input

TaskKind = Literal[
    'hangout', 'checkins', 'workout_together', 'study_session',
    'cook_together', 'call_a_friend', 'help_a_neighbor',
]


# Real-life actions people actually do (R-184); the Mayor picks which and how many, never the wording.
IRL_TITLES = {
    'hangout': 'Hang out with someone for 30 min (in person or on a voice call)',
    'call_a_friend': 'Call a friend for 30 min',
    'workout_together': 'Exercise for 30 min',
    'study_session': 'Read a news article or study for 30 min',
    'cook_together': 'Cook or share a meal with someone',
    'help_a_neighbor': 'Do something kind for someone IRL',
    'checkins': 'Share a photo of what you did today',
}


class RepairTask(Input):
    kind: TaskKind
    title: str = Field(min_length=1, max_length=100)
    target: int = Field(ge=1, le=6, strict=True)


class RepairPlan(Input):
    tasks: list[RepairTask] = Field(min_length=2, max_length=3)
    reasoning: str = Field(min_length=20, max_length=800)

    @model_validator(mode='after')
    def unique(self):
        if len({task.kind for task in self.tasks}) != len(self.tasks):
            raise ValueError('Choose distinct tasks')
        sentences = re.findall(r"[^.!?]+[.!?](?:\s|$)", self.reasoning)
        if not 2 <= len(sentences) <= 4:
            raise ValueError("Use 2-4 sentences for the public rationale")
        return self


class LabRepairInput(Input):
    kind: Literal['scorch', 'outbreak', 'blackout', 'blight']


def example(kind, recent=0):
    second = {'scorch': 'workout_together', 'outbreak': 'hangout', 'blackout': 'call_a_friend',
              'blight': 'study_session'}[kind]
    return RepairPlan(
        tasks=[
            RepairTask(kind='checkins', title=IRL_TITLES['checkins'], target=2),
            RepairTask(kind=second, title=IRL_TITLES[second], target=1),
        ],
        reasoning=(f'The group shared {recent} recent updates. Real-life time together is what '
                   f'repairs the village after the {kind}, so each task is something you do offline.'),
    )


async def choose_plan(kind, recent, settings=None, *, stateless=False):
    from app import budget
    from app.mayor import Mayor

    plan, model = example(kind, recent), 'example (offline or capped)'
    if settings is not None:
        token = budget.stateless_context.set(stateless)
        try:
            provider_settings = (
                replace(settings, llm_provider="gemini")
                if hasattr(settings, "llm_provider") else settings
            )
            adapter = Mayor(provider_settings)
            proposed = await adapter.generate(
                RepairPlan,
                'Pick 2–3 distinct repair tasks: real-life things friends do offline (hang out, call a '
                'friend, exercise, read or study, cook together, help someone). Each task kind already '
                'has a fixed real-world title; choose kinds and targets only. Targets count verified '
                'photo check-ins, not rewards. Write a public rationale in 2–4 short sentences about why '
                'these real-life activities fit this group right now, based only on the supplied activity '
                'counts. No in-game chores, no fantasy, no private reasoning, no invented facts.',
                {'disaster': kind, 'recent_checkins': recent, 'mayor_memory': {}},
            )
            plan = RepairPlan.model_validate(proposed.model_dump())
            model = adapter.last_source
        except Exception:
            pass  # Invalid, offline and capped proposals always retain the bounded example.
        finally:
            budget.stateless_context.reset(token)
    return {
        **plan.model_dump(),
        'tasks': [{**t.model_dump(), 'title': IRL_TITLES[t.kind], 'progress': 0} for t in plan.tasks],
        'model': model, 'example': model.startswith('example'),
    }
