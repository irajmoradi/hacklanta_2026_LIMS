"""TRAILER-005: deterministic 168s/90s edits of the verified private v4 footage.

Run on the runner: uv run --with pillow python scripts/cuts-v4.py [render|verify|cards]
No network, credentials, production writes, generation, or wallet operations.
The 39s square edit is retained, with clean room inserts and covered Lab FPS telemetry.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math
import shutil
import subprocess as sp
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'public/captures'
OUT = ROOT / 'artifacts/cuts-v4'
FPS = 30
BG, FG, LIME, MUTED = '#102b22', '#f4f6eb', '#e9ff75', '#c1d1bd'

# Explicit edit decisions: source, long seconds, short seconds, heading, caption.
# full uses the reviewed v4 animation, with the old music removed before remixing.
SHOTS = [
 ('hook',3,2,'Group chats go quiet.','', 'full',0,3),
 ('promise',4,2,'A reason to show up.','AI that gets your people together.', 'town'),
 ('photo',2,1,'Real photo','', 'full',6,2),
 ('mask',2,1,'SAM 3','', 'full',8,2),
 ('traits',2,1,'Extracted traits','', 'full',10,2),
 ('villager',3,2,'Your villager','', 'full',12,3),
 ('splat',6,4,'LAM Gaussian splat','', 'full',15,6),
 ('memo',6,6,'Original voice','', 'full',21,6),
 ('clone',5,4,'ElevenLabs clone','', 'full',27,5),
 ('checkin',6,3,'A little moment, every day.','Check in. Share a small win.', 'checkin'),
 ('goals',6,3,'Keep going. Then go further.','Weekly goals. Stretch goals when you finish.', 'goals'),
 ('friends',5,2,'Show up for each other.','Friends and cheers keep you going.', 'friends'),
 ('gram',5,2,'Send a little encouragement.','Villager-grams: your avatar, your AI voice, on video.', 'talk'),
 ('challenges',5,2,'Pick a challenge together.','Shared challenges turn effort into collective XP.', 'colosseum'),
 ('growth',4,2,'Your progress builds the town.','Check-ins + challenges → collective XP → village levels.', 'growth'),
 ('unlock',8,5,'Unlock the town together.','Level up. Open the Pet Shelter.', 'growth-unlock'),
 ('pets',5,2,'A friend for your friend.','The Shelter unlocks pets. Preview an adoption.', 'pets'),
 ('disaster',4,2,'Then the town needs you.','An outbreak closes the Shelter.', 'disaster-repair',0,2),
 ('repair-task',4,2,'The Mayor gives you a mission.','Repair tasks bring everyone back to their check-ins.', 'disaster-repair',2,3),
 ('repair',4,2,'Save it together.','Everyone contributes. The Shelter reopens.', 'disaster-repair',5,2),
 ('walking',6,3,'One town. Everyone together.','Two browsers. The same villager walking in both.', 'synced-walking'),
 ('shop',4,2,'Make it yours.','Spend earned coins in the Village Shop.', 'shop'),
 ('wardrobe',4,2,'Find your look.','Try on an outfit before you buy.', 'wardrobe'),
 ('object',6,4,'An idea becomes an object.','Hunyuan3D: generated plant → textured mesh.', 'object-turntable'),
 ('room',4,2,'Bring it home.','That same generated plant, placed in a house.', 'object-room'),
 ('house',6,3,'A home that stays yours.','TigerData live sync · LISTEN/NOTIFY · saved house state.', 'house-sync'),
 ('hall',5,2,'A place you build together.','Decorate the Community Hall. See the edit in both windows.', 'hall-decor'),
 ('routines',5,2,'Life goes on here.','Daily routines. Lasting homes. A lived-in world.', 'routines'),
 ('arena',5,2,'A little friendly competition.','The Colosseum turns shared goals into a spectator sport.', 'competition'),
 ('payouts',6,3,'Choose how the pot is shared.','Solana devnet · test assets · payout modes preview', 'payout-card'),
 ('mayor',6,3,'Meet your Gemini Mayor.','Recaps, repair missions and a nudge to show up.', 'mayor'),
 ('gazette',5,2,'Your week becomes village history.','The Gazette remembers what you did together.', 'gazette'),
 ('imessage',6,3,'The nudge leaves the screen.','', 'full',77,4),
 ('stack',5,3,'Built to bring people together.','', 'stack-card'),
 ('end',6,4,'Get your people together.','Your people. One living village.', 'end-card'),
]


def run(args):
    sp.run([str(x) for x in args], check=True)


def ff(*args):
    run(['ffmpeg','-hide_banner','-loglevel','error','-nostdin','-y',*args])


def probe(path):
    return json.loads(sp.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(path)]))


def digest(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f,'sha256').hexdigest()


def font(size, heading=False):
    result=ImageFont.truetype(str(ROOT/'public/fonts'/('Manrope.ttf' if heading else 'DMSans.ttf')), size)
    result.set_variation_by_axes([800] if heading else [min(40,max(9,size)),400])
    return result


def centered(draw, y, text, size=34, fill=FG):
    f=font(size)
    assert draw.textlength(text,font=f)<1800, f'Text exceeds safe width: {text}'
    draw.text((960,y),text,font=f,fill=fill,anchor='mt')


def provenance(source):
    if source in ('growth-unlock','disaster-repair','routines'):
        return 'DEMO LAB · LOCAL SIMULATION'
    if source in ('house-sync','hall-decor'):
        return 'TWO BROWSERS · SCRATCH POSTGRES · TIGERDATA ARCHITECTURE'
    if source=='synced-walking':
        return 'TWO BROWSERS · SCRATCH VILLAGE · FIXTURE PET'
    if source=='object-room':
        return 'EXISTING GENERATED PROP · SCRATCH HOME'
    if source=='object-turntable':
        return 'EXISTING HUNYUAN3D OUTPUT'
    if source=='talk':
        return 'IRAJ · CACHED ELEVENLABS VIDEO'
    return 'PRODUCTION · READ-ONLY CAPTURE'


def card(shot):
    key,_,_,title,caption,source,*_=shot
    image=Image.new('RGB',(1920,1080),BG); d=ImageDraw.Draw(image)
    d.text((60,34),'village',font=font(25,True),fill=MUTED)
    d.ellipse((162,46,176,60),fill=LIME)
    d.text((60,97),title,font=font(70,True),fill=FG)
    assert d.textlength(title,font=font(70,True))<1800
    if source=='payout-card':
        for x,label,detail,bar in [(90,'Winner takes all','One winner · the whole prize',[100]),(690,'Proportional','Shares follow score percentages',[50,30,20]),(1290,'Ranked split','Example: 60% / 30% / 10%',[60,30,10])]:
            d.rounded_rectangle((x,345,x+540,710),radius=24,fill='#29493a')
            d.text((x+28,385),label,font=font(38,True),fill=LIME)
            d.text((x+28,464),detail,font=font(26),fill=FG)
            xx=x+28
            for index,value in enumerate(bar):
                width=480*value/100
                d.rectangle((xx,555,xx+width-5,610),fill=[LIME,'#9ec9a0','#669882'][index])
                xx+=width
        centered(d,785,'Illustrated modes preview · no wallet signature or transfer shown',28,MUTED)
    elif source=='stack-card':
        for y,label,text in [(315,'IDENTITY','SAM 3 · LAM · Audio2Expression · ElevenLabs'),(455,'WORLD','React Three Fiber · Hunyuan3D · TigerData'),(595,'MAYOR + MESSAGES','Gemini · Photon iMessage · Solana devnet'),(735,'INFRASTRUCTURE','Modal · Vultr · Auth0')]:
            centered(d,y,label,22,LIME); centered(d,y+44,text,40)
    elif source=='end-card':
        centered(d,330,'Village.',180)
        d.rounded_rectangle((310,615,1610,725),radius=22,fill=LIME)
        centered(d,641,'thefriendshipvillage.vodka',57,BG)
    elif source!='full':
        d.rounded_rectangle((58,242,1862,912),radius=18,fill='#091d18')
        d.text((65,210),provenance(source),font=font(21),fill=LIME)
    if caption:centered(d,973,caption,32,MUTED)
    path=OUT/'work'/f'{key}.png';image.save(path)
    return path


def timeline(cut):
    pos=0; result=[]
    for s in SHOTS:
        seconds=s[1 if cut=='long' else 2]
        result.append({'key':s[0],'start':pos,'seconds':seconds,'title':s[3],'caption':s[4],'source':s[5]})
        pos+=seconds
    assert pos == (168 if cut=='long' else 90), (cut,pos)
    return result


def encode_shot(shot,seconds,target):
    key,_,_,_,_,source,*trim=shot
    common=['-an','-c:v','libx264','-threads','4','-preset','fast','-crf','18','-pix_fmt','yuv420p','-r',FPS,'-frames:v',round(seconds*FPS)]
    if source=='full':
        path=SRC/'v4-master-ready.mp4';start,length=trim
        # Trim clone to its natural four-second slot in the short edit, never speed speech.
        length=min(length,seconds) if key=='clone' else length
        clean=f'scale=in_range=full:out_range=tv,format=yuv420p,drawbox=x=0:y=1075:w=iw:h=5:color={BG}:t=fill,'
        if key in ('hook','imessage'):clean+=f'drawbox=x=1650:y=25:w=230:h=70:color={BG}:t=fill,'
        ff('-ss',start,'-t',length,'-i',path,'-vf',f'{clean}setpts=(PTS-STARTPTS)*{seconds/length},fps={FPS},tpad=stop_mode=clone:stop_duration=1',*common,target)
    elif source.endswith('-card'):
        ff('-loop','1','-framerate',FPS,'-i',card(shot),*common,target)
    else:
        path=SRC/f'{source}.mp4'
        start,length=trim if trim else (0,float(probe(path)['format']['duration']))
        # Keep the complete unlock/repair celebration + progress; remove sidebar and FPS.
        crop='drawbox=x=305:y=274:w=145:h=31:color=0xc4cfca:t=fill,crop=1596:970:292:0,' if source in ('growth-unlock','disaster-repair','routines') else ''
        if source=='friends':crop='crop=680:740:620:160,'
        filters=f'[1:v]{crop}setpts=(PTS-STARTPTS)*{seconds/length},fps={FPS},scale=1792:660:force_original_aspect_ratio=decrease,pad=1792:660:(ow-iw)/2:(oh-ih)/2:color={BG},setsar=1,tpad=stop_mode=clone:stop_duration=1[v];[0:v][v]overlay=64:248:shortest=1[out]'
        ff('-loop','1','-framerate',FPS,'-i',card(shot),'-ss',start,'-t',length,'-i',path,'-filter_complex_threads','1','-filter_complex',filters,'-map','[out]',*common,target)


def render(refresh=()):
    implementation=digest(Path(__file__)) + digest(ROOT/'public/fonts/Manrope.ttf') + digest(ROOT/'public/fonts/DMSans.ttf')
    for cut in ['long','90']:
        edit=timeline(cut); total=sum(s['seconds'] for s in edit)
        paths=[]
        for shot,beat in zip(SHOTS,edit):
            target=OUT/'work'/f'{cut}-{shot[0]}.mp4';paths.append(target)
            source=SRC/('v4-master-ready.mp4' if shot[5]=='full' else f'{shot[5]}.mp4')
            signature=hashlib.sha256((implementation+repr(shot)+str(beat['seconds'])+(digest(source) if source.exists() else '')).encode()).hexdigest()
            receipt=target.with_suffix('.sha256')
            if not target.exists() or not receipt.exists() or receipt.read_text()!=signature or shot[0] in refresh:
                print(f'{cut}: {beat["start"]:3}s {shot[0]} ({beat["seconds"]}s)',flush=True)
                receipt.unlink(missing_ok=True)
                encode_shot(shot,beat['seconds'],target)
                receipt.write_text(signature)
        listing=OUT/'work'/f'{cut}-concat.txt'
        listing.write_text(''.join(f"file '{p.as_posix()}'\n" for p in paths))
        mute=OUT/'work'/f'{cut}-mute.mp4'
        ff('-f','concat','-safe','0','-i',listing,'-c','copy',mute)
        # 16-second musical phrase, cut on beat, no fade-in/out seams between loops.
        music=OUT/'work'/'music-phrase.wav'
        if not music.exists():ff('-ss',16,'-t',16,'-i',ROOT/'public/audio/village-original.wav',music)
        memo=next(s['start'] for s in edit if s['key']=='memo')
        clone=next(s['start'] for s in edit if s['key']=='clone')
        audio=(f"[1:a]atrim=duration={total},asetpts=PTS-STARTPTS,volume='if(between(t,{memo},{clone+4}),0.12,0.65)':eval=frame,afade=t=in:d=0.5,afade=t=out:st={total-2}:d=2[m];"
               f'[2:a]atrim=duration=6,asetpts=PTS-STARTPTS,afade=t=out:st=5.95:d=0.05,volume=0.85,adelay={memo*1000}:all=1[a];'
               f'[3:a]asetpts=PTS-STARTPTS,adelay={clone*1000}:all=1[b];'
               '[m][a][b]amix=inputs=3:duration=first:normalize=0,alimiter=limit=0.95:level=0:latency=1[out]')
        master=OUT/f'village-trailer-v4-{cut}.mp4'
        ff('-i',mute,'-stream_loop','-1','-i',music,'-i',SRC/'memo.ogg','-i',SRC/'talk.mp4','-filter_complex',audio,'-map','0:v','-map','[out]','-c:v','copy','-c:a','aac','-b:a','160k','-t',total,'-movflags','+faststart',master)
        # Preserve master quality when it already fits; otherwise budget a two-pass encode.
        rate=950 if cut=='long' else 1800
        small=OUT/f'village-trailer-v4-{cut}-discord.mp4'
        if master.stat().st_size<=24_000_000:
            shutil.copyfile(master,small)
        else:
            for passno in [1,2]:
                ff('-i',master,'-map','0:v:0',*(['-map','0:a:0'] if passno==2 else []),'-c:v','libx264','-threads','4','-preset','slow','-b:v',f'{rate}k','-pass',passno,'-passlogfile',OUT/'work'/f'{cut}-pass','-pix_fmt','yuv420p',*(['-c:a','aac','-b:a','96k','-t',total,'-movflags','+faststart',small] if passno==2 else ['-an','-f','null','-']))
        (OUT/f'timeline-{cut}.json').write_text(json.dumps(edit,indent=2)+'\n')
    house=float(probe(SRC/'house-sync.mp4')['format']['duration'])
    hall=float(probe(SRC/'hall-decor.mp4')['format']['duration'])
    square=("[0:v]drawbox=x=212:y=493:w=75:h=20:color=0xc4cfca:t=fill:enable='gte(t,17)*lt(t,23)+gte(t,35)*lt(t,36)'[base];"
            f'[1:v]setpts=(PTS-STARTPTS)*{1.5/house}+29/TB,scale=958:450,fps=60,tpad=stop_mode=clone:stop_duration=1[h];'
            f'[2:v]setpts=(PTS-STARTPTS)*{1.5/hall}+30.5/TB,scale=958:450,fps=60,tpad=stop_mode=clone:stop_duration=1[c];'
            "[base][h]overlay=61:403:eof_action=pass:enable='gte(t,29)*lt(t,30.5)'[home];"
            "[home][c]overlay=61:403:eof_action=pass:enable='gte(t,30.5)*lt(t,32)'[out]")
    ff('-i',SRC/'v4-square-ready.mp4','-i',SRC/'house-sync.mp4','-i',SRC/'hall-decor.mp4','-filter_complex_threads','1','-filter_complex',square,'-map','[out]','-map','0:a','-c:v','libx264','-threads','4','-preset','fast','-crf','18','-c:a','copy','-frames:v',2340,'-movflags','+faststart',OUT/'village-trailer-v4-square.mp4')


def sheet(cut,path,times,titles):
    cols=4; width=360 if cut=='square' else 480
    height=360 if cut=='square' else 270;rowheight=height+28
    canvas=Image.new('RGB',(cols*width,math.ceil(len(times)/cols)*rowheight),BG)
    draw=ImageDraw.Draw(canvas)
    for i,(second,title) in enumerate(zip(times,titles)):
        frame=OUT/'work'/f'{cut}-frame-{i:02}.jpg'
        ff('-ss',second,'-i',path,'-frames:v','1','-vf',f'scale={width}:-1','-update','1',frame)
        img=Image.open(frame);img.thumbnail((width,height))
        x,y=(i%cols)*width,(i//cols)*rowheight
        canvas.paste(img,(x,y));draw.text((x+8,y+height+3),f'{second:06.2f}s · {title}',font=font(17),fill=LIME)
    canvas.save(OUT/f'contact-sheet-{cut}.jpg',quality=92)


def verify():
    results=[]
    for name,duration,fps,width,limited in [('long',168,30,1920,False),('long-discord',168,30,1920,True),('90',90,30,1920,False),('90-discord',90,30,1920,True),('square',39,60,1080,True)]:
        path=OUT/f'village-trailer-v4-{name}.mp4'; info=probe(path)
        v=next(s for s in info['streams'] if s['codec_type']=='video');a=next(s for s in info['streams'] if s['codec_type']=='audio')
        assert (v['width'],v['height'],v['codec_name'],v['avg_frame_rate'])==(width,1080,'h264',f'{fps}/1')
        assert int(v['nb_frames'])==duration*fps
        assert abs(float(v['duration'])-duration)<0.0001
        assert abs(float(info['format']['duration'])-duration)<(0.03 if name=='square' else .001)
        assert a['codec_name']=='aac' and v['pix_fmt'] in ('yuv420p','yuvj420p')
        if limited:assert path.stat().st_size<=24_000_000
        ff('-xerror','-i',path,'-f','null','-')
        results.append({'file':path.name,'seconds':float(info['format']['duration']),'video_seconds':float(v['duration']),'frames':int(v['nb_frames']),'fps':fps,'width':width,'height':1080,'bytes':path.stat().st_size,'sha256':digest(path),'decode':'passed'})
        if 'discord' not in name:
            if name=='square':
                times=[.5,1.5,2.5,3.5,4.5,5.5,7,10,13,15,18,21,24,27,30,34,36,38]
                titles=['square']*len(times)
            else:
                edit=timeline(name);times=[s['start']+s['seconds']/2 for s in edit];titles=[s['key'] for s in edit]
            sheet(name,path,times,titles)
    (OUT/'verification-cuts.json').write_text(json.dumps(results,indent=2)+'\n')
    print(json.dumps(results,indent=2),flush=True)


def main():
    parser=argparse.ArgumentParser();parser.add_argument('mode',choices=['cards','render','verify'],default='render',nargs='?')
    parser.add_argument('--refresh',nargs='*',default=[],choices=[s[0] for s in SHOTS]);args=parser.parse_args()
    (OUT/'work').mkdir(parents=True,exist_ok=True)
    for cut in ['long','90']:timeline(cut)
    if args.mode=='cards':
        for shot in SHOTS:
            if shot[5]!='full':card(shot)
        print('Both timelines and all caption safe areas passed.')
    elif args.mode=='render':render(args.refresh)
    else:verify()


if __name__=='__main__':main()
