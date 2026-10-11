import type { Me } from './types';

const key = (uid: string) => `village:last:${uid}`;
export function defaultVillage(identity: Me): string | undefined {
  try {
    const saved = localStorage.getItem(key(identity.user.id));
    if (identity.villages.some(v => v.id === saved)) return saved!;
  } catch { /* Private browsing can disable storage. */ }
  // Prefer membership dates when supplied; otherwise preserve the API's stable order.
  const dates = identity.villages.map(v => v.joined_at ? Date.parse(v.joined_at) : NaN);
  if (dates.every(Number.isFinite)) return identity.villages[dates.indexOf(Math.min(...dates))]?.id;
  return identity.villages[0]?.id;
}
export function rememberVillage(uid: string, vid: string) {
  try { localStorage.setItem(key(uid), vid); } catch { /* Persistence is optional. */ }
}
