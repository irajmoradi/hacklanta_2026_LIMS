"""OCR every encoded frame for known stray-label/error text, without frame sampling.

Linux runner only; unpack Ubuntu's Tesseract packages in ignored artifacts (no sudo).
Exact duplicate grayscale frames reuse their OCR result. Output includes frame counts,
hashes and flagged timestamps; OCR is a regression aid, not a substitute for visual QA.
"""
from pathlib import Path
import concurrent.futures as cf
import atexit
import ctypes as C
import hashlib
import json
import os
import re
import subprocess as sp

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts/cuts-v4'
RUNTIME=OUT/'work/tesseract'
W,H=960,540
BAD=re.compile(r'place\s*holder|undefined|\bnan\b|traceback|localhost|\bdebug\b',re.I)
api=None
lib=None


def setup():
    RUNTIME.mkdir(parents=True,exist_ok=True)
    if not (RUNTIME/'usr/lib/x86_64-linux-gnu/libgif.so.7').exists():
        sp.run(['apt-get','download','libtesseract5','liblept5','libgif7','tesseract-ocr-eng'],cwd=RUNTIME,check=True)
        for deb in RUNTIME.glob('*.deb'):
            sp.run(['dpkg-deb','-x',str(deb),str(RUNTIME)],check=True)
    # Windows artifact transfers cannot create these package symlinks.
    for path in RUNTIME.rglob('*'):
        if path.is_symlink():
            resolved=path.resolve();assert resolved.is_relative_to(RUNTIME.resolve())
            data=resolved.read_bytes();path.unlink();path.write_bytes(data)


def init():
    global api,lib
    os.environ['OMP_THREAD_LIMIT']='1'
    C.CDLL(str(RUNTIME/'usr/lib/x86_64-linux-gnu/libgif.so.7'),mode=C.RTLD_GLOBAL)
    C.CDLL(str(RUNTIME/'usr/lib/x86_64-linux-gnu/liblept.so.5'),mode=C.RTLD_GLOBAL)
    lib=C.CDLL(str(RUNTIME/'usr/lib/x86_64-linux-gnu/libtesseract.so.5'))
    for name,restype,argtypes in [
      ('TessBaseAPICreate',C.c_void_p,[]),
      ('TessBaseAPIInit3',C.c_int,[C.c_void_p,C.c_char_p,C.c_char_p]),
      ('TessBaseAPISetPageSegMode',None,[C.c_void_p,C.c_int]),
      ('TessBaseAPISetImage',None,[C.c_void_p,C.c_void_p,C.c_int,C.c_int,C.c_int,C.c_int]),
      ('TessBaseAPISetSourceResolution',None,[C.c_void_p,C.c_int]),
      ('TessBaseAPIGetUTF8Text',C.c_void_p,[C.c_void_p]),
      ('TessDeleteText',None,[C.c_void_p]),
      ('TessBaseAPIClear',None,[C.c_void_p]),
      ('TessBaseAPIDelete',None,[C.c_void_p]),
    ]:
        fn=getattr(lib,name);fn.restype=restype;fn.argtypes=argtypes
    api=lib.TessBaseAPICreate()
    assert lib.TessBaseAPIInit3(api,str(RUNTIME/'usr/share/tesseract-ocr/5/tessdata').encode(),b'eng')==0
    lib.TessBaseAPISetPageSegMode(api,11)
    atexit.register(lib.TessBaseAPIDelete,api)


def ocr(item):
    index,data=item
    buf=C.create_string_buffer(data)
    lib.TessBaseAPISetImage(api,buf,W,H,1,W)
    lib.TessBaseAPISetSourceResolution(api,150)
    ptr=lib.TessBaseAPIGetUTF8Text(api)
    text=C.string_at(ptr).decode('utf8',errors='replace')
    lib.TessDeleteText(ptr);lib.TessBaseAPIClear(api)
    matches=BAD.findall(text)
    return index,matches


def main():
    setup();report=[]
    with cf.ProcessPoolExecutor(max_workers=8,initializer=init) as pool:
        for cut in ['long','90','square']:
            path=OUT/f'village-trailer-v4-{cut}.mp4'
            fps=60 if cut=='square' else 30
            process=sp.Popen(['ffmpeg','-v','error','-i',str(path),'-an','-vf',f'scale={W}:{H}','-pix_fmt','gray','-f','rawvideo','-'],stdout=sp.PIPE)
            seen={};pending={};flags=[];count=0;unique=0
            def consume(block=False):
                done,_=cf.wait(pending,return_when=cf.FIRST_COMPLETED if block else cf.ALL_COMPLETED,timeout=None if block else 0)
                for future in done:
                    index,matches=future.result();pending.pop(future)
                    if matches:flags.append({'frame':index,'seconds':index/fps,'matches':matches})
            while True:
                data=process.stdout.read(W*H)
                if not data:break
                assert len(data)==W*H
                key=hashlib.sha256(data).digest()
                if key not in seen:
                    seen[key]=count;pending[pool.submit(ocr,(count,data))]=count;unique+=1
                count+=1
                if len(pending)>=32:consume(True)
                if count%(fps*10)==0:print(f'{cut}: {count} frames checked/queued; {unique} unique',flush=True)
            assert process.wait()==0
            while pending:consume(True)
            expected={'long':5040,'90':2700,'square':2340}[cut]
            assert count==expected
            with path.open('rb') as f:sha=hashlib.file_digest(f,'sha256').hexdigest()
            report.append({'file':path.name,'sha256':sha,'frames':count,'ocr_unique_frames':unique,'exact_duplicate_frames':count-unique,'ocr_dimensions':[W,H],'flags':flags})
            (OUT/'frame-text-audit.json').write_text(json.dumps(report,indent=2)+'\n')
            print(f'{cut}: {count} frames, {len(flags)} flags',flush=True)
    assert not any(r['flags'] for r in report), 'Review flagged timestamps in frame-text-audit.json'


if __name__=='__main__':main()
