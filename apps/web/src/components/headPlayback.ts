import type { Villager } from '../api/types';
export function placeholderFace(person: Villager) {
  const p = person.avatar.portrait;
  return !!p.placeholder || /demo_cast/i.test(`${p.asset_url ?? ''} ${p.head_package_url ?? ''}`) || (person.display_name === 'Maya' && person.user_id === '00000000-0000-4000-8000-000000000004');
}
export type FaceState = 'loading' | 'ready' | 'failed';
/** Snapshot readiness at the deadline: late faces stay static for the whole line. */
export async function waitForFaces(ids: string[], state: (id: string) => FaceState, signal: AbortSignal, timeout = 6000) {
  const deadline = performance.now() + timeout;
  while (!signal.aborted && ids.some(id => state(id) === 'loading') && performance.now() < deadline) {
    await new Promise<void>(resolve => { const done = () => {clearTimeout(timer); signal.removeEventListener('abort', done); resolve();}; const timer = setTimeout(done, 25); signal.addEventListener('abort', done, {once:true}); });
  }
  signal.throwIfAborted();
  return new Set(ids.filter(id => state(id) === 'ready'));
}
/** Both sound and renderer time derive from the same scheduled AudioContext clock. */
export function clockedVoice(context: AudioContext, buffer: AudioBuffer) {
  const source = context.createBufferSource(); source.buffer = buffer;
  const analyser = context.createAnalyser(); analyser.fftSize = 256;
  source.connect(analyser); analyser.connect(context.destination);
  let start = Infinity, stopped = false;
  const audio = {get currentTime() {return Math.min(buffer.duration, Math.max(0, context.currentTime - start));}, get duration() {return buffer.duration;}, get paused() {return stopped || context.currentTime < start;}, get ended() {return stopped || context.currentTime >= start + buffer.duration;}} as HTMLAudioElement;
  const samples = new Uint8Array(analyser.fftSize);
  const expr = {names:['jawOpen','mouthFunnel'], frames:[{weights:[0,0]}]};
  let frame = 0;
  const tick = () => {analyser.getByteTimeDomainData(samples); const rms = Math.sqrt(samples.reduce((s,v) => s + ((v-128)/128)**2,0)/samples.length); expr.frames[0].weights = [Math.min(.85,rms*4),Math.min(.2,rms)]; frame = requestAnimationFrame(tick);};
  let finish!: () => void;
  const ended = new Promise<void>(resolve => {finish = resolve;});
  const stop = () => {if(stopped) return; stopped = true; try {source.stop();} catch {} cancelAnimationFrame(frame); source.disconnect(); analyser.disconnect(); finish();};
  source.onended = stop;
  return {audio, expr, ended, stop, start() {start = context.currentTime + .05; source.start(start); tick();}};
}
