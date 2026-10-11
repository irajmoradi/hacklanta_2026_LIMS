"""Five explicit synthetic DeepSeek trials; no DB writes or Gemini fallback."""

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.config import Settings  # noqa: E402
from app.mayor import Mayor  # noqa: E402
from app.models import MayorProposal, NudgeProposal  # noqa: E402
from app.runtime import selector_loop  # noqa: E402


async def main():
    settings = Settings.from_env()
    successes = 0
    for i, mode in enumerate(("pray", "recap", "nudge", "pray", "recap"), 1):
        instruction = {
            "pray": "Respond to the prayer with a small challenge or prayer_response.",
            "recap": "Write a recap naming Alex and Sam; kind must be recap, "
            "reward_xp=0 and penalty=null.",
            "nudge": "Encourage Sam briefly as Alex, kindly with no sarcasm.",
        }[mode]
        try:
            proposal = await Mayor(settings).openrouter(
                NudgeProposal if mode == "nudge" else MayorProposal,
                instruction,
                {
                    "villagers": [{"display_name": "Alex"}, {"display_name": "Sam"}],
                    "goals": [{"user": "Alex", "title": "Read a chapter"}],
                    "check_ins": [{"user": "Sam", "body": "Practiced drawing"}],
                    "prayer": "Suggest one tiny step today.",
                },
            )
            if mode == "recap":
                assert proposal.kind == "recap" and proposal.reward_xp == 0
                assert proposal.penalty is None
                assert all(name in proposal.body for name in ("Alex", "Sam"))
            successes += 1
            print(f"Trial {i} {mode}: SUCCESS", flush=True)
        except Exception as exc:
            print(f"Trial {i} {mode}: FAILED ({type(exc).__name__})", flush=True)
    print(f"DeepSeek schema + mode success: {successes}/5 ({successes * 20}%)")
    return int(successes != 5)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--allow-paid", action="store_true", required=True)
    parser.parse_args()
    sys.exit(asyncio.run(main(), loop_factory=selector_loop))
