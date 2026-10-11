"""Read only existing owner assets. Run in the API's Python environment (WSL).

VILLAGE_ENV_FILE is read at runtime; credentials are never logged or copied.
Only Iraj is selected. Outputs contain personal media and MUST remain ignored.
"""
import os, json, shutil, urllib.request
from pathlib import Path
from dotenv import dotenv_values
import psycopg

root = Path(__file__).resolve().parents[1]
out = root / 'public/captures'
out.mkdir(parents=True, exist_ok=True)
source = Path(os.environ.get('VILLAGE_SOURCE_ROOT', '/mnt/c/Users/mourn/Downloads/hacklanta'))
env = dotenv_values(os.environ.get('VILLAGE_ENV_FILE', str(source / '.env')))
uid = '13370000-0000-4000-8000-000000000001'
with psycopg.connect(env['DATABASE_URL'], hostaddr='127.0.0.1', connect_timeout=10, options='-c default_transaction_read_only=on') as conn:
    with conn.cursor() as cursor:
        cursor.execute('SELECT id,text,video_key FROM villagergrams WHERE speaker_id=%s AND video_key IS NOT NULL ORDER BY created_at LIMIT 1', (uid,))
        gram = cursor.fetchone()
        if not gram: raise RuntimeError('No cached Iraj talking clip; do not generate one')
        cursor.execute("SELECT input FROM avatar_jobs WHERE user_id=%s AND stage='segment' AND status='done' AND NOT (input ? 'kind') ORDER BY created_at DESC LIMIT 1", (uid,))
        segmentation = cursor.fetchone()

def fetch(key, name):
    assert '..' not in key and (key.startswith(f'avatars/{uid}/') or key == gram[2])
    req = urllib.request.Request('https://thefriendshipvillage.vodka/api/assets/' + key, headers={'X-Demo-User':uid})
    with urllib.request.urlopen(req, timeout=120) as response:
        (out/name).write_bytes(response.read())

fetch(gram[2], 'talk.mp4')
fetch(f'avatars/{uid}/face_512.png', 'face.png')
fetch(f'avatars/{uid}/segment/person_0/masks/person.png', 'mask.png')
fetch(f'avatars/{uid}/segment/person_0/full_body.png', 'segmented.png')
shutil.copyfile(source/'data/inputs/real/iraj.jpg', out/'photo.jpg')
shutil.copyfile(source/'data/inputs/voice/iraj/memo1.ogg', out/'memo.ogg')
(out/'iraj-source.json').write_text(json.dumps({'speaker':uid,'cached_gram':str(gram[0]),'line':gram[1],'video_key':gram[2],'photo':'data/inputs/real/iraj.jpg','memo':'data/inputs/voice/iraj/memo1.ogg','segmentation_input':segmentation[0] if segmentation else None,'generation_calls':0},indent=2))
print('Prepared consented Iraj photo, SAM mask, original memo and verified cached talking clip.')
