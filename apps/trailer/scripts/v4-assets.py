"""Read consented owner data in a DB-enforced read-only transaction. No generation."""
import json, os, re, urllib.request, shutil
from pathlib import Path
import psycopg
from dotenv import dotenv_values

out = Path(__file__).resolve().parents[1] / 'public/captures'
out.mkdir(parents=True, exist_ok=True)
env_path = os.environ['VILLAGE_ENV_FILE']
env_path = re.sub(r'^/([a-zA-Z])/', r'\1:/', env_path) if os.name == 'nt' else env_path
env = dotenv_values(env_path, interpolate=False)
uid = '13370000-0000-4000-8000-000000000001'
def redact(text):
    return re.sub(r'[\w.+-]+@[\w.-]+\.[a-z]{2,}|\+?\d[\d ()-]{8,}\d', '[private]', text, flags=re.I)
with psycopg.connect(env['DATABASE_URL'], hostaddr='127.0.0.1', connect_timeout=10, options='-c default_transaction_read_only=on') as conn:
    rows = conn.execute("SELECT id,text,kind,sent_at,video_key FROM mayor_outbox WHERE user_id=%s AND status='sent' ORDER BY sent_at DESC LIMIT 20", (uid,)).fetchall()
    messages = [dict(id=str(r[0]), text=redact(r[1]), kind=r[2], sent_at=str(r[3]), has_video=bool(r[4])) for r in rows]
    objects = conn.execute("SELECT c.id,c.glb_url,c.preview,j.stage,j.status FROM custom_items c JOIN avatar_jobs j ON j.id=c.source_job WHERE c.kind='object' ORDER BY c.created_at DESC LIMIT 10").fetchall()
    avatar = conn.execute("SELECT result FROM avatar_jobs WHERE user_id=%s AND status='done' ORDER BY created_at DESC LIMIT 10", (uid,)).fetchall()
    body = conn.execute("SELECT result FROM avatar_jobs WHERE user_id=%s AND stage='body' AND status='done' ORDER BY created_at DESC LIMIT 1", (uid,)).fetchone()
(out/'imessage.json').write_text(json.dumps({'source':'mayor_outbox', 'status':'sent', 'messages':messages}, indent=2))
(out/'objects.json').write_text(json.dumps([dict(id=str(r[0]),glb_url=r[1],preview=r[2],stage=r[3],status=r[4]) for r in objects], indent=2))
(out/'avatar-outputs.json').write_text(json.dumps([r[0] for r in avatar], indent=2, default=str))
(out/'body-traits.json').write_text(json.dumps(body[0] if body else {}, indent=2, default=str))
display = next(m for m in messages if m['has_video'] and m['kind']=='villagergram')
inputs = Path(__file__).resolve().parents[3] / 'docs/devpost/video/input'
recordings = sorted(inputs.glob('imessage-*.mp4')) + sorted(inputs.glob('imessage-*.png'))
if recordings:
    chosen = recordings[0]
    display['media'] = 'captures/imessage-owner' + chosen.suffix
    shutil.copyfile(chosen, out/('imessage-owner'+chosen.suffix))
(out/'message-display.json').write_text(json.dumps(display, indent=2))
print(f'Read {len(messages)} delivered owner messages and {len(objects)} existing catalog objects; no writes.')

