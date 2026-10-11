"""Finish a split-runner export using the completed main and corrected square cut."""
from pathlib import Path
import shutil, subprocess, sys
root=Path(__file__).resolve().parents[1]
out=root/'artifacts'
square=root/'public/captures/v4-square-ready.mp4'
mode=sys.argv[1] if len(sys.argv)>1 else 'all'
assert mode in ('all','--encode-only','--verify-only')
assert (out/'village-trailer-v4.mp4').exists()
if mode!='--encode-only':
    assert square.exists()
    shutil.copyfile(square,out/'village-trailer-v4-square.mp4')
if mode!='--verify-only':
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(out/'village-trailer-v4.mp4'),'-c:v','libx264','-preset','slow','-b:v','1850k','-maxrate','1950k','-bufsize','3900k','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart',str(out/'village-trailer-v4-discord.mp4')],check=True)
if mode!='--encode-only':
    subprocess.run([sys.executable,str(root/'scripts/verify.py')],check=True)
