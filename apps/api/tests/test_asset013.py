from conftest import VID
from app.catalog_registry import load_catalog


def test_new_slots_and_locks():
    registry = load_catalog()
    items = [e for e in registry.entries.values() if 'asset013' in e.get('tags', [])]
    assert len(items) == 19
    for slot, count in [('bottoms', 6), ('shoes', 6), ('face', 7)]:
        assert sum(e['slot'] == slot for e in items) == count
    assert registry.missing_requirements('bottoms_overalls', village_level=1)
    assert not registry.missing_requirements('bottoms_overalls', village_level=2, unlocked=['fitness_corner'])


async def test_buy_equip_replace_color_and_unequip_lower_body(api):
    client, _ = api
    path = f'/api/villages/{VID}'
    for ident in ['bottoms_jeans', 'footwear_sneakers', 'eyewear_round_wire', 'bottoms_chinos']:
        response = await client.post(path+'/shop/buy', json={'item_id':ident})
        assert response.status_code == 200, response.text
    colors = {'primary':'#8876a8', 'secondary':'#ffe4a1', 'accent':'#689b68'}
    response = await client.patch(path+'/inventory/bottoms_chinos/colors', json={'colors':colors})
    assert response.status_code == 200, response.text
    response = await client.post(path+'/inventory/equip', json={'item_id':'bottoms_chinos'})
    equipped = {e['slot']:e for e in response.json()['equipped']}
    assert equipped['bottoms']['item_id'] == 'bottoms_chinos'
    assert equipped['bottoms']['colors'] == colors
    assert equipped['shoes']['item_id'] == 'footwear_sneakers'
    assert equipped['face']['item_id'] == 'eyewear_round_wire'
    response = await client.post(path+'/inventory/unequip', json={'item_id':'bottoms_chinos'})
    assert response.status_code == 200
    assert not any(e['slot']=='bottoms' for e in response.json()['equipped'])
