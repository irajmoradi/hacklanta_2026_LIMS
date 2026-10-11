import type { Disaster, RepairPlan } from '../api/types';

export function examplePlan(kind: Disaster['kind']): RepairPlan {
  // Real-life actions (R-184), matching the server's fixed titles.
  const second = {scorch: {kind: 'workout_together', title: 'Exercise for 30 min'}, outbreak: {kind: 'hangout', title: 'Hang out with someone for 30 min (in person or on a voice call)'},
    blackout: {kind: 'call_a_friend', title: 'Call a friend for 30 min'}, blight: {kind: 'study_session', title: 'Read a news article or study for 30 min'}}[kind];
  return {tasks: [{kind: 'checkins', title: 'Share a photo of what you did today', target: 2, progress: 0}, {...second, target: 1, progress: 0} as RepairPlan['tasks'][number]], reasoning: `The example group shared four recent updates. Real-life time together is what repairs the village after the ${kind}, so each task is something you do offline.`, model: 'offline example', example: true};
}

/** Called only by Ask the Mayor. Never uses the village mutation client. */
export async function askMayor(kind: Disaster['kind'], status: (text: string) => void, signal: AbortSignal): Promise<RepairPlan> {
  status('Asking the Mayor…');
  try {
    const response = await fetch('/api/lab/repair-plan', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({kind}), signal: AbortSignal.any([signal, AbortSignal.timeout(80000)])});
    if (!response.ok || !response.body) throw new Error('Unavailable');
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let buffer = '', plan: RepairPlan | undefined;
    while (true) {
      const {done, value} = await reader.read();
      buffer += decoder.decode(value, {stream: !done});
      const lines = buffer.split('\n'); buffer = lines.pop()!;
      for (const line of lines) if (line) {
        const event = JSON.parse(line);
        if (event.status) status(`${event.status}${event.model ? ` · ${event.model}` : ''}`);
        if (event.plan) plan = event.plan;
      }
      if (done) break;
    }
    if (plan) return plan;
  } catch (error) {if (signal.aborted) throw error;}
  status('Using an example plan. The Mayor is offline or capped.');
  return examplePlan(kind);
}
