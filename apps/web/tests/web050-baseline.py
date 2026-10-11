"""Extract exact historical placement code and freeze the main browser baseline."""
import json, re, subprocess
from pathlib import Path
root = Path(__file__).resolve().parents[3]
web = root / 'apps/web'
def source(ref, path):
    return subprocess.check_output(['git', 'show', f'{ref}:apps/web/{path}'], cwd=root).decode()
base = '2667e12fc1fec06fda6798293d01c33ea5d94e2a'
paths = ['src/scene/layout/variety.ts']
(web/'tests/web050-baseline.json').write_text(json.dumps({p:source(base,p) for p in paths}))
out = web/'tests/web050-history'
out.mkdir(exist_ok=True)
for ref, label in [('e8909eb^1','legacy'),(base,'main')]:
    for name in ['town','streets'] + (['variety'] if label=='main' else []):
        s = source(ref, f'src/scene/layout/{name}.ts')
        s = re.sub(r"import \{ CatmullRomCurve3, Vector3 \} from 'three';\n", '', s)
        s = re.sub(r'export function curve\(.*?\n\}', '', s, flags=re.S)
        s = '// @ts-nocheck -- generated historical measurement source\n' + s
        def replace(m):
            path=m[1]
            if path in ['./town','./streets','./variety']:
                return "from './"+label+'-'+path[2:]+"'"
            return "from '"+'../../src/scene/layout/'+path+"'" if path.startswith('.') else m[0]
        if label == 'main' and name == 'variety':
            s += "\nexport const audit={attempts:0,island:0,reserved:0,occupied:0};\n"
            s = s.replace('const out: Decor[]=', 'Object.assign(audit,{attempts:0,island:0,reserved:0,occupied:0});\n  const out: Decor[]=')
            s = s.replace('const b=decorBounds(d);', "const b=decorBounds(d),isTree=d.role.startsWith('tree_'); if(isTree)audit.attempts++;")
            s = s.replace('>town.depth/2-2)return;', '>town.depth/2-2){if(isTree)audit.island++;return;}')
            s = s.replace("if(reserved.some(r=>overlaps(b,r)) || (d.role.startsWith('tree_') && occupied.some(r=>overlaps(b,r))))return;",
                "if(reserved.some(r=>overlaps(b,r))){if(isTree)audit.reserved++;return;}\n    if(isTree && occupied.some(r=>overlaps(b,r))){audit.occupied++;return;}")
        s=re.sub(r"from '([^']+)'",replace,s)
        (out/f'{label}-{name}.ts').write_text(s)
s=source('e8909eb^1','src/scene/GridTown.tsx')
s=s.split('const batches=useMemo(()=>{',1)[1].split('},[town,world.level',1)[0]
(out/'legacy-decor.ts').write_text("// @ts-nocheck -- extracted historical callback\nimport {clearOfStreets} from './legacy-streets';\nimport {seededRandom} from '../../src/scene/worldTypes';\nimport {available} from '../../src/scene/registryData';\nexport function legacyDecor(town:any,world:any){"+s+'}\n')


