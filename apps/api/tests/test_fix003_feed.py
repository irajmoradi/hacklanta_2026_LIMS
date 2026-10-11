import pytest

from app.domain import feed_text


@pytest.mark.parametrize(
    "payload,name,expected",
    [
        ({"agent": "mayor", "action": "none", "reason": "Everyone checked in"},
         None, "[AI Mayor] none: Everyone checked in"),
        ({"agent": "auditor", "action": "weekly_pregrade", "reason": "Evidence verified"},
         "Lance", "[AI Auditor] weekly pregrade for Lance: Evidence verified"),
        ({"agent": "budget", "action": "throttled"}, None, "[AI Budget] throttled."),
        ({}, None, "[AI Mayor] reviewed village activity."),
    ],
)
def test_agent_summary(payload, name, expected):
    assert feed_text({"type": "agent_decision", "payload": payload,
                      "display_name": name}) == expected


def test_friend_activity_is_unchanged():
    assert feed_text({"type": "checkin", "display_name": "Maya",
                      "payload": {"body": "A short walk"}}) == "Maya checked in: A short walk"
