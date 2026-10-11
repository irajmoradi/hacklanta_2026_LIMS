"""Regression checks for corrupt assets and the kit's runtime-node contract."""
import json
from pathlib import Path
import struct
import tempfile
import unittest
from check_glb import MODELS, read, validate
from check_glb import values
import town_spec as town
import event_spec as events


class ValidatorTests(unittest.TestCase):
    def test_material_textures_cannot_reference_network(self):
        self.edited('house_cottage_lv1',lambda doc: doc['images'][0].update(uri='https://example.invalid/texture.png'),'textures must be embedded')

    def test_material_texture_source_must_exist(self):
        self.edited('house_cottage_lv1',lambda doc: doc['textures'][0].update(source=999),'invalid texture source')
    def test_nature_ground_anchor(self):
        def edit(doc):
            next(n for n in doc['nodes'] if 'mesh' in n)['translation']=[0,1,0]
        self.edited('nature_oak',edit,'nature root must be at ground level')

    def test_nature_single_mesh(self):
        def edit(doc):
            doc['nodes'].append(dict(next(n for n in doc['nodes'] if 'mesh' in n)))
        self.edited('nature_oak',edit,'nature must be a single mesh')

    def test_nature_budget(self):
        def edit(doc):
            doc['meshes'][0]['primitives'] *= 2
        self.edited('nature_tulips',edit,'nature budget exceeded')

    def test_nature_tint_names(self):
        self.edited('nature_oak',lambda doc: doc['materials'][0].update(name='unknown'),'unknown nature tint material')

    def test_plaza_budget_counts_instances(self):
        def edit(doc):
            node=next(n for n in doc['nodes'] if 'mesh' in n)
            doc['nodes'].extend([dict(node) for _ in range(1000)])
        self.edited('mayor_podium',edit,'exceeds 6000 budget')

    def test_plaza_ground_anchor(self):
        def edit(doc):
            for node in doc['nodes']:
                if 'mesh' in node:
                    t=node.setdefault('translation',[0,0,0]); t[1]+=1
        self.edited('notice_board',edit,'base must be at Y=0')

    def test_civic_identity_required(self):
        def edit(doc):
            next(n for n in doc['nodes'] if n.get('name')=='top_hat')['name']='missing'
        self.edited('mayor_statue',edit,'missing nodes')

    def test_event_inventory_and_catalog(self):
        entries=json.loads((Path(__file__).parent/'catalog_additions_004.json').read_text())['entries']
        self.assertEqual(len(entries),33)
        self.assertEqual({e['id'] for e in entries},set(events.NAMES))
        for pack,names in events.PACKS.items():
            self.assertTrue(4<=len(names)<=6)
            for name in names:
                entry=next(e for e in entries if e['id']==name)
                self.assertEqual(entry['tags'],['event_pack',pack])
                self.assertEqual(entry['kind'],'decoration')
                self.assertEqual(entry['asset']['glb'],'/models/'+name+'.glb')
                doc,_=read(MODELS/(name+'.glb'))
                self.assertEqual(set(entry['asset']['tint_materials']),{m['name'] for m in doc['materials']})
                validate(MODELS/(name+'.glb'))
        hat=next(e for e in entries if e['id']=='party_hat_villager')
        self.assertEqual(hat['slot'],'head')
        self.assertEqual(hat['asset']['attach'],{'bone':'Head','offset':[0,.68,0],'rotation':[0,0,0],'scale':1})

    def test_rain_hook_required(self):
        def edit(doc):
            next(n for n in doc['nodes'] if n.get('name')=='drops')['name']='missing'
        self.edited('cloud_rain',edit,'missing nodes')

    def test_rain_hook_not_empty(self):
        def edit(doc):
            next(n for n in doc['nodes'] if n.get('name')=='drops')['children']=[]
        self.edited('cloud_rain',edit,'empty animation node')

    def test_event_budget_counts_instances(self):
        def edit(doc):
            node=next(n for n in doc['nodes'] if 'mesh' in n)
            doc['nodes'].extend([dict(node) for _ in range(300)])
        self.edited('cake_giant',edit,'exceeds 2000 budget')

    def test_event_ground_anchor(self):
        def edit(doc):
            for node in doc['nodes']:
                if 'mesh' in node:
                    t=node.setdefault('translation',[0,0,0]); t[1]+=1
        self.edited('projector_screen',edit,'base must be at Y=0')

    def test_fx_card_transparency(self):
        def edit(doc):
            doc['materials'][0]['alphaMode']='OPAQUE'
        self.edited('fog_bank_card',edit,'double-sided alpha blend')

    def test_town_inventory_and_catalog(self):
        entries=json.loads((Path(__file__).parent/'catalog_additions.json').read_text())['entries']
        self.assertEqual(len(entries),48)
        self.assertEqual({e['id'] for e in entries},set(town.NAMES))
        for entry in entries:
            asset=entry['asset']
            self.assertEqual(asset['glb'],'/models/'+entry['id']+'.glb')
            doc,_=read(MODELS/(entry['id']+'.glb'))
            self.assertEqual(set(asset['tint_materials']),{m['name'] for m in doc['materials']})
            self.assertEqual(len(asset['attach']['offset']),3)
            self.assertEqual(len(asset['attach']['rotation']),3)
            self.assertEqual(len({'bone','anchor'} & asset['attach'].keys()),1)

    def test_clothing_bind_matches_villager(self):
        def bind(name):
            doc,binary=read(MODELS/(name+'.glb'))
            result={}
            for skin in doc['skins']:
                for j,m in zip(skin['joints'],values(doc,binary,skin['inverseBindMatrices'])):
                    result[doc['nodes'][j]['name']]=m
            return result
        reference=bind('villager_base')
        for name in town.SKINNED:
            garment=bind(name)
            self.assertEqual(garment.keys(),reference.keys())
            for joint,matrix in garment.items():
                for actual,expected in zip(matrix,reference[joint]):
                    self.assertAlmostEqual(actual,expected,places=5,msg=name+': '+joint)

    def test_bad_tile_size(self):
        def edit(doc):
            next(n for n in doc['nodes'] if n.get('name')=='tile')['scale']=[2,1,1]
        self.edited('road_cross',edit,'4 m square')

    def test_building_lot(self):
        def edit(doc):
            next(n for n in doc['nodes'] if n.get('name')=='foundation')['scale']=[3,1,1]
        self.edited('gym',edit,'8 m lot')

    def test_streetlight_hook(self):
        def edit(doc):
            next(n for n in doc['nodes'] if n.get('name')=='lamp')['name']='missing'
        self.edited('streetlight',edit,'missing nodes')

    def test_clothing_skin_required(self):
        def edit(doc):
            next(n for n in doc['nodes'] if 'mesh' in n).pop('skin')
        self.edited('shirt_tee',edit,'unskinned clothing')

    def edited(self, name, edit, expected):
        doc,binary=read(MODELS/(name+'.glb'))
        edit(doc)
        encoded=json.dumps(doc).encode()
        encoded+=b' '*(-len(encoded)%4)
        binary+=b'\0'*(-len(binary)%4)
        raw=struct.pack('<4sII',b'glTF',2,28+len(encoded)+len(binary))
        raw+=struct.pack('<II',len(encoded),0x4E4F534A)+encoded
        raw+=struct.pack('<II',len(binary),0x004E4942)+binary
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as folder:
            path=Path(folder)/(name+'.glb')
            path.write_bytes(raw)
            with self.assertRaisesRegex(AssertionError,expected):
                validate(path)

    def test_missing_animation_hook(self):
        def edit(doc):
            next(n for n in doc['nodes'] if n.get('name')=='wheel')['name']='wrong'
        self.edited('ferris_wheel',edit,'missing nodes')

    def test_empty_animation_hook(self):
        def edit(doc):
            next(n for n in doc['nodes'] if n.get('name')=='lamp_0')['children']=[]
        self.edited('stage_lights',edit,'empty animation node')

    def test_missing_tint_material(self):
        def edit(doc):
            next(m for m in doc['materials'] if m['name']=='jacket')['name']='wrong'
        self.edited('jacket_denim',edit,'missing materials')

    def test_accessor_overflow(self):
        self.edited('lake_patch',lambda d:d['accessors'][0].update(count=1000000),'accessor overflow')

    def test_wrong_strand_length(self):
        def edit(doc):
            for node in doc['nodes']:
                if 'translation' in node:
                    node['translation'][0]*=2
        self.edited('string_lights',edit,'10 m')

    def test_bad_ground_anchor(self):
        self.edited('lake_patch',lambda d:d['nodes'][0].update(translation=[0,1,0]),'base must')

    def test_triangle_budget(self):
        def edit(doc):
            for mesh in doc['meshes']:
                mesh['primitives']*=400
        self.edited('lake_patch',edit,'exceeds 8000')

    def test_external_buffer(self):
        self.edited('bird',lambda d:d['buffers'][0].update(uri='external.bin'),'external buffer')

    def test_wheel_and_gondola_pivots(self):
        doc,_=read(MODELS/'ferris_wheel.glb')
        nodes=doc['nodes']
        wheel=next(n for n in nodes if n.get('name')=='wheel')
        self.assertEqual(wheel['translation'],[0,3.25,0])
        children=[nodes[i] for i in wheel['children']]
        gondolas=[n for n in children if n.get('name','').startswith('gondola_')]
        self.assertEqual(len(gondolas),10)
        self.assertFalse(any(n.get('name','').startswith('support') for n in children))
        for node in gondolas:
            self.assertAlmostEqual(sum(v*v for v in node['translation']),2.5**2,places=5)


if __name__=='__main__':
    unittest.main()
