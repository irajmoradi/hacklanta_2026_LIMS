import { VillageIcon } from './VillageIcon';
import { ToastNotice, toast } from './Toast';
import { pollWithBackoff, transientStatus } from '../api/retry';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { Village } from '../api/types';
import type { Message } from '../api/social';
import { Portrait, PanelSkeleton, EmptyState, Dialog, errorText, when } from './shared';
import { PresenceDot } from './Presence';
import { sound } from '../sound/engine';
export function useUnread(vid?: string, user?: string, revision = 0) {
  const [count, setCount] = useState(0);
  useEffect(() => { let alive = true, previous: number | undefined; setCount(0); if (!vid) return;
    const poll = () => api.request<{unread_count: number}>('GET', `/villages/${vid}/messages/unread`).then(r => { if (alive) { if (previous !== undefined && r.unread_count > previous) sound.play('message_blip'); previous = r.unread_count; setCount(r.unread_count); } });
    const stop = pollWithBackoff(poll, 10000); return () => { alive = false; stop(); };
  }, [vid, user, revision]); return count;
}
export function Messages({village, initial, onClose, changed}: {village: Village; initial: string | null; onClose: () => void; changed: () => void}) {
  const [peer, setPeer] = useState(initial ?? ''), [rows, setRows] = useState<Message[]>([]), [text, setText] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false); const lock = useRef(false);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [inbox, outbox] = await Promise.all([api.messages(village.id), api.messages(village.id, 'outbox')]);
        if (!alive) return;
        const all = [...inbox.messages, ...outbox.messages].sort((a,b) => a.created_at.localeCompare(b.created_at));
        const unread = all.filter(m => m.from_user_id === peer && m.to_user_id === api.user && !m.read_at);
        await Promise.all(unread.map(m => api.readMessage(village.id, m.id).then(read => Object.assign(m, read))));
        if (alive) { setRows(all); setLoaded(true); setError(''); if (unread.length) changed(); }
      } catch(e) { if (alive && !transientStatus((e as {status?: number}).status ?? 0)) setError(errorText(e)); throw e; }
    };
    const stop = pollWithBackoff(load, 5000); return () => {alive = false; stop();};
  }, [village.id, peer, busy, changed]);
  async function send() {
    if (lock.current || !text.trim() || !peer) return; lock.current = true; setBusy(true); setError('');
    try { await api.sendMessage(village.id, peer, text.trim()); setText(''); sound.play('message_blip'); changed(); }
    catch(e) { setError(`${errorText(e)} If the connection failed, check the conversation before sending again.`); }
    finally {lock.current = false; setBusy(false);}
  }
  const conversation = rows.filter(m => m.from_user_id === peer || m.to_user_id === peer);
  return <Dialog title="Messages" eyebrow="NEIGHBOR MAIL" onClose={onClose} busy={busy} wide className="message-drawer">
    <div className="message-layout"><nav aria-label="Conversations">{village.villagers.filter(p => p.user_id !== api.user).map(p => <button className="button secondary" aria-pressed={peer === p.user_id} key={p.user_id} onClick={() => {setPeer(p.user_id); setText(''); setError('');}} disabled={busy}><Portrait person={p} />{p.display_name}<PresenceDot user={p.user_id} />{rows.filter(m => m.from_user_id === p.user_id && !m.read_at).length > 0 && <span className="unread-badge">Unread</span>}</button>)}</nav>
    <section aria-label="Conversation">{!peer ? <EmptyState>Choose a neighbor to read or write a message.</EmptyState> : <><div className="conversation-log" aria-live="polite">{!loaded && <PanelSkeleton label="Opening your letters..." />}{conversation.map(m => <article className={m.from_user_id === api.user ? 'sent' : ''} key={m.id}><small>{(() => { const author = village.villagers.find(p => p.user_id === m.from_user_id); return author ? <Portrait person={author} /> : null; })()}{m.from_user_id === api.user ? 'You' : village.villagers.find(p => p.user_id === m.from_user_id)?.display_name} - {m.kind} - <time dateTime={m.created_at} title={new Date(m.created_at).toLocaleString()}>{when(m.created_at)} {new Date(m.created_at).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}</time></small><p>{m.text}</p></article>)}{loaded && !conversation.length && <EmptyState>No messages yet; send the first one.</EmptyState>}</div><form onSubmit={e => {e.preventDefault(); void send();}}><label htmlFor="message-text">Your message</label><textarea id="message-text" maxLength={2000} required value={text} onChange={e => setText(e.target.value)} disabled={busy} /><p className="help-text">Messages also reach iMessage when your neighbor has opted in and linked their phone.</p><button className="button primary" disabled={busy || !text.trim()}>{busy ? 'Sending...' : 'Send message'}</button></form></>}</section></div>{error && <p role="alert">{error}</p>}
  </Dialog>;
}
export function SocialActions({vid, user, onMessage, refresh}: {vid: string; user: string; onMessage: () => void; refresh: () => Promise<void>}) {
  const [busy, setBusy] = useState(false), [status, setStatus] = useState(''); const lock = useRef(false);
  async function send(kind: 'poke' | 'cheer') { if (lock.current) return; lock.current = true; setBusy(true); setStatus('');
    try { await api.sendMessage(vid, user, kind === 'poke' ? 'A friendly poke!' : 'Cheering you on!', kind); sound.play(kind === 'poke' ? 'poke_boing' : 'message_blip'); setStatus(kind === 'poke' ? 'Poke sent!' : 'Cheer sent!'); await refresh().catch(() => {}); }
    catch(e) { toast({kind:'error',title:errorText(e)}); } finally {lock.current = false; setBusy(false);} }
  return <section className="social-actions"><div><button className="button secondary" onClick={onMessage}>Message</button><button className="button secondary" disabled={busy} onClick={() => void send('poke')}>Poke <VillageIcon name="chat" size={16}/></button><button className="button secondary" disabled={busy} onClick={() => void send('cheer')}>Cheer <VillageIcon name="star" size={16}/></button></div><ToastNotice message={status}/></section>;
}
