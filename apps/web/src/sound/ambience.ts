export type Position = [number, number, number];
export type AmbientAsset = {name: string; file: string; fallback?: string; loop: boolean};
type Fade = {from: number; to: number; start: number; end: number};
type Voice = {source: AudioBufferSourceNode; gain: GainNode; pan?: PannerNode; fade: Fade; name: string};
export const AMBIENCE_LEVEL = .35;
export const CROSSFADE_SECONDS = 3;
export const NIGHT_FADE_SECONDS = 4;
export const distanceGain = (distance: number) => 8 / (8 + 1.4 * Math.max(0, distance - 8));
export const fadeValue = (f: Fade, now: number) => f.from + (f.to-f.from)*Math.max(0,Math.min(1,(now-f.start)/Math.max(.001,f.end-f.start)));
export const birdDelay = (random = Math.random) => 8000 + random()*17000;

/** Decoded loops avoid media-element encoder padding. All nodes are created after a gesture. */
export class AmbienceMixer {
  context?: AudioContext;
  private master?: GainNode;
  private assets: AmbientAsset[] = [];
  private buffers = new Map<string, AudioBuffer>();
  private voices = new Map<string, Voice>();
  private emitters = new Map<string,{name:string; position:Position}>();
  private bed: string|null = null;
  private enabled = false;
  private volume = .65;
  private timer?: ReturnType<typeof setTimeout>;
  private loading?: Promise<void>;
  private target: Position = [0,0,0];
  private height = 35;
  private forward: Position = [0,0,-1];
  setAssets(assets: AmbientAsset[]) { this.assets=assets; if(this.context) void this.load(); }
  unlock() {
    try {
      if(!this.context) {this.context=new AudioContext();this.master=this.context.createGain();this.master.gain.value=this.enabled?this.volume*AMBIENCE_LEVEL:0;this.master.connect(this.context.destination);}
      if(this.enabled) void this.context.resume().catch(()=>{});
      void this.load();
    } catch { /* Web Audio is optional. */ }
  }
  private async load() {
    if(this.loading || !this.context || !this.assets.length) return this.loading;
    this.loading=Promise.all(this.assets.map(async asset=>{
      for(const url of [asset.file,asset.fallback].filter(Boolean) as string[]) {
        try {const response=await fetch(url);if(!response.ok)continue;const buffer=await this.context!.decodeAudioData(await response.arrayBuffer());this.buffers.set(asset.name,buffer);break;} catch { /* Try MP3 or remain silent. */ }
      }
    })).then(()=>{this.reconcile();});
    return this.loading;
  }
  configure(enabled:boolean, volume:number) {
    this.enabled=enabled;this.volume=volume;
    if(this.context && this.master) {
      this.master.gain.setValueAtTime(enabled?volume*AMBIENCE_LEVEL:0,this.context.currentTime);
      if(enabled) void this.context.resume().catch(()=>{});else void this.context.suspend().catch(()=>{});
    }
    this.reconcile();
  }
  setBed(name:string|null) {this.bed=name;this.reconcile();}
  setEmitter(id:string,name:string,position:Position) {
    const prior=this.emitters.get(id);this.emitters.set(id,{name,position});
    const voice=this.voices.get(id);if(voice?.pan)this.position(voice.pan,position);
    if(!prior || prior.name!==name)this.reconcile();
  }
  removeEmitter(id:string) {this.emitters.delete(id);this.drop(id);}
  setListener(target:Position, zoomRatio=1, forward:Position=[0,0,-1]) {
    this.target=target;this.forward=forward;this.height=35/Math.max(.25,zoomRatio);
    const listener=this.context?.listener;if(!listener)return;
    listener.setPosition(target[0],target[1]+this.height,target[2]);
    listener.setOrientation(...forward,0,1,0);
  }
  private position(pan:PannerNode,p:Position) {pan.positionX.value=p[0];pan.positionY.value=p[1];pan.positionZ.value=p[2];}
  private create(id:string,name:string,position?:Position,loop=true) {
    const context=this.context,buffer=this.buffers.get(name);if(!context || !buffer || !this.master)return;
    const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;source.loop=loop;gain.gain.value=0;source.connect(gain);
    let pan:PannerNode|undefined;
    if(position) {pan=context.createPanner();pan.panningModel='equalpower';pan.distanceModel='inverse';pan.refDistance=8;pan.rolloffFactor=1.4;pan.maxDistance=10000;this.position(pan,position);gain.connect(pan);pan.connect(this.master);}else gain.connect(this.master);
    const voice={source,gain,pan,name,fade:{from:0,to:0,start:context.currentTime,end:context.currentTime}};
    this.voices.set(id,voice);source.start();
    if(!loop)source.onended=()=>this.drop(id);
    return voice;
  }
  private fade(voice:Voice,to:number,seconds=CROSSFADE_SECONDS) {
    if(voice.fade.to===to)return;
    const now=this.context!.currentTime,from=fadeValue(voice.fade,now);
    voice.gain.gain.cancelScheduledValues(now);voice.gain.gain.setValueAtTime(from,now);voice.gain.gain.linearRampToValueAtTime(to,now+seconds);
    voice.fade={from,to,start:now,end:now+seconds};
  }
  private reconcile() {
    if(this.timer)clearTimeout(this.timer);this.timer=undefined;
    if(!this.enabled || !this.context)return;
    this.setListener(this.target,35/this.height,this.forward);
    const layers:Record<string,number>={};
    if(this.bed && this.bed!=='arena_crowd_murmur')layers[this.bed]=this.bed==='night_soft'?.45:.7;
    if(this.bed==='day_birds_breeze') {layers.village_life_distant=.18;layers.wind_gust_light=.12;}
    for(const [name,level] of Object.entries(layers)) {const id=`bed:${name}`,voice=this.voices.get(id)??this.create(id,name);if(voice)this.fade(voice,level,name==='night_soft'?NIGHT_FADE_SECONDS:CROSSFADE_SECONDS);}
    for(const [id,voice] of this.voices)if(id.startsWith('bed:') && !layers[voice.name])this.fade(voice,0);
    for(const [id,emitter] of this.emitters) {
      if(this.voices.get(id)?.name!==emitter.name)this.drop(id);
      const voice=this.voices.get(id)??this.create(id,emitter.name,emitter.position);
      const inArena=this.bed==='arena_crowd_murmur';
      if(voice)this.fade(voice,(emitter.name==='arena_crowd_murmur')!==inArena?0:this.bed==='night_soft'?.35:.8);
    }
    if(this.bed==='day_birds_breeze')this.timer=setTimeout(()=>{this.chirp();this.reconcile();},birdDelay());
  }
  private chirp() {
    if(!this.enabled || this.bed!=='day_birds_breeze')return;
    const name=Math.random()<.08?'distant_dog':Math.random()<.5?'bird_chirp_1':'bird_chirp_2';
    this.drop('oneshot');const voice=this.create('oneshot',name,[this.target[0]+(Math.random()-.5)*24,2,this.target[2]-8],false);
    if(voice)voice.gain.gain.value=.28;
  }
  private drop(id:string) {const v=this.voices.get(id);if(!v)return;v.source.onended=null;v.source.stop();v.source.disconnect();v.gain.disconnect();v.pan?.disconnect();this.voices.delete(id);}
  stop() {this.configure(false,this.volume);this.bed=null;for(const id of this.voices.keys())this.drop(id);}
}
