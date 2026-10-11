"""One authorized request each: OpenRouter JSON and Gemini synthetic-image vision."""

import argparse
import asyncio
import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from PIL import Image, ImageDraw  # noqa: E402

from app.auditor import vision  # noqa: E402
from app.config import Settings  # noqa: E402
from app.mayor import Mayor  # noqa: E402
from app.models import NudgeProposal  # noqa: E402
from app.runtime import selector_loop  # noqa: E402


async def smoke():
    settings = Settings.from_env()
    ok = True
    try:
        await Mayor(settings).openrouter(
            NudgeProposal, "Return a brief friendly greeting as JSON.", {}
        )
        print("OpenRouter JSON: SUCCESS (schema validated)")
    except Exception as exc:
        print(f"OpenRouter JSON: FAILED ({type(exc).__name__})")
        ok = False
    image = Image.new("RGB", (320, 240), "white")
    ImageDraw.Draw(image).rectangle((60, 40, 260, 200), fill="red")
    output = io.BytesIO()
    image.save(output, format="PNG")
    try:
        review = await vision(
            settings,
            output.getvalue(),
            "image/png",
            {"goal": "Draw a red rectangle on white paper", "check_in": "I drew a red rectangle."},
        )
        print(f"Gemini vision: SUCCESS (schema validated; verdict={review.verdict})")
    except Exception as exc:
        print(f"Gemini vision: FAILED ({type(exc).__name__})")
        ok = False
    return 0 if ok else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--allow-paid", action="store_true", required=True)
    parser.parse_args()
    sys.exit(asyncio.run(smoke(), loop_factory=selector_loop))
