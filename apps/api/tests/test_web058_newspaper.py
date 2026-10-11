from app.newspaper import normalize_copy, normalize_content
from app import newspaper
import pytest


def test_joined_sentences_and_contractions():
    assert normalize_copy("Hello everyone.iraj is here!Welcome. It'S What'S We'Ll We’Re") == (
        "Hello everyone. Iraj is here! Welcome. It's What's We'll We’re"
    )


def test_links_decimals_and_abbreviations_are_preserved():
    text = "https://example.org/a.b iraj@example.com example.com 3.14 U.S. Dr. Smith"
    assert normalize_copy(text) == text


def test_copy_only_prose_and_keep_source_metadata():
    original = {"headline": "It'S here", "body": "everyone.iraj", "weather": "It's sunny.",
                "stories": [{"text": "everyone.iraj", "source_id": "everyone.iraj"}],
                "gossip": {"text": "We'Ll see", "target_user_id": None}}
    result = normalize_content(original)
    assert result["body"] == "Everyone. Iraj"
    assert result["stories"][0] == {"text": "Everyone. Iraj", "source_id": "everyone.iraj"}
    assert result["gossip"]["text"] == "We'll see"
    assert original["gossip"]["text"] == "We'Ll see"
    assert normalize_content(result) == result


@pytest.mark.asyncio
async def test_historical_projection_repairs_copy_without_changing_stored_issue():
    row = {"id": "edition", "content": {"headline": "It'S here", "body": "everyone.iraj",
           "stories": [], "gossip": {"target_user_id": None, "text": "We'Ll see"}}}
    projected = await newspaper.project(None, "village", row)
    assert projected["content"]["body"] == "Everyone. Iraj"
    assert projected["content"]["gossip"]["text"] == "We'll see"
    assert row["content"]["body"] == "everyone.iraj"


def test_qa15_sentence_and_roster_casing_for_future_editions():
    original = {"body": "hello everyone.iraj is powering ahead with mckenzie!welcome.",
                "stories": [{"text": "with iraj", "source_id": "iraj"}]}
    result = normalize_content(original, ["iraj", "McKenzie"])
    assert result["body"] == "Hello everyone. Iraj is powering ahead with McKenzie! Welcome."
    assert result["stories"][0] == {"text": "With Iraj", "source_id": "iraj"}
    assert original["body"].startswith("hello")
    assert normalize_content(result, ["iraj", "McKenzie"]) == result
