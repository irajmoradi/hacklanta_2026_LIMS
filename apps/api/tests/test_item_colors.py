import pytest
from conftest import VID
from pydantic import ValidationError

from app.domain import SEED_USERS
from app.item_colors import ColorUpdate


@pytest.mark.parametrize(
    "colors",
    [
        {},
        {"primary": "red"},
        {"primary": "#123"},
        {"primary": "#12345678"},
        {"primary": "#123456", "skin": "#ffffff"},
        {"primary": 123456},
        {"primary": "#123456", "accent": "url(evil)"},
    ],
)
def test_invalid_colors(colors):
    with pytest.raises(ValidationError):
        ColorUpdate(colors=colors)


async def test_owner_colors_persist_and_are_public(api, outsider):
    client, app = api
    path = f"/api/villages/{VID}"
    assert (
        await client.post(path + "/shop/buy", json={"item_id": "hat_beanie"})
    ).status_code == 200
    url = path + "/inventory/hat_beanie/colors"
    colors = {"primary": "#AABBCC", "secondary": "#123456", "accent": "#654321"}
    response = await client.patch(url, json={"colors": colors})
    assert response.status_code == 200, response.text
    colors["primary"] = "#aabbcc"
    assert response.json()["colors"] == colors
    assert (await client.patch(url, json={"colors": colors}, headers=outsider)).status_code == 403
    peer = {"X-Demo-User": str(SEED_USERS[1][0])}
    assert (await client.patch(url, json={"colors": colors}, headers=peer)).status_code == 404
    assert (await client.patch(url, json={"colors": {"primary": "#oops"}})).status_code == 422
    for action in ("unequip", "equip"):
        assert (
            await client.post(path + "/inventory/" + action, json={"item_id": "hat_beanie"})
        ).status_code == 200
    village = (await client.get(path, headers=peer)).json()
    owner = next(p for p in village["villagers"] if p["user_id"] == str(SEED_USERS[0][0]))
    assert next(i for i in owner["equipped"] if i["item_id"] == "hat_beanie")["colors"] == colors
    shop = (await client.get(path + "/shop")).json()
    assert next(i for i in shop["items"] if i["id"] == "hat_beanie")["colors"] == colors
    # A replacement palette resets omitted channels to authored material defaults.
    response = await client.patch(url, json={"colors": {"primary": "#112233"}})
    assert response.json()["colors"] == {"primary": "#112233"}
    assert (
        await client.patch(path + "/inventory/voice_hype_coach/colors", json={"colors": colors})
    ).status_code == 404
