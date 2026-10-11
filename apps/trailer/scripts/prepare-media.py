"""Derive a real waveform from the consented recording; no synthetic voice."""
from pathlib import Path
import array, subprocess, shutil
root=Path(__file__).resolve().parents[1]
out=root/'public/captures'
(root/'artifacts').mkdir(exist_ok=True)
pcm=subprocess.check_output(['ffmpeg','-v','error','-i',str(out/'memo.ogg'),'-t','6','-ac','1','-ar','8000','-f','s16le','-'])
samples=array.array('h',pcm)
peaks=[max(abs(v) for v in samples[i:i+160])/32768 for i in range(0,len(samples),160)]
scale=max(peaks) or 1
bars=''.join(f'<rect x="{i*10}" y="{120-max(3,p/scale*110):.2f}" width="6" height="{max(6,p/scale*220):.2f}" rx="3" fill="#e9ff75"/>' for i,p in enumerate(peaks))
(out/'waveform.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {len(peaks)*10} 240">{bars}</svg>')
subprocess.run(['ffmpeg','-v','error','-y','-i',str(out/'talk.mp4'),'-frames:v','1',str(root/'artifacts/talk-preview.png')],check=True)
shutil.make_archive(str(root/'artifacts/fresh-captures'),'zip',out)
print('Original memo waveform and private media archive prepared.')
