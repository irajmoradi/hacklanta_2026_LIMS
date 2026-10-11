import { VillageIcon } from './VillageIcon';
import { ToastNotice } from './Toast';
import { CurrencyAmount } from './Currency';
import { ItemThumbnail } from './ItemThumbnail';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { Village } from '../api/types';
import { errorText, Portrait } from './shared';

type Member = {id: string; display_name: string; allow_voice_by_friends: boolean; can_receive: boolean};
type GramStatus = {id: string; status: 'queued' | 'rendering_video'; video_url?: string | null};
export function Villagergram({vid, refresh, onSettings}: {vid: string; refresh: () => Promise<void>; onSettings?: () => void}) {
  const [members, setMembers] = useState<Member[]>([]), [village, setVillage] = useState<Village>();
  const [speaker, setSpeaker] = useState(''), [recipient, setRecipient] = useState(''), [text, setText] = useState('');
  const [owned, setOwned] = useState(false), [balance, setBalance] = useState(0), [price, setPrice] = useState(150);
  const [preview, setPreview] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('');
  const lock = useRef(false), attempt = useRef({signature:'', key:''});
  const [gram, setGram] = useState<GramStatus | null>(null), [video, setVideo] = useState('');
  useEffect(() => {
    if (!gram || gram.status !== 'rendering_video') return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await api.request<GramStatus>('GET', `/villages/${vid}/villagergrams/${gram.id}`);
        if (stopped) return;
        setGram(next);
        if (next.status !== 'rendering_video') {
          setStatus(next.video_url ? 'Video ready. Gram queued for delivery.' : 'Gram queued with available audio and portrait.');
          return;
        }
      } catch (e) { if (!stopped) setError(errorText(e)); }
      if (!stopped) timer = setTimeout(poll, 2000);
    };
    timer = setTimeout(poll, 1000);
    return () => { stopped = true; clearTimeout(timer); };
  }, [vid, gram?.id, gram?.status]);
  useEffect(() => {
    setVideo('');
    if (!gram?.video_url) return;
    let stopped = false, objectUrl = '';
    // Authenticated fetch works for both demo headers and Auth0; video src cannot add them.
    void api.request<Blob>('GET', gram.video_url.replace(/^\/api/, '')).then(blob => {
      if (!stopped) { objectUrl = URL.createObjectURL(blob); setVideo(objectUrl); }
    }).catch(e => { if (!stopped) setError(errorText(e)); });
    return () => { stopped = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [gram?.video_url]);
  const load = async () => {
    const [options, shop, town] = await Promise.all([api.request<{members: Member[]}>('GET', `/villages/${vid}/villagergrams/options`), api.shop(vid), api.village(vid)]);
    setMembers(options.members); setVillage(town); setBalance(shop.balance);
    const item = shop.items.find(i => i.id === 'villagergram'); setOwned(item?.owned ?? false); setPrice(item?.price_coins ?? 150);
  };
  useEffect(() => { void load().catch(e => setError(errorText(e))); }, [vid]);
  async function act(send: boolean) {
    if (lock.current) return; lock.current = true; setBusy(true); setError(''); setStatus('');
    try {
      if (send) {
        const signature = JSON.stringify([vid,speaker,recipient,text.trim()]);
        if (attempt.current.signature !== signature) attempt.current = {signature,key:crypto.randomUUID()};
        const sent = await api.request<GramStatus>('POST', `/villages/${vid}/villagergrams`, {speaker_id:speaker,recipient_id:recipient,text:text.trim(),idempotency_key:attempt.current.key});
        setGram(sent);
        setStatus(sent.status === 'rendering_video' ? 'Rendering video…' : api.mode === 'mock' ? 'Demo gram queued. No audio generated or iMessage sent.' : 'Gram queued. Delivery may be a dry run; queued does not mean delivered.');
        setPreview(false); setText(''); attempt.current = {signature:'',key:''};
      } else { await api.buy(vid,'villagergram'); setStatus('One Villager-gram ready to use.'); }
      await load(); await refresh();
    } catch (e) { setError(errorText(e)); await load().catch(() => {}); }
    finally { lock.current = false; setBusy(false); }
  }
  const person = village?.villagers.find(p => p.user_id === speaker);
  return <section className="villagergram"><h3>Villager-gram</h3>
    <div style={{width: 80, height: 80}}><ItemThumbnail id="villagergram" staticFallback fallback={<VillageIcon name="chat" size={32}/>} /></div>
    <p>A friend's fictional avatar greeting, sent over iMessage. <CurrencyAmount amount={price} currency="coins" /> per gram. Three sends per day; five received.</p>
    {error && <p role="alert" className="form-error">{error}</p>}<ToastNotice message={status}/>
    {video && <video aria-label="Rendered Villager-gram" src={video} controls playsInline preload="metadata" style={{width:'100%', maxWidth:320}} />}
    <fieldset disabled={busy || gram?.status === 'rendering_video'}>
      {!owned && <button className="button secondary" disabled={balance < price} onClick={() => void act(false)}>Buy Villager-gram · <CurrencyAmount amount={price} currency="coins" /></button>}
      {owned && <p>One gram ready. Sending consumes it, including dry runs.</p>}
      {!preview ? <>
        <label>Speaker villager<select value={speaker} onChange={e => setSpeaker(e.target.value)}><option value="">Choose an opted-in speaker</option>{members.filter(m => m.allow_voice_by_friends).map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}</select></label>
        <label>Fictional line<textarea maxLength={140} rows={3} value={text} onChange={e => setText(e.target.value)} placeholder="The town hall has misplaced its only stapler." /></label><p className="help-text">{text.length}/140 · Kind, fictional lines only. No links, phone numbers or real-world claims.</p>
        <label>Recipient member<select value={recipient} onChange={e => setRecipient(e.target.value)}><option value="">Choose an opted-in recipient</option>{members.filter(m => m.can_receive).map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}</select></label>
        {village && (!members.some(m => m.allow_voice_by_friends) || !members.some(m => m.can_receive)) && <div className="gram-empty"><p>No opted-in {members.some(m => m.allow_voice_by_friends) ? 'recipients' : 'speakers'} available yet. Each neighbor controls their own permissions.</p>{onSettings && <button type="button" className="button secondary" onClick={onSettings}>Open Settings</button>}</div>}
        <p className="help-text">Missing someone? They must enable the relevant permission in Settings. Recipients must enter their own phone number.</p>
        <button className="button secondary" disabled={!speaker || !recipient || !text.trim()} onClick={() => setPreview(true)}>Preview gram</button>
      </> : <div aria-label="Villager-gram preview">
        {person && <Portrait person={person} large />}<p><strong>{person?.display_name}'s villager (AI voice)</strong></p>
        <blockquote>{text.trim()}</blockquote><p>To {members.find(m => m.id === recipient)?.display_name}</p>
        <p className="help-text">Audio is generated only after confirming Send. Without a consented voice clone, this sends text and a portrait. The speaker sees every use in the village feed.</p>
        <button className="button secondary" onClick={() => setPreview(false)}>Edit gram</button>
        <button className="button primary" disabled={!owned} onClick={() => void act(true)}>{busy ? 'Queuing…' : 'Confirm and send gram'}</button>
      </div>}
    </fieldset>
  </section>;
}
