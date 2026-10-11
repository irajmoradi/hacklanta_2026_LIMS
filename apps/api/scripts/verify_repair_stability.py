"""Run five full API suites in fresh processes with reproducibly shuffled order.

From apps/api: python -m scripts.verify_repair_stability
Uses the normal test fixtures and VILLAGE_ENV_FILE; no extra pytest plugin needed.
"""

import argparse
import random
import subprocess
import sys
from pathlib import Path

import pytest


class Shuffle:
    def __init__(self, seed):
        self.seed = seed

    @pytest.hookimpl(trylast=True)
    def pytest_collection_modifyitems(self, items):
        random.Random(self.seed).shuffle(items)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, help="Run one full suite with this shuffle seed")
    args = parser.parse_args()
    if args.seed is not None:
        return pytest.main(["-q", "--tb=short"], plugins=[Shuffle(args.seed)])
    for seed in range(18, 23):
        print(f"Full API suite: shuffle seed {seed}", flush=True)
        result = subprocess.run(
            [sys.executable, "-m", "scripts.verify_repair_stability", "--seed", str(seed)],
            cwd=Path(__file__).resolve().parents[1],
            check=False,
        )
        print(f"Shuffle seed {seed}: exit {result.returncode}", flush=True)
        if result.returncode:
            return result.returncode
    return 0


if __name__ == "__main__":
    sys.exit(main())
