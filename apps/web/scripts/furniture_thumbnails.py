"""Deterministic vector thumbnails for the procedural, low-poly furniture kit."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
items=json.loads((ROOT/'packages/catalog/furniture.json').read_text())
output=ROOT/'apps/web/public/thumbs/furniture'
output.mkdir(parents=True,exist_ok=True)
for c in items:
    color=c['color']
    def rect(x,y,w,h,fill=color):
        return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="3" fill="{fill}"/>'
    shape=c['shape']
    art=''
    if shape=='seat': art=rect(18,23,64,33)+rect(14,37,10,27)+rect(76,37,10,27)+rect(25,46,50,16,'#e9c2a0')
    elif shape in ('table','counter','record','tv'):
        art=rect(20,32,60,10)+rect(25,42,5,23,'#896448')+rect(70,42,5,23,'#896448')
        if shape=='tv':art+=rect(25,10,50,26,'#243f4e')
        if shape=='record':art+='<ellipse cx="50" cy="29" rx="16" ry="7" fill="#31403a"/>'
    elif shape=='bed':art=rect(23,17,54,49,'#916849')+rect(26,22,48,40)+rect(30,22,40,12,'#f5efde')
    elif shape=='rug':art=f'<ellipse cx="50" cy="43" rx="35" ry="23" fill="{color}"/>' if c['id']=='rug_round' else rect(15,25,70,35)+rect(25,25,4,35,'#f9e7c6')+rect(45,25,4,35,'#f9e7c6')+rect(65,25,4,35,'#f9e7c6')
    elif shape=='plant':art=rect(37,47,26,20,'#c48258')+'<path d="M50 52V19M50 43Q15 10 36 18L50 37Q85 10 69 18L50 34Q35 0 50 10Q64 0 50 34" fill="#60876b" stroke="#50775b" stroke-width="3"/>'
    elif shape in ('lamp','lava'):art=rect(47,23,6,40,'#b09b68')+f'<path d="M32 35L40 14H60L68 35Z" fill="{color if shape=="lava" else "#edc97c"}"/>'+rect(36,63,28,4)
    elif shape in ('shelf','fridge','arcade'):
        art=rect(29,10,42,58)
        if shape=='shelf':
            for y in (20,35,50):art+=rect(33,y,34,10,'#ecd3a0')
        else:art+=rect(35,17,30,22,'#70bbc4' if shape=='arcade' else '#f1e7cd')+rect(35,44,30,4,'#dcc6a1')
    elif shape=='fish':art=rect(20,25,60,34,'#8cccd0')+rect(20,59,60,8)+f'<path d="M37 39L47 35L57 41L47 47L37 43L31 48V34Z" fill="#e8a34c"/>'
    elif shape=='disco':art='<path d="M50 4V20" stroke="#a395b0" stroke-width="2"/><circle cx="50" cy="43" r="24" fill="#ada3c6"/><path d="M28 33H72M26 45H74M32 56H68M41 21V65M57 21V65" stroke="#f4ebff" stroke-width="2"/>'
    elif shape=='pet':art=f'<ellipse cx="50" cy="47" rx="35" ry="20" fill="{color}"/><ellipse cx="50" cy="43" rx="26" ry="12" fill="#eadcc1"/>'
    else:art=rect(18,17,64,48)+rect(24,23,52,36,'#f5dfb7')+f'<circle cx="59" cy="34" r="8" fill="{color}"/><path d="M28 53L41 35L57 53L66 41L74 53Z" fill="#6b8d77"/>'
    (output/(c['id']+'.svg')).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80"><rect width="100" height="80" rx="14" fill="#f4eedf"/>{art}</svg>')
print(f'Generated {len(items)} furniture thumbnails.')
