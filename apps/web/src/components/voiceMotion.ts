import { api } from '../api/client';
import type { ExprData } from './lamRuntime';

/** One mutable frame is enough: the renderer clamps its audio-index to the last frame. */
export function amplitudeMotion(audio: HTMLAudioElement, context: AudioContext) {
  const analyser = context.createAnalyser(); analyser.fftSize = 256;
  const source = context.createMediaElementSource(audio);
  source.connect(analyser); analyser.connect(context.destination);
  const samples = new Uint8Array(analyser.fftSize);
  const expr: ExprData = { names: ['jawOpen', 'mouthFunnel'], frames: [{ weights: [0, 0] }] };
  let frame = 0;
  const step = () => {
    analyser.getByteTimeDomainData(samples);
    const rms = Math.sqrt(samples.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / samples.length);
    expr.frames[0].weights = [Math.min(0.85, rms * 4), Math.min(0.2, rms)];
    frame = requestAnimationFrame(step);
  };
  step();
  return { expr, stop: () => { cancelAnimationFrame(frame); source.disconnect(); analyser.disconnect(); } };
}

export async function pollExpression(url: string, signal: AbortSignal): Promise<ExprData | null> {
  const parsed = new URL(url, location.origin);
  if (![location.origin, 'http://localhost:8010', 'http://127.0.0.1:8010'].includes(parsed.origin) || !parsed.pathname.startsWith('/api/assets/')) return null;
  const deadline = Date.now() + 10000;
  while (!signal.aborted && Date.now() < deadline) {
    try {
      const headers = await api.authHeaders();
      const response = await fetch(parsed.pathname, { headers, signal: AbortSignal.any([signal, AbortSignal.timeout(Math.max(1, deadline - Date.now()))]) });
      if (response.ok) {
        const value = await response.json() as ExprData;
        if (Array.isArray(value.names) && value.names.every(n => typeof n === 'string') && value.frames?.length && value.frames.every(f => Array.isArray(f.weights) && f.weights.every(Number.isFinite))) return value;
        return null;
      }
      if (![404, 202].includes(response.status)) return null;
    } catch { if (signal.aborted) return null; }
    await new Promise<void>(resolve => { const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); }; const timer = setTimeout(finish, 1000); signal.addEventListener('abort', finish, { once: true }); });
  }
  return null;
}
