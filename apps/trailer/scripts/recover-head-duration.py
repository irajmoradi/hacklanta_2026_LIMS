"""Recover the initial capture's fixed-duration bug from its complete recording.

Only for the TRAILER-003 legacy head segment with duration=6. New captures measure
elapsed action time directly. The head is the page's final shot; reserve three
seconds for Escape/close. Inspect head-motion.png before accepting this recovery.
"""
import json, subprocess
from pathlib import Path
source=Path(__file__).resolve().parents[1]/'artifacts/captures'
audit=json.loads((source/'capture-audit.json').read_text())
segment=next(s for s in audit['segments'] if s['name']=='head')
assert segment['duration']==6, 'Recovery is only for the original fixed-duration capture'
assert (source/'head-motion.png').is_file()
duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(source/'raw'/segment['video'])]))
segment['duration']=duration-segment['start']-3
assert segment['duration']>6
segment['duration_source']='recording end minus 3s close margin; legacy fixed-window repair'
(source/'capture-audit.json').write_text(json.dumps(audit,indent=2))
print('Recovered full head drag:',round(segment['duration'],3),'seconds; prepare-clips retimes to 3 seconds.')
