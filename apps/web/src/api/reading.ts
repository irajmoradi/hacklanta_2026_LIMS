import type { Reaction } from './reactions';
export type ReadingDraft = { title: string; link: string; author: string; why: string };
export type Reader = { user_id: string; takeaway: string; awarded: boolean; activity_id: string; reactions: Reaction[] };
export type ReadingItem = ReadingDraft & { id: string; user_id: string | null; readers: Reader[] };
export type ReadingShelf = { week_start: string; read_only: boolean; awarded_count: number; items: ReadingItem[] };
export function readingMonday(now = new Date()) {
  const day = new Date(now); day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  return day.toISOString().slice(0, 10);
}
export function readingLink(value: string) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined; } catch { return undefined; }
}
