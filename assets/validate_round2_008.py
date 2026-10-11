"""Validate delivered designs, PBR maps, variants, attachments and thumbnail budgets."""
import json,io
from pathlib import Path
from PIL import Image
from check_glb import read,validate,bounds,values
ROOT=Path(__file__).resolve().parents[1]; MODELS=ROOT/'apps/web/public/models'
FEATURES={
 'shirt_hoodie':{'sleeve','hood','hood_back','kangaroo_pocket','drawstring','knit_rib'},
 'jacket_denim':{'sleeve','collar','chest_pocket','button','pocket_stitch'},
 'perfect_week_halo':{'halo'},'competition_laurels':{'laurel_leaf','leaf_vein','stem'},
 'mayor_medal':{'ribbon','gold_disc','sun'},'auditor_badge':{'badge_plate','check','badge_clip'},
 'champion_mantle':{'pleated_cape','clasp','gold_hem'},'streak_flame_scarf':{'neck_wrap','flame_trim','knit_rib'},
 'pet_dog':{'floppy_ear','tail','eye_glint','cheek_tuft','tongue'},
 'pet_dog_b':{'ear','tail','eye_glint','cheek_tuft','tongue'},
}
def main():
    catalog=json.loads((ROOT/'packages/catalog/catalog.json').read_text())['entries']; by_id={e['id']:e for e in catalog}
    variants=[e for e in catalog if 'house_variants_008' in e.get('tags',[])]
    assert len(variants)==60
    for entry in variants:
        path=MODELS/(entry['id']+'.glb');validate(path);doc,data=read(path)
        assert path.stat().st_size<2_000_000, (entry['id'],'2MB size budget')
        mats={m['name']:m for m in doc['materials']}
        assert {'wall','roof','trim','door','accent'}<=mats.keys()
        assert 'baseColorTexture' in mats['wall']['pbrMetallicRoughness']
        assert len(doc.get('images',[]))>=3
        for image in doc['images']:
            view=doc['bufferViews'][image['bufferView']];start=view.get('byteOffset',0)
            with Image.open(io.BytesIO(data[start:start+view['byteLength']])) as texture:
                assert texture.size==(128,128)
                assert all(r==g==b for r,g,b in texture.convert('RGB').getdata()),(entry['id'],'texture contains baked paint')
        assert abs(bounds(doc,data)[0][1])<.001
        feature=entry['id'].split('_')[-1]
        assert any(n.get('name','').startswith(feature+'_') for n in doc['nodes'])
    for name,features in FEATURES.items():
        path=MODELS/(name+'.glb');validate(path);doc,data=read(path)
        assert path.stat().st_size<1_000_000,(name,'1MB size budget')
        nodes={n['name'].split('.')[0] for n in doc['nodes']}
        assert features<=nodes,(name,features-nodes)
        if name in ('shirt_hoodie','jacket_denim'):
            assert doc.get('skins')
            assert all('skin' in n for n in doc['nodes'] if 'mesh' in n)
            for mesh in doc['meshes']:
                for p in mesh['primitives']:
                    assert all(abs(sum(w)-1)<.0001 for w in values(doc,data,p['attributes']['WEIGHTS_0']))
        if name in ('mayor_medal','auditor_badge','perfect_week_halo'):
            assert any(.6<=m['pbrMetallicRoughness'].get('metallicFactor',1)<=.9 for m in doc['materials'])
        if name=='perfect_week_halo': assert any(max(m.get('emissiveFactor',[0]))>0 for m in doc['materials'])
        if name not in ('pet_dog','pet_dog_b'):
            assert by_id[name]['asset']['glb']==f'/models/{name}.glb'
    # Only the 29 authored shop cards and 60 variants belong to this art pass.
    art_ids = {path.stem for path in (ROOT/'assets/previews/round2_before').glob('*.png')}
    assert len(art_ids) == 29
    thumbs=[e for e in catalog if e in variants or e['id'] in art_ids]
    assert len(thumbs) == 89
    for entry in thumbs:
        with Image.open(ROOT/'apps/web/public/thumbs'/(entry['id']+'.png')) as image:
            assert image.size==(512,512) and image.mode=='RGBA',entry['id']
            assert image.getchannel('A').getextrema()==(0,255),entry['id']
    print(f'60 variants, 10 rebuilt designs, {len(thumbs)} thumbnails; PBR, feature, rig and size checks; 0 failures')
if __name__=='__main__':main()
