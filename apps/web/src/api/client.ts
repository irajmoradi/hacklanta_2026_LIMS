import { cleanVillager, isQa, visibleActivity } from '../components/activityData';
import { canRetry, fetchWithRetry } from './retry';
import { normalizeIssue, normalizeMemory } from './gazette';
import type { Grade, Suggestion, WeekState, Competition, CompetitionInput, CompetitionDetail, CompetitionEntry } from './types';
import { DEMO_USER_ID } from './fixtures';
import { ApiError, MockApi } from './mock';
import type { AgentLog, Review, AvatarManifest, CheckInInput, CheckInResult, FeedItem, Goal, Health, Job, MayorEvent, Me, Profile, Shop, Village, VillageRecord } from './types';

export class VillageApi {
  mode: 'mock' | 'live' = 'live';
  user = import.meta.env.VITE_DEMO_USER || DEMO_USER_ID;
  tokenProvider?: () => Promise<string>;
  private mock = new MockApi();
  async initialize() {
    if (import.meta.env.VITE_MOCK === '1') { this.mode = 'mock'; this.user = DEMO_USER_ID; return; }
    if (this.tokenProvider) { this.mode = 'live'; return; }
    try {
      const response = await fetch('/api/health', { signal: AbortSignal.timeout(2500) });
      if (!response.ok || !(await response.json()).ok) throw new Error('API unavailable');
      this.mode = 'live';
      if (!import.meta.env.VITE_DEMO_USER) this.user = '13370000-0000-4000-8000-000000000001';
    } catch { this.mode = 'mock'; this.user = DEMO_USER_ID; }
  }
  async authHeaders(): Promise<Record<string, string>> {
    return this.tokenProvider ? { Authorization: `Bearer ${await this.tokenProvider()}` } : { 'X-Demo-User': this.user };
  }
  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    if (this.mode === 'mock') return this.mock.request<T>(method, path, this.user, body);
    const multipart = body instanceof FormData;
    const auth = await this.authHeaders();
    const response = await fetchWithRetry(`/api${path}`, {
      method, headers: { ...auth, ...(!multipart && body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
    }, canRetry(method, body));
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const details = Array.isArray(error.detail) ? error.detail.map((issue: { loc?: string[]; msg?: string }) => `${issue.loc?.slice(1).join('.') || 'Request'}: ${issue.msg || 'Invalid value'}`).join('; ') : '';
      throw new ApiError(response.status, typeof error.detail === 'string' ? error.detail : details || `Request failed (${response.status}). Please try again.`);
    }
    if (path.startsWith('/assets/')) return await response.blob() as T;
    return response.status === 204 ? undefined as T : response.json();
  }
  claimSeat = (code: string) => this.request<{user_id: string; village_id: string}>('POST', '/auth/claim-seat', {village_id: code.split('.')[0], code});
  faceVerify = (file: File) => { const form = new FormData(); form.set('file', file); return this.request<{match: boolean; face_found: boolean}>('POST', '/auth/face-verify', form); };
  faceEnroll = () => this.request<{enrolled: boolean; face_found: boolean}>('POST', '/auth/face-enroll');
  messages = (vid: string, box = 'inbox') => this.request<{messages: import('./social').Message[]; unread_count: number}>('GET', `/villages/${vid}/messages?box=${box}&limit=200`);
  sendMessage = (vid: string, to_user_id: string, text: string, kind: import('./social').Message['kind'] = 'message') => this.request<import('./social').Message>('POST', `/villages/${vid}/messages`, {to_user_id, text, kind});
  readMessage = (vid: string, id: string) => this.request<import('./social').Message>('POST', `/villages/${vid}/messages/${id}/read`);
  bribe = (vid: string, coins: number, wish: string) => this.request<import('./social').BribeReceipt>('POST', `/villages/${vid}/mayor/bribe`, {coins, wish, currency: 'coins'});
  heartbeat = (vid: string, activity: string) => this.request<{online: import('./social').Presence[]}>('POST', `/villages/${vid}/presence/heartbeat`, {x: 0, z: 0, activity});
  deleteAccount = () => this.request<{deleted: boolean}>('DELETE', '/me', {confirm: 'DELETE'});
  gazetteLatest = (vid: string) => this.request<any>('GET', `/villages/${vid}/gazette/latest`).then(normalizeIssue).catch(e => { if ((e as { status?: number })?.status === 404) return null; throw e; });
  gazetteArchive = (vid: string) => this.request<any[]>('GET', `/villages/${vid}/gazette?limit=14`).then(list => list.map(normalizeIssue).filter((i): i is import('./gazette').GazetteIssue => !!i));
  mayorMemory = (vid: string) => this.request<any>('GET', `/villages/${vid}/mayor/memory`).then(normalizeMemory);
  updateSettings = (input: Partial<import('./types').SettingsInput & import('./types').HouseSettings>) => this.request<Me>('PATCH', '/me', input);
  updateName = (display_name: string) => this.updateSettings({ display_name });
  cloneVoice = (files: File[], consent: boolean) => {
    if (!consent) return Promise.reject(new Error('Voice consent is required.'));
    const form = new FormData(); files.forEach(file => form.append('files', file)); form.set('consent', 'true');
    return this.request<import('./types').VoiceConsent>('POST', '/me/voice', form);
  };
  deleteVoice = () => this.request<import('./types').VoiceConsent>('DELETE', '/me/voice');
  // Deployed v2 override approves evidence; its request accepts reason only.
  overrideReview = async (vid: string, cid: string, reason: string) => {
    await this.request<unknown>('POST', `/villages/${vid}/check-ins/${cid}/review/override`, { reason });
    return this.review(vid, cid);
  };
  agentLog = (vid: string) => this.request<AgentLog[]>('GET', `/villages/${vid}/agent-log?limit=50`);
  review = (vid: string, cid: string) => this.request<Review>('GET', `/villages/${vid}/check-ins/${cid}/review`);
  stretch = (vid: string, gid: string, title = '') => this.request<Goal>('POST', `/villages/${vid}/goals/${gid}/stretch`, { title });
  finishStretch = (vid: string, gid: string, tier: number) => this.request<Goal>('POST', `/villages/${vid}/goals/${gid}/stretch/${tier}/status`, { status: 'done' });
  goalStatus = (vid: string, gid: string, status: 'done' | 'missed') => this.request<Goal>('POST', `/villages/${vid}/goals/${gid}/status`, { status });
  completeEvent = (vid: string, eid: string, user_ids: string[]) => this.request<unknown>('POST', `/villages/${vid}/events/${eid}/complete`, { user_ids });
  week = (vid: string) => this.request<WeekState>('GET', `/villages/${vid}/weekly/current`);
  suggest = (vid: string, week: string, gid: string, refresh = false) => this.request<Suggestion>('POST', `/villages/${vid}/weekly/${week}/goals/${gid}/suggestion${refresh ? '?refresh=true' : ''}`);
  grade = (vid: string, week: string, gid: string, grade: Grade) => this.request<Grade>('POST', `/villages/${vid}/weekly/${week}/goals/${gid}/grade`, grade);
  finalize = (vid: string, week: string) => this.request<WeekState>('POST', `/villages/${vid}/weekly/${week}/finalize`);
  vote = (vid: string, week: string, generation: number) => this.request<WeekState>('POST', `/villages/${vid}/weekly/${week}/insufficient`, { generation });
  competitions = (vid: string) => this.request<Competition[]>('GET', `/villages/${vid}/competitions`);
  competition = (vid: string, cid: string) => this.request<CompetitionDetail>('GET', `/villages/${vid}/competitions/${cid}`);
  createCompetition = (vid: string, input: CompetitionInput) => this.request<CompetitionDetail>('POST', `/villages/${vid}/competitions`, input);
  joinCompetition = (vid: string, cid: string) => this.request<CompetitionDetail>('POST', `/villages/${vid}/competitions/${cid}/join`);
  enterCompetition = (vid: string, cid: string, input: {value?: number; body: string; evidence_asset_id?: string; idempotency_key: string}) => this.request<CompetitionEntry>('POST', `/villages/${vid}/competitions/${cid}/entries`, input);
  decideEntry = (vid: string, cid: string, eid: string, input: {value?: number; decision: 'confirmed' | 'rejected'; points: number; reason: string}) => this.request<CompetitionEntry>('POST', `/villages/${vid}/competitions/${cid}/entries/${eid}/decision`, input);
  settleCompetition = (vid: string, cid: string) => this.request<Competition>('POST', `/villages/${vid}/competitions/${cid}/settle`);
  health = () => this.request<Health>('GET', '/health');
  me = () => this.request<Me>('GET', '/me');
  createVillage = (name: string) => this.request<{ village: VillageRecord }>('POST', '/villages', { name });
  joinVillage = (invite_code: string) => this.request<{ village: VillageRecord }>('POST', '/villages/join', { invite_code });
  village = (vid: string) => this.request<Village>('GET', `/villages/${vid}`).then(v => ({...v, villagers: v.villagers.map(cleanVillager)}));
  accomplishments = (vid: string) => this.request<import('./reactions').Accomplishment[]>('GET', `/villages/${vid}/accomplishments?limit=100`);
  react = (vid: string, target: import('./reactions').ReactionTarget, emoji: import('./reactions').Emoji, remove = false) => this.request<import('./reactions').Reaction[]>(remove ? 'DELETE' : 'POST', `/villages/${vid}/reactions`, {...target, emoji});
  feed = (vid: string) => this.request<FeedItem[]>('GET', `/villages/${vid}/feed?limit=50`).then(rows => rows.filter(item => visibleActivity(item)));
  profile = (vid: string, uid: string) => this.request<Profile>('GET', `/villages/${vid}/users/${uid}`).then(p => ({...p, villager: cleanVillager(p.villager), check_ins: p.check_ins.filter(c => !isQa(c.body))}));
  goal = (vid: string, title: string, detail?: string) => this.request<Goal>('POST', `/villages/${vid}/goals`, { title, detail });
  checkIn = (vid: string, body: CheckInInput) => this.request<CheckInResult>('POST', `/villages/${vid}/check-ins`, body);
  evidence = (vid: string, file: File) => { const form = new FormData(); form.set('file', file); return this.request<{ evidence_asset_id: string }>('POST', `/villages/${vid}/evidence`, form); };
  shop = (vid: string) => this.request<Shop>('GET', `/villages/${vid}/shop`);
  photoItems = (vid: string) => this.request<{photo_item_tokens: number; items: (Omit<import('./types').EquippedItem, 'item_id' | 'asset_key'> & {id: string; created_at: string; equipped: boolean})[]}>('GET', `/villages/${vid}/items`);
  itemColors = (vid: string, item: string, colors: import('./types').ItemColors) => this.request<{item_id: string; colors: import('./types').ItemColors}>('PATCH', `/villages/${vid}/inventory/${encodeURIComponent(item)}/colors`, {colors});
  buy = (vid: string, item_id: string) => this.request<{ balance: number; inventory: { item_id: string; equipped: boolean }[] }>('POST', `/villages/${vid}/shop/buy`, { item_id });
  equip = (vid: string, item_id: string) => this.request<import('./types').Equipment>('POST', `/villages/${vid}/inventory/equip`, { item_id });
  unequip = (vid: string, item_id: string) => this.request<import('./types').Equipment>('POST', `/villages/${vid}/inventory/unequip`, { item_id });
  pray = (vid: string, text: string) => this.request<MayorEvent>('POST', `/villages/${vid}/mayor/pray`, { text });
  recap = (vid: string) => this.request<MayorEvent>('POST', `/villages/${vid}/mayor/recap`);
  nudge = (vid: string, target_user_id: string) => this.request<{ text: string; audio_url: string | null }>('POST', `/villages/${vid}/mayor/nudge`, { target_user_id });
  voice = (user_id: string, text: string, village_id?: string) => this.request<{ id: string; audio_url: string | null; expr_url?: string }>('POST', '/voice/lines', { user_id, text, ...(village_id ? { village_id } : {}) });
  avatar = (uid: string) => this.request<AvatarManifest>('GET', `/avatars/${uid}`);
  photo = (uid: string, file: File) => { const form = new FormData(); form.set('file', file); form.set('consent', 'true'); return this.request<{ job_id: string }>('POST', `/avatars/${uid}/photo`, form); };
  job = (jobId: string) => this.request<Job>('GET', `/jobs/${jobId}`);
  groupPhoto = (vid: string, job: string) => this.request<import('./types').GroupPhoto>('GET', `/villages/${vid}/group-photo/${encodeURIComponent(job)}`);
  uploadGroupPhoto = (vid: string, file: File, consent: boolean) => {
    if (!consent) return Promise.reject(new Error('Group consent is required.'));
    const form = new FormData(); form.set('file', file); form.set('consent', 'true');
    return this.request<{ job_id: string }>('POST', `/villages/${vid}/group-photo`, form);
  };
  claimGroupPhoto = (vid: string, job: string, crop_id: string) => this.request<{ job_id: string }>('POST', `/villages/${vid}/group-photo/${encodeURIComponent(job)}/claim`, { crop_id });
  asset = (key: string) => this.request<Blob>('GET', `/assets/${key.split('/').map(encodeURIComponent).join('/')}`);
}
export const api = new VillageApi();
