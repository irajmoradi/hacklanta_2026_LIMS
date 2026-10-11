import pytest
from pydantic import ValidationError

from app.domain import SEED_USERS, VILLAGE_ID
from app.models import ProfilePatch

COLORS = dict(wall="#f1d9ad", roof="#69566b", trim="#eee3c8", door="#487d6b", accent="#ca795d")


@pytest.mark.parametrize(
    "colors",
    [
        {**COLORS, "wall": "#FFFFFF"},
        {**COLORS, "wall": "red"},
        {**COLORS, "wall": "#fff"},
        {**COLORS, "roof": None},
        {"wall": "#ffffff"},
        {**COLORS, "extra": "#ffffff"},
    ],
)
def test_invalid_colors(colors):
    with pytest.raises(ValidationError):
        ProfilePatch(house_colors=colors)


def test_style_and_reset_validation():
    for style in ("cottage", "modern", "aframe", "tudor", "beach", "townhouse", None):
        assert ProfilePatch(house_style=style, house_colors=COLORS).house_style == style
    assert ProfilePatch(house_colors=None).house_colors is None
    with pytest.raises(ValidationError):
        ProfilePatch(house_style="castle")
    with pytest.raises(ValidationError):
        ProfilePatch(house_level=5)


async def test_house_patch_scope_payloads_and_reset(api, outsider):
    client, _ = api
    vid, uid = str(VILLAGE_ID), str(SEED_USERS[0][0])
    payload = dict(village_id=vid, house_style="beach", house_colors=COLORS)
    assert (await client.patch("/api/me", json=payload, headers=outsider)).status_code == 403
    assert (await client.patch("/api/me", json={"house_style": "beach"})).status_code == 422
    assert (await client.patch("/api/me", json=payload)).status_code == 200
    village = (await client.get(f"/api/villages/{vid}")).json()
    own = next(p for p in village["villagers"] if p["user_id"] == uid)
    assert own["house_style"] == "beach"
    assert own["house_colors"] == COLORS
    assert all(p["house_colors"] is None for p in village["villagers"] if p["user_id"] != uid)
    # An unrelated profile update must preserve the member's saved house.
    assert (await client.patch("/api/me", json={"display_name": "Home owner"})).status_code == 200
    village = (await client.get(f"/api/villages/{vid}")).json()
    assert next(p for p in village["villagers"] if p["user_id"] == uid)["house_colors"] == COLORS
    assert (
        await client.patch("/api/me", json={**payload, "house_style": None, "house_colors": None})
    ).status_code == 200
    village = (await client.get(f"/api/villages/{vid}")).json()
    own = next(p for p in village["villagers"] if p["user_id"] == uid)
    assert own["house_style"] is None and own["house_colors"] is None
