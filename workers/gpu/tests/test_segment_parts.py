"""Unit tests for segment.pick_part_mask (no GPU / SAM 3 needed).
Run: python -m uv run --with numpy --with pillow --with pytest pytest workers/gpu/tests -q
"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from segment import PART_PROMPTS, pick_part_mask  # noqa: E402

H, W = 40, 40
PERSON = np.zeros((H, W), bool)
PERSON[5:35, 5:35] = True


def m(y0, y1, x0, x1):
    a = np.zeros((H, W), bool)
    a[y0:y1, x0:x1] = True
    return a


def cand(prompt, masks, scores):
    masks = np.stack(masks) if masks else np.zeros((0, H, W), bool)
    return (prompt, masks, np.zeros((len(scores), 4)), np.array(scores, dtype=float))


def test_shirt_prompt_order():
    assert PART_PROMPTS["shirt"] == ["shirt", "hoodie", "jacket", "sweater", "coat", "top"]


def test_falls_back_when_shirt_finds_nothing():
    """The R-23 case: 'shirt' returns no instance on a hoodie selfie; 'hoodie' wins."""
    got = pick_part_mask([cand("shirt", [], []), cand("hoodie", [m(20, 35, 5, 35)], [0.71]),
                          cand("jacket", [], [])], PERSON)
    assert got is not None and got[3] == "hoodie" and abs(got[1] - 0.71) < 1e-9


def test_keeps_best_scoring_prompt():
    got = pick_part_mask([cand("shirt", [m(20, 30, 10, 30)], [0.42]), cand("hoodie", [m(18, 35, 5, 35)], [0.88]),
                          cand("coat", [m(18, 35, 5, 35)], [0.60])], PERSON)
    assert got[3] == "hoodie"


def test_mask_restricted_to_person_and_tiny_masks_ignored():
    outside = m(0, 4, 0, 40)  # entirely outside the person -> 0 px after restriction
    got = pick_part_mask([cand("shirt", [outside], [0.99]), cand("top", [m(20, 30, 10, 30)], [0.35])], PERSON)
    assert got[3] == "top"
    assert not (got[0] & ~PERSON).any()


def test_union_of_instances_vs_single():
    a, b = m(30, 35, 6, 12), m(30, 35, 20, 26)  # two shoes
    union = pick_part_mask([cand("shoes", [a, b], [0.5, 0.8])], PERSON)
    assert union[0].sum() == a.sum() + b.sum() and union[2] is None
    single = pick_part_mask([cand("face", [a, b], [0.5, 0.8])], PERSON, single=True)
    assert single[0].sum() == b.sum() and abs(single[1] - 0.8) < 1e-9


def test_nothing_found_returns_none():
    assert pick_part_mask([cand("shirt", [], []), cand("hoodie", [m(0, 2, 0, 2)], [0.9])], PERSON) is None
