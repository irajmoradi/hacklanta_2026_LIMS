import { ToastNotice } from './Toast';
import { VoiceBarkSetting } from '../sound/VoiceBarks';
import { UserRound, AudioLines, MessagesSquare, ScanFace } from 'lucide-react';
import { SettingToggle } from './SettingToggle';
import { IdleActivityPicker } from './IdleActivityPicker';
import { DeleteAccount } from './DeleteAccount';
import { SoundSettings } from '../sound/SoundControls';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { Me, SettingsInput } from '../api/types';
import { Dialog, errorText } from './shared';

export const VOICE_CONSENT_VERSION = 'village-voice-v1';
export const VOICE_CONSENT_TEXT = 'I confirm these recordings are my own voice and consent to ElevenLabs cloning it for AI-generated speech in Village, including speech requested by village friends.';
const audioTypes = new Set(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/webm', 'audio/flac']);
export function SettingsPanel({ onSignOut, onClose, refresh, onDeleted, onFaceCheck }: { onSignOut?: () => void; onFaceCheck?: () => void; onDeleted?: () => void; onClose: () => void; refresh: () => Promise<void> }) {
  const [identity, setIdentity] = useState<Me | null>(null), [draft, setDraft] = useState<SettingsInput>({ display_name: '', phone_e164: '', roast_ok: false, agent_msgs_ok: false, allow_voice_by_friends: false, receive_villagergrams: false });
  const [saved, setSaved] = useState('');
  const dirty = JSON.stringify(draft) !== saved;
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('');
  const [files, setFiles] = useState<File[]>([]), [consent, setConsent] = useState(false), [recording, setRecording] = useState(false), [starting, setStarting] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null), stream = useRef<MediaStream | null>(null), timer = useRef<ReturnType<typeof setTimeout>>();
  const alive = useRef(true), locked = useRef(false);
  const stop = () => { clearTimeout(timer.current); if (recorder.current?.state === 'recording') recorder.current.stop(); stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; };
  const load = async () => { setError(''); try { const me = await api.me(); if (!alive.current) return; setIdentity(me); const values = {idle_activity: me.user.idle_activity ?? 'home', display_name: me.user.display_name, phone_e164: me.user.phone_e164 ?? '', roast_ok: me.user.roast_ok ?? false, allow_voice_by_friends: me.user.allow_voice_by_friends ?? false, receive_villagergrams: me.user.receive_villagergrams ?? false, agent_msgs_ok: me.user.agent_msgs_ok ?? false}; setDraft(values); setSaved(JSON.stringify(values)); } catch (e) { if (alive.current) setError(errorText(e)); } };
  useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; stop(); }; }, []);
  function addFiles(next: File[]) {
    if (next.some(f => !audioTypes.has(f.type.split(';')[0]) || !f.size || f.size > 10 * 1024 * 1024)) { setError('Choose nonempty audio memos, at most 10 MiB each (MP3, WAV, M4A, AAC, OGG, WebM or FLAC).'); return; }
    if (files.length + next.length > 3) { setError('Choose 1–3 memos. Remove a memo before adding another.'); return; }
    setError(''); setFiles([...files, ...next]);
    setConsent(false);
  }
  async function record() {
    setError(''); setStarting(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Recording is unavailable in this browser. Upload an audio memo instead.');
      const media = await navigator.mediaDevices.getUserMedia({audio: true});
      if (!alive.current) { media.getTracks().forEach(t => t.stop()); return; }
      stream.current = media;
      const mimeType = ['audio/webm', 'audio/mp4', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported(t));
      const next = new MediaRecorder(media, mimeType ? { mimeType } : undefined); recorder.current = next;
      const chunks: Blob[] = []; let bytes = 0;
      next.ondataavailable = event => { if (event.data.size) { chunks.push(event.data); bytes += event.data.size; if (bytes >= 9 * 1024 * 1024) stop(); } };
      next.onerror = () => { stop(); if (alive.current) setError('Recording failed. Try uploading a memo instead.'); };
      next.onstop = () => { media.getTracks().forEach(t => t.stop()); clearTimeout(timer.current); if (!alive.current) return; setRecording(false); const type = next.mimeType.split(';')[0]; addFiles([new File(chunks, `memo-${Date.now()}.${type === 'audio/mp4' ? 'm4a' : type === 'audio/ogg' ? 'ogg' : 'webm'}`, {type})]); };
      next.start(1000); setRecording(true); timer.current = setTimeout(stop, 60000);
    } catch (e) { stop(); if (alive.current) setError(errorText(e)); }
    finally { if (alive.current) setStarting(false); }
  }
  async function run(action: () => Promise<void>) { if (locked.current) return; locked.current = true; setBusy(true); setError(''); setStatus(''); try { await action(); } catch (e) { if (alive.current) setError(errorText(e)); } finally { locked.current = false; if (alive.current) setBusy(false); } }
  return <Dialog title="Settings" eyebrow="YOUR PROFILE & VOICE" onClose={onClose} busy={busy} wide className="settings-panel">
    {onSignOut && <button className="button secondary" onClick={onSignOut}>Sign out</button>}
    {error && <p role="alert" className="form-error">{error}</p>}
    {!identity ? <><p>Loading your settings…</p>{error && <button className="button secondary" onClick={() => void load()}>Retry settings</button>}</> : <>
      <p className="modal-intro">Make yourself at home. Choose how you show up and stay in touch.</p>
      <form id="profile-settings" onSubmit={e => { e.preventDefault(); void run(async () => { const me = await api.updateSettings({...draft, display_name: draft.display_name.trim(), phone_e164: draft.phone_e164?.trim() || null}); setIdentity(me); setSaved(JSON.stringify(draft)); setStatus('Settings saved.'); void refresh().catch(() => setError('Settings saved; the village could not refresh. Reopen your profile to retry.')); }); }}>
        <fieldset disabled={busy} className="settings-fields">
          <section className="settings-card"><h3><UserRound aria-hidden="true" />Profile</h3>
            <label>Display name<input required maxLength={100} value={draft.display_name} onChange={e => setDraft({...draft, display_name: e.target.value})} /></label>
            <IdleActivityPicker value={draft.idle_activity ?? 'home'} hasPet={identity.user.has_equipped_pet ?? false} onChange={idle_activity => setDraft({...draft, idle_activity})} />
          </section>
          <section className="settings-card"><h3><AudioLines aria-hidden="true" />Villager-grams &amp; voice</h3>
            <SettingToggle label="Friends may use my avatar and AI voice for silly lines and Villager-grams" help="Friends can write short fictional lines in your avatar's voice. Generated voice lines appear in your village feed. Turn off and save to revoke permission and cancel queued grams." checked={draft.allow_voice_by_friends ?? false} onChange={allow_voice_by_friends => setDraft({...draft, allow_voice_by_friends})} />
            <SettingToggle label="Receive Villager-grams on my phone" help="Up to five per day. Both permissions are off by default." checked={draft.receive_villagergrams ?? false} onChange={receive_villagergrams => setDraft({...draft, receive_villagergrams})} />
            <label>Phone (E.164)<input type="tel" autoComplete="tel" placeholder="+15551234567" pattern="\+[1-9][0-9]{6,14}" aria-describedby="phone-help" value={draft.phone_e164 ?? ''} onChange={e => setDraft({...draft, phone_e164: e.target.value})} /></label>
            <p className="help-text" id="phone-help">Your own number for opted-in Village iMessages. Leave blank to clear it.</p>
      <div className="settings-voice"><h4>My voice</h4><p role="status">{identity.user.voice_id ? `Voice ready${api.mode === 'mock' ? ' (simulated demo)' : ''}. AI-generated voice.` : 'No voice clone yet.'}</p>
        {identity.user.voice_id ? <><p className="help-text">Consent: {identity.user.voice_consent_version ?? 'Version not supplied'} · {identity.user.voice_consent_at ? new Date(identity.user.voice_consent_at).toLocaleString() : 'Date not supplied'}</p><button type="button" className="button secondary" disabled={busy} onClick={() => void run(async () => { const result = await api.deleteVoice(); setIdentity({...identity, user: {...identity.user, ...result}}); setConsent(false); setStatus('Your voice was deleted.'); })}>Delete my voice</button></> : <>
          <p className="help-text">Record or upload 1–3 short memos of your own voice, up to 10 MiB each. Recordings stop after 60 seconds. Samples are sent to ElevenLabs only when you choose Create my voice.</p>
          <fieldset disabled={busy || starting} className="settings-fields">
            <button type="button" className="button secondary" disabled={!recording && files.length >= 3} onClick={() => recording ? stop() : void record()}>{recording ? 'Stop recording' : 'Record a memo'}</button>
            {recording && <p role="status">Recording… microphone is on.</p>}
            <label>Upload voice memos<input type="file" multiple accept="audio/*" disabled={recording || files.length >= 3} onChange={e => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} /></label>
            <ul className="memo-list">{files.map((f, i) => <li key={`${f.name}:${i}`}><span>{f.name} · {Math.ceil(f.size / 1024)} KiB</span><button type="button" className="text-button" disabled={recording} onClick={() => { setFiles(files.filter((_, n) => n !== i)); setConsent(false); }} aria-label={`Remove memo ${i + 1}`}>Remove</button></li>)}</ul>
            <label className="audit-check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />{VOICE_CONSENT_TEXT}</label><small>Consent text version: {VOICE_CONSENT_VERSION}</small>
            <button type="button" className="button primary" disabled={!consent || !files.length || recording} onClick={() => void run(async () => { const result = await api.cloneVoice(files, consent); setIdentity({...identity, user: {...identity.user, ...result}}); setFiles([]); setConsent(false); setStatus('Voice created. AI-generated voice is ready.'); })}>Create my voice</button>
          </fieldset>
        </>}
      </div>
          </section>
          <section className="settings-card"><h3><MessagesSquare aria-hidden="true" />Messages</h3>
            <SettingToggle label="Mayor may text me" help="Get village updates from the Mayor on your linked phone." checked={draft.agent_msgs_ok ?? false} onChange={agent_msgs_ok => setDraft({...draft, agent_msgs_ok})} />
            <SettingToggle label="Roast me" help="Let the Mayor include playful roasts in your updates." checked={draft.roast_ok ?? false} onChange={roast_ok => setDraft({...draft, roast_ok})} />
          </section>
        </fieldset>
      </form>
      <SoundSettings><VoiceBarkSetting key={identity.user.id} user={identity.user.id}/></SoundSettings>
      {onFaceCheck && <section className="settings-card"><h3><ScanFace aria-hidden="true" />Face check</h3><p className="help-text">Optional fun recognition, with no liveness check.</p><button className="button secondary" disabled={busy || recording || starting} onClick={onFaceCheck}>Refresh my face check</button></section>}
      {onDeleted && <DeleteAccount onDeleted={onDeleted} onBusy={setBusy} disabled={busy || recording || starting} />}

    </>}{busy && <p role="status">Saving…</p>}<ToastNotice message={status}/>
    {identity && dirty && <div className="settings-save"><span>Unsaved changes</span><button className="button primary" form="profile-settings" type="submit" disabled={busy || recording || starting || !draft.display_name.trim()}>{busy ? 'Saving...' : 'Save settings'}</button></div>}
  </Dialog>;
}
