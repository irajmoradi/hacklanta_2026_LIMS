"""Explicit paid operation. Resume with the same command; cached clips cost nothing."""

import argparse
import asyncio
import json
import sys
from pathlib import Path
from uuid import UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.barks import generate
from app.config import Settings
from app.db import make_pool
from app.runtime import selector_loop


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--village", type=UUID, required=True)
    parser.add_argument("--max", type=int, required=True, dest="maximum")
    args = parser.parse_args()
    if not 0 <= args.maximum <= 1000:
        parser.error("--max must be between 0 and 1000")
    settings = Settings.from_env()
    async with make_pool(settings) as pool:
        print(json.dumps(await generate(pool, settings, args.village, args.maximum)))


if __name__ == "__main__":
    asyncio.run(main(), loop_factory=selector_loop)
