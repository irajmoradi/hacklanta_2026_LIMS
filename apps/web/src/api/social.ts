export type Message = { id: string; village_id: string; from_user_id: string; to_user_id: string; text: string; kind: 'message' | 'poke' | 'cheer'; created_at: string; read_at: string | null };
export type Presence = { user_id: string; x: number; z: number; activity: string };
export type Bribe = { id: string; village_id: string; user_id: string; coins: number; wish: string; status: string; created_at: string };
export type BribeReceipt = { bribe: Bribe; balance: number; receipt: string };
/** Chunk-safe SSE parser, including CRLF and multi-line data. */
export async function readPresence(response: Response, signal: AbortSignal, emit: (online: Presence[]) => void) {
  if (!response.ok || !response.body) throw new Error('Presence disconnected');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = '';
  try {
    while (!signal.aborted) {
      const chunk = await reader.read(); if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      let match: RegExpExecArray | null;
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, match.index); buffer = buffer.slice(match.index + match[0].length);
        const lines = frame.split(/\r?\n/);
        if (!lines.includes('event: presence')) continue;
        try { const value = JSON.parse(lines.filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n'));
          if (Array.isArray(value.online)) emit(value.online.filter((p: Presence) => typeof p.user_id === 'string' && Number.isFinite(p.x) && Number.isFinite(p.z) && typeof p.activity === 'string'));
        } catch { /* Ignore malformed snapshots. */ }
      }
      if (buffer.length > 262144) throw new Error('Presence frame too large');
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
