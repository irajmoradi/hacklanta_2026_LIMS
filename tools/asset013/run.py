"""Runner-only Blender Python package. No providers, keys or paid generation."""
import pathlib
import subprocess

here=pathlib.Path(__file__).resolve().parent
(here/'artifacts').mkdir(exist_ok=True)
log=here/'artifacts/generate.log'
with log.open('w') as output:
    result=subprocess.run(['uv','run','--no-project','--python','3.11','--with','bpy==4.3.0','--with','numpy==1.26.4',
                           str(here/'generate.py')],stdout=output,stderr=subprocess.STDOUT)
if result.returncode:
    print('\n'.join(log.read_text().splitlines()[-35:]))
result.check_returncode()
print('Blender generated 19 wearables and 19 RGBA thumbnails.',flush=True)
