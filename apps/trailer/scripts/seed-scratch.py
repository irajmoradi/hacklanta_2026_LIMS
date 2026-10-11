"""Install an existing generated plant and fixture pet only in a disposable runner DB."""
import os, shutil
from pathlib import Path
import psycopg
from psycopg.conninfo import conninfo_to_dict

dsn = os.environ['DATABASE_URL']
assert conninfo_to_dict(dsn).get('dbname', '').startswith('run_'), 'Scratch DB required'
root = Path(__file__).resolve().parents[3]
uid = '13370000-0000-4000-8000-000000000001'
vid = '13370000-0000-4000-8000-000000000000'
job = 'fe190000-0000-4000-8000-000000000001'
item = 'fe190000-0000-4000-8000-000000000002'
key = f'items/{uid}/{job}'
dest = Path(os.environ['ASSET_DIR']) / key
dest.mkdir(parents=True, exist_ok=True)
for source, target in [('plant.glb','object.glb'),('plant.png','preview.png')]:
    shutil.copyfile(root/'apps/trailer/public/captures'/source, dest/target)
with psycopg.connect(dsn) as conn:
    conn.execute('UPDATE village_members SET house_level=4 WHERE village_id=%s AND user_id=%s',(vid,uid))
    conn.execute("INSERT INTO avatar_jobs(id,user_id,stage,idem_key,input) VALUES(%s,%s,'segment','trailer-existing-plant','{}') ON CONFLICT DO NOTHING",(job,uid))
    conn.execute("INSERT INTO custom_items(id,village_id,owner,kind,slot,glb_url,preview,source_job) VALUES(%s,%s,%s,'object','decoration',%s,%s,%s) ON CONFLICT DO NOTHING",(item,vid,uid,f'/api/assets/{key}/object.glb',f'/api/assets/{key}/preview.png',job))
    conn.execute("UPDATE inventory SET equipped=false WHERE village_id=%s AND user_id=%s AND slot='pet'",(vid,uid))
    conn.execute("INSERT INTO inventory(village_id,user_id,item_id,equipped,slot) VALUES(%s,%s,'pet_dog',true,'pet') ON CONFLICT(village_id,user_id,item_id) DO UPDATE SET equipped=true",(vid,uid))
print('Scratch-only existing plant and fixture pet ready; no generation.')
