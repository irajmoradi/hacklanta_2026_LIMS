export function savedSeat(mode: string): string | null {
  try { const uid = localStorage.getItem(`village:seat:${mode}`); const prefix = mode === 'mock' ? '00000000' : '13370000'; return uid && (uid === localStorage.getItem(`village:guest:${mode}`) || new RegExp(`^${prefix}-0000-4000-8000-00000000000[1-5]$`).test(uid)) ? uid : null; } catch { return null; }
}
export function saveSeat(mode: string, uid: string) {
  try { localStorage.setItem(`village:seat:${mode}`, uid); } catch { /* Session still works. */ }
}
let client: string;
export function seatClient() {
  if (client) return client;
  try { client = localStorage.getItem('village:seat-client') || crypto.randomUUID(); localStorage.setItem('village:seat-client', client); }
  catch { client = crypto.randomUUID(); }
  return client;
}
