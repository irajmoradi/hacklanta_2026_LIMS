export type History<T> = { past: T[]; present: T; future: T[] };
export const historyOf = <T>(present: T): History<T> => ({past: [], present, future: []});
export function change<T>(h: History<T>, present: T): History<T> {
  return JSON.stringify(h.present) === JSON.stringify(present) ? h : {past: [...h.past, h.present], present, future: []};
}
export function step<T>(h: History<T>, forward = false): History<T> {
  if (forward) return h.future.length ? {past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1)} : h;
  return h.past.length ? {past: h.past.slice(0, -1), present: h.past.at(-1)!, future: [h.present, ...h.future]} : h;
}
