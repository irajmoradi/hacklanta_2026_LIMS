"""Stage this worktree inside the allowed scene path; reuse installed dependencies."""
from pathlib import Path
import shutil
import os

root = Path(__file__).resolve().parents[4]
stage = Path(__file__).resolve().parent / '.qa'
app = stage / 'apps/web'
shutil.copytree(root / 'apps/web', app, dirs_exist_ok=True,
                ignore=shutil.ignore_patterns('node_modules', '.qa', 'artifacts', 'test-results', 'dist'))
shutil.copytree(root / 'packages', stage / 'packages', dirs_exist_ok=True,
                ignore=shutil.ignore_patterns('node_modules'))
deps = Path(os.environ.get('VILLAGE_WEB_DEPS', str(root.parent / 'hacklanta/apps/web/node_modules')))
# Keep dependency caches inside this staging tree, too.
if (app / 'node_modules').is_junction():
    (app / 'node_modules').rmdir()
if not (app / 'node_modules').exists():
    shutil.copytree(deps, app / 'node_modules', ignore=shutil.ignore_patterns('.vite*'))
print(app)
