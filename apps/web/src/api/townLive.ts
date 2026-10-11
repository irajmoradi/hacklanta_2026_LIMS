import { api } from './client';
import { barks } from '../sound/VoiceBarks';
import { connection } from './retry';
import { MovementBuffer, type Movement } from './movement';
import { Overworld } from './overworld';
import type { AvatarState } from './overworld';

export const townLive = new class {
  buffer = new MovementBuffer();
  world = new Overworld();
  predictIntent?: (action:string, fields:Record<string,unknown>) => AvatarState|undefined;
  private pending = new Map<string,string>();
  get live() { return api.mode === 'live'; }
  intent(action:string, fields:Record<string,unknown> = {}) {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN || this.socket.bufferedAmount>4096) return false;
    if(this.pending.size>=32)return false;
    const request_id=crypto.randomUUID();
    const predicted=this.predictIntent?.(action,fields);
    if(predicted)this.world.predict(predicted,request_id);
    const payload=JSON.stringify({type:'intent', request_id, action, ...fields});
    if(action!=='move'){
      this.pending.set(request_id,payload);
      // Predict on this input frame, but share the existing ingress budget with
      // movement so an emote immediately after WASD is not needlessly rejected.
      const now=performance.now(), delay=Math.max(0,this.at+100-now), socket=this.socket;
      this.at=now+delay;
      if(delay)setTimeout(()=>{
        if(this.ready && this.socket===socket && socket.readyState===WebSocket.OPEN && this.pending.has(request_id))socket.send(payload);
      },delay);
      else socket.send(payload);
    }else this.socket.send(payload);
    return true;
  }
  private socket?: WebSocket;
  private ready = false;
  private sent = '';
  private at = -Infinity;
  publish(data: Movement, now: number) {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN || now-this.at < 100) return false;
    const encoded = JSON.stringify(data);
    if (encoded === this.sent) return true;
    if (this.socket.bufferedAmount > 4096) return false;
    const {emote: _emote, ...movement} = data;
    if(!this.intent('move',movement))return false;
    this.sent = encoded; this.at = now;
    return true;
  }
  connect(vid: string) {
    this.world.ownId=api.user;
    let alive = true, failures = 0, timer: ReturnType<typeof setTimeout>, deadline: ReturnType<typeof setTimeout>, sync:ReturnType<typeof setInterval>;
    const retry = () => {
      if (!alive) return;
      this.ready = false; this.buffer.tracks.clear();
      connection.set(true, 'movement');
      timer = setTimeout(() => void open(), Math.min(30000, 500*2**Math.min(failures++,6)) + Math.random()*250);
    };
    const open = async () => {
      try {
        const headers = await api.authHeaders();
        if (!alive) return;
        const socket = this.socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/villages/${vid}/live`);
        deadline = setTimeout(() => socket.close(), 12000);
        const ping=()=>{if(alive && socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'ping',client_time:Date.now()/1000}));};
        socket.onopen = () => {socket.send(JSON.stringify({...headers, world_version:2}));sync=setInterval(ping,10000);};
        socket.onmessage = e => {
          if (!alive) return;
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'world_snapshot' || data.type === 'world_delta') {
              if (!this.world.apply(data)) socket.send(JSON.stringify({type:'resync'}));
              clearTimeout(deadline); failures=0; this.ready=true; connection.set(false,'movement');
              if (data.type==='world_snapshot') {
                ping();
                this.sent=''; this.at=-Infinity;
                let delay=0;
                for(const [id,payload] of this.pending) {
                  setTimeout(()=>{if(alive && this.ready && this.socket===socket && socket.readyState===WebSocket.OPEN && this.pending.has(id))socket.send(payload);},delay);
                  delay+=120;
                }
              }
            } else if(data.type==='pong')this.world.syncClock(data.server_time,data.client_time);
            else if (data.type==='intent_result') {
              this.pending.delete(data.request_id);
              this.world.result(data.request_id,data.ok,data.world_seq);
              if(data.ok)return;
              // Rejections never become optimistic world state. Restore authoritative state.
              socket.send(JSON.stringify({type:'resync'}));
              window.dispatchEvent(new CustomEvent('village-intent-error',{detail:data.error}));
            } else if (data.type === 'snapshot') {
              clearTimeout(deadline); failures = 0; this.sent = ''; this.at = -Infinity;
              this.ready = true; connection.set(false, 'movement');
              for (const p of data.players) this.buffer.push(p.user_id, p, performance.now());
            } else if (data.type === 'movement') {
              const prior=this.buffer.tracks.get(data.user_id)?.at(-1);
              this.buffer.push(data.user_id, data, performance.now());
              if ((!prior || data.seq > prior.seq) && data.activity && data.activity !== prior?.activity && ['cafe','attraction'].includes(data.activity)) void barks.trigger(data.user_id,data.activity);
            }
            else if (data.type === 'leave') this.buffer.tracks.delete(data.user_id);
          } catch { socket.close(); }
        };
        socket.onerror = () => socket.close();
        socket.onclose = () => { clearTimeout(deadline); clearInterval(sync); retry(); };
      } catch { retry(); }
    };
    if (api.mode === 'live') void open();
    return () => {
      alive = false; clearTimeout(timer); clearTimeout(deadline); clearInterval(sync); this.ready = false;
      this.socket?.close(); this.buffer.tracks.clear(); this.world.clear(); this.pending.clear(); connection.set(false, 'movement');
    };
  }
}();
