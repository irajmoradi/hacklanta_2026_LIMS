export type AvatarState = {
  user_id: string; mode: 'idle'|'walking'|'attraction'|'seated'|'emote'|'following'|'home';
  x:number; z:number; heading:number; attraction_id?:string; slot?:number; seat_id?:string|null;
  emote?:'wave'|'cheer'|'spin'; target_user?:string; since:number; until?:number; seq:number;
  activity?:string; elevation?:number; running?:boolean;
};
export type WorldMessage = {type:'world_snapshot'|'world_delta'; world_seq:number; from_seq?:number; server_time:number; avatars:AvatarState[]};
/** Rendering is independent of transport sequence recovery and acknowledgements. */
export class Overworld {
  avatars = new Map<string,AvatarState>();
  seq = -1;
  offset = 0;
  ownId = '';
  private bestRoundTrip = Infinity;
  private tracks = new Map<string, {state:AvatarState; at:number}[]>();
  private predicted?: AvatarState;
  private request?: string;
  private acceptedSeq?: number;
  private movingLocally = false;
  private serverDriven = false;
  private correction?: {x:number;z:number;start:number;progress:number};
  apply(message:WorldMessage, now=Date.now()/1000) {
    const covered = message.type==='world_snapshot' || message.from_seq===this.seq;
    if(message.world_seq<this.seq) return true;
    const old = this.avatars;
    if (message.type==='world_snapshot') {
      this.avatars=new Map();
      const ids=new Set(message.avatars.map(s=>s.user_id));
      for(const id of this.tracks.keys())if(!ids.has(id))this.tracks.delete(id);
      if(!ids.has(this.ownId)){this.predicted=undefined;this.correction=undefined;}
    }
    for (const state of message.avatars) {
      const previous=old.get(state.user_id);
      if (previous && state.seq<previous.seq) continue;
      this.avatars.set(state.user_id,state);
      if(!previous || state.seq>previous.seq){
        const track=this.tracks.get(state.user_id)??[];
        track.push({state,at:now}); if(track.length>8)track.shift();
        this.tracks.set(state.user_id,track);
      }
      if(state.user_id===this.ownId && (!this.request || this.acceptedSeq!==undefined && message.world_seq>=this.acceptedSeq)) {
        this.reconcile(state, false, now);
        this.request=undefined;this.acceptedSeq=undefined;
      }
    }
    // A gap requests a snapshot but never discards useful, newer avatar states.
    this.seq=message.world_seq;
    if(this.bestRoundTrip===Infinity)this.offset=message.server_time-now;
    return covered;
  }
  predict(state:AvatarState, request?:string) {
    this.predicted=state;
    this.serverDriven=false;
    this.movingLocally=!request;
    this.request=request;this.acceptedSeq=undefined;
    if(request)this.correction=undefined;
  }
  result(request:string, ok:boolean, seq?:number, now=Date.now()/1000) {
    const state=this.avatars.get(this.ownId);
    if(this.request!==request){
      if(!ok && !this.request && state)this.reconcile(state,true,now);
      return;
    }
    if(!ok || state && seq!==undefined && this.seq>=seq){
      this.request=undefined;this.acceptedSeq=undefined;
      if(state)this.reconcile(state,!ok,now);
    }else this.acceptedSeq=seq;
  }
  private reconcile(state:AvatarState, rejected:boolean, now:number) {
    const local=this.predicted;
    if(!local){this.predicted=state;return;}
    // Not steering and nothing pending: the server's routine is walking you (R-183).
    this.serverDriven=!rejected && !this.movingLocally && !this.request;
    if(this.serverDriven){this.predicted=state;this.correction=undefined;return;}
    const movement=this.movingLocally && !state.attraction_id && !!state.until && ['walking','idle'].includes(local.mode) && ['walking','idle'].includes(state.mode);
    const error=Math.hypot(state.x-local.x,state.z-local.z);
    if(!rejected && movement && error<=1.5)return; // Own movement echoes never drive rendering.
    if(!movement || rejected)this.movingLocally=false;
    const changed=local.mode!==state.mode || local.slot!==state.slot || local.attraction_id!==state.attraction_id;
    this.predicted={...state,x:local.x,z:local.z};
    if(error>1.5 || rejected || changed || !movement && error>0){
      this.correction={x:state.x-local.x,z:state.z-local.z,start:now,progress:0};
    }
  }
  sample(id:string, now=Date.now()/1000):AvatarState|undefined {
    // Prediction only while you steer; when the server's routine walks your villager (R-183) it
    // glides through the same buffered track as everyone else instead of easing 1 Hz jumps.
    if(id===this.ownId && this.predicted && !this.serverDriven){
      const c=this.correction;
      if(c){
        const t=Math.min(1,Math.max(0,(now-c.start)/.2)), eased=t*t*(3-2*t), step=eased-c.progress;
        this.predicted={...this.predicted,x:this.predicted.x+c.x*step,z:this.predicted.z+c.z*step};
        c.progress=eased;if(t===1)this.correction=undefined;
      }
      return this.predicted;
    }
    const track=this.tracks.get(id), last=track?.at(-1);
    if(!track || !last)return this.avatars.get(id);
    // 75 ms receive-time buffer for live players; server-driven villagers step at ~1 Hz, so buffer one
    // full step (their steady update gap) to glide between updates instead of lurching and stopping.
    // Median of the recent gaps, so one stray extra update doesn't drop a 1 Hz walker back to 75 ms.
    const gaps=track.slice(-4).slice(1).map((p,i)=>p.at-track.slice(-4)[i].at).sort((x,y)=>x-y);
    const steady=gaps.length ? gaps[Math.floor((gaps.length-1)/2)] : Infinity;
    const time=now-(steady>.25 && steady<2 ? steady*1.05 : .075);
    const b=track.find(p=>p.at>=time)??last, a=track[Math.max(0,track.indexOf(b)-1)];
    if(a===b || a.state.mode!==b.state.mode || a.state.attraction_id!==b.state.attraction_id || Math.hypot(b.state.x-a.state.x,b.state.z-a.state.z)>10)return b.state;
    const span=b.at-a.at;
    const t=span>0 ? Math.max(0,Math.min((time-a.at)/span,1+(['walking','following'].includes(b.state.mode)?.1/span:0))) : 1;
    const angle=Math.atan2(Math.sin(b.state.heading-a.state.heading),Math.cos(b.state.heading-a.state.heading));
    return {...b.state,x:a.state.x+(b.state.x-a.state.x)*t,z:a.state.z+(b.state.z-a.state.z)*t,heading:a.state.heading+angle*Math.min(1,t)};
  }
  now() { return Date.now()/1000+this.offset; }
  syncClock(server:number,sent:number,received=Date.now()/1000) {
    const roundTrip=received-sent;
    if(roundTrip>=0 && roundTrip<this.bestRoundTrip){this.bestRoundTrip=roundTrip;this.offset=server-(sent+received)/2;}
  }
  clear() { this.avatars.clear(); this.tracks.clear();this.predicted=undefined;this.request=undefined;this.acceptedSeq=undefined;this.correction=undefined;this.seq=-1; this.movingLocally=false; this.bestRoundTrip=Infinity; }
}
