import math

import pytest
from pydantic import ValidationError

from app.houses import Position


def test_interior_position():
    p = Position(type="movement", x=0, z=3.25, heading=math.pi, moving=False, running=False, floor=2)
    assert p.floor == 2
    assert p.running is False
    assert p.emote is None


@pytest.mark.parametrize("field,value", [
    ("x", float("nan")), ("z", float("inf")), ("x", 4),
    ("heading", 4), ("floor", 3), ("floor", 1.2), ("moving", "false"),
    ("running", "false"), ("emote", "invalid"),
])
def test_invalid_position(field, value):
    data = dict(type="movement", x=0, z=3, heading=0, moving=False, running=False, floor=0)
    data[field] = value
    with pytest.raises(ValidationError):
        Position.model_validate(data)


async def test_positions_are_ephemeral_authenticated_and_floor_bounded(api):
    import asyncio
    from fastapi.testclient import TestClient
    from app.domain import SEED_USERS, VILLAGE_ID
    from app.main import create_app
    from app.runtime import selector_loop

    _, app = api
    owner, visitor = str(SEED_USERS[0][0]), str(SEED_USERS[1][0])
    url = f"/api/houses/{owner}/live?vid={VILLAGE_ID}"

    def receive(ws, kind):
        for _ in range(30):
            event = ws.receive_json()
            if event["type"] == kind:
                return event
        raise AssertionError(f"Missing {kind}")

    def scenario():
        with TestClient(create_app(app.state.settings), backend_options={"loop_factory": selector_loop}) as http:
            with http.websocket_connect(url) as a, http.websocket_connect(url) as b:
                a.send_json({"X-Demo-User": owner})
                snapshot = receive(a, "snapshot")
                b.send_json({"X-Demo-User": visitor})
                assert receive(b, "snapshot")["can_edit"] is False
                message = dict(type="movement", x=1, z=2, heading=0, moving=True, running=False, floor=0, user_id=owner)
                b.send_json(message)
                event = receive(a, "movement")
                assert event["user_id"] == visitor
                assert event["x"] == 1
                # Excess messages are dropped; ping orders processing without a timing-sensitive sleep.
                for _ in range(8):
                    b.send_json(message)
                b.send_json({"type": "ping"})
                count = 0
                while True:
                    event = b.receive_json()
                    if event["type"] == "pong":
                        break
                    count += event["type"] == "movement"
                assert count <= 2
                b.send_json({**message, "floor": snapshot["floors"]})
                assert receive(b, "movement_rejected")["detail"] == "Invalid position"
                after = http.get(f"/api/houses/{owner}?vid={VILLAGE_ID}", headers={"X-Demo-User": owner}).json()
                assert after["seq"] == snapshot["seq"]
                b.send_json(dict(action="move_item", item_id="sofa", x=-1.75, z=-2, client_seq=1))
                assert "Only the house owner" in receive(b, "rejected")["detail"]

    await asyncio.wait_for(asyncio.to_thread(scenario), 30)
