import pytest
from pydantic import ValidationError

from app.domain import SEED_USERS, VILLAGE_ID
from app.house_options import OPTIONS
from app.models import ProfilePatch


@pytest.mark.parametrize(
    "field,group", [("house_variant", "variants"), ("house_materials", "materials")]
)
def test_every_registered_house_choice(field, group):
    for key, choices in OPTIONS[group].items():
        for choice in choices:
            assert getattr(ProfilePatch(**{field: {key: choice}}), field) == {key: choice}


@pytest.mark.parametrize(
    "payload",
    [
        {"house_variant": {"1": "tower"}},
        {"house_variant": {"2": "porch"}},
        {"house_variant": {"6": "classic"}},
        {"house_variant": {"1": "../porch"}},
        {"house_variant": {"01": "bay"}},
        {"house_variant": {"1": None}},
        {"house_variant": []},
        {"house_materials": {"wall": "metal"}},
        {"house_materials": {"roof": "wood"}},
        {"house_materials": {"extra": "wood"}},
        {"house_materials": {"door": 1}},
        {"house_materials": []},
    ],
)
def test_reject_invalid_house_options(payload):
    with pytest.raises(ValidationError):
        ProfilePatch(**payload)


async def test_persist_house_options_scope_patch_reset(api, outsider):
    client, _ = api
    vid, uid = str(VILLAGE_ID), str(SEED_USERS[0][0])
    options = {
        "house_variant": {"1": "porch", "3": "greenhouse"},
        "house_materials": {"wall": "brick", "roof": "metal"},
    }
    payload = {"village_id": vid, **options}
    assert (await client.patch("/api/me", json=options)).status_code == 422
    assert (await client.patch("/api/me", json=payload, headers=outsider)).status_code == 403
    assert (await client.patch("/api/me", json=payload)).status_code == 200
    village = (await client.get(f"/api/villages/{vid}")).json()
    own = next(p for p in village["villagers"] if p["user_id"] == uid)
    for key, value in options.items():
        assert own[key] == value
        assert all(p[key] is None for p in village["villagers"] if p["user_id"] != uid)
    assert (await client.patch("/api/me", json={"display_name": "Builder"})).status_code == 200
    profile = (await client.get(f"/api/villages/{vid}/users/{uid}")).json()
    assert profile["villager"]["house_variant"] == options["house_variant"]
    assert profile["villager"]["house_materials"] == options["house_materials"]
    # Membership settings never leak into a newly created village.
    other = (await client.post("/api/villages", json={"name": "Other home"})).json()["village"][
        "id"
    ]
    second = (await client.get(f"/api/villages/{other}")).json()["villagers"][0]
    assert second["house_variant"] is None and second["house_materials"] is None
    invalid = {**payload, "house_variant": {"1": "tower"}, "house_materials": {}}
    assert (await client.patch("/api/me", json=invalid)).status_code == 422
    profile = (await client.get(f"/api/villages/{vid}/users/{uid}")).json()
    assert profile["villager"]["house_materials"] == options["house_materials"]
    assert (
        await client.patch("/api/me", json={"village_id": vid, "house_variant": {}})
    ).status_code == 200
    profile = (await client.get(f"/api/villages/{vid}/users/{uid}")).json()
    assert profile["villager"]["house_variant"] == {}
    assert profile["villager"]["house_materials"] == options["house_materials"]
    reset = {"village_id": vid, "house_variant": None, "house_materials": None}
    assert (await client.patch("/api/me", json=reset)).status_code == 200
    profile = (await client.get(f"/api/villages/{vid}/users/{uid}")).json()
    assert profile["villager"]["house_variant"] is None
    assert profile["villager"]["house_materials"] is None
