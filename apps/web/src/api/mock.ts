import { readingMonday, readingLink, type ReadingItem } from './reading';
import houseOptionsRegistry from '../../../../packages/catalog/house-options.json' with { type: 'json' };
import { headPresets } from './headPresets';
import { idleActivities } from './idleActivity';
import type { EquippedItem, Villager, IdleActivity } from './types';
import { ReactionMock } from './reactionMock';
import type { Message, Presence } from './social';
import { HOUSE_STYLES, validHouseColors } from '../scene/houseStyles';
import { demoGazette, demoMemory } from './gazette';
import { catalog, equipmentFor, replaceSlot } from './equipment';
import { buildings } from './world';
import { demoWorld } from './world';
import type { ItemColors, GroupPhoto } from './types';
import { AuditMock } from './auditMock';
import { DEMO_VILLAGE_ID, makeFixtures, monday } from './fixtures';
import { levelFor, type AgentLog, type Review, type CheckInInput, type CheckInResult, type FeedItem, type Job, type MayorEvent, type Profile, type ShopItem, type Village, type VillageRecord } from './types';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = 'ApiError'; }
}
type State = { village: Village; profiles: Record<string, Profile>; feed: FeedItem[]; record: VillageRecord };
const copy = <T,>(value: T): T => structuredClone(value);
const id = () => crypto.randomUUID();
const fail = (status: number, message: string): never => { throw new ApiError(status, message); };
function nonempty(value: unknown, field: string, max = 1000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) return fail(422, `${field} must be between 1 and ${max} characters.`);
  return value.trim();
}

/** In-memory contract implementation. All state is scoped to this instance/tab. No provider calls. */
export class MockApi {
  private readingItems = new Map<string, ReadingItem[]>();
  private headCache = new Map<string, object>();
  private headCounts = new Map<string, number>();
  private guests = new Map<string, Villager>();
  private guestNumber = 0;
  private photoTokens = new Map<string, number>();
  private photoJobs = new Map<string, {id: string; owner: string; vid: string; started: number; fail: boolean; refunded: boolean; item: EquippedItem & {id: string; created_at: string}; status: string}>();
  private grams = new Map<string, {sender: string; recipient: string; day: string}>();
  private reactions = new ReactionMock();
  private debugKeys = new Set<string>();
  private debugWeather = false;
  private lastDisaster = "";
  private awayPets = new Map<string, import('./types').EquippedItem[]>();
  private restorePets(village: Village, uid?: string) {
    let count=0;
    for(const person of village.villagers) if(!uid||person.user_id===uid) {
      const key=`${village.id}:${person.user_id}`, pets=this.awayPets.get(key)??[];
      person.equipped.push(...pets);person.equipped_ids=person.equipped.map(i=>i.item_id);
      count+=pets.length;this.awayPets.delete(key);
    }
    return count;
  }
  private seats = new Map<string, { user_id: string; at: number }>();
  private faceTimes = new Map<string, number[]>();
  private faceVerified = new Map<string, number>();
  private messages: Message[] = [];
  private presence = new Map<string, Presence & {at: number}>();
  private itemColors = new Map<string, ItemColors>();
  private inventory = new Map<string, Set<string>>();
  private groupPhotos = new Map<string, { vid: string; photo: GroupPhoto }>();
  private simulatedJobs = new Map<string, number>();
  private settings = new Map<string, Record<string, unknown>>();
  private audits = new AuditMock(fail);
  private states = new Map<string, State>();
  private retries = new Map<string, CheckInResult>();
  private goalAwards = new Set<string>();
  private assets = new Map<string, Blob>([['arena-demo-evidence.svg', new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="480" height="240"><rect width="480" height="240" fill="#e9e2d2"/><rect x="40" y="30" width="400" height="180" rx="12" fill="#fffaf0"/><path d="M80 155 L155 130 L235 145 L310 90 L395 60" fill="none" stroke="#3b9790" stroke-width="8"/><text x="60" y="65" font-family="sans-serif" font-size="18" fill="#384852">DEMO: focus session progress</text></svg>'], {type:'image/svg+xml'})]]);
  private evidenceOwners = new Map<string, string>();
  private eventAwards = new Set<string>();
  private logs: AgentLog[] = [
    { created_at: new Date().toISOString(), agent: 'mayor', action: 'Proposed a shared weekly challenge', target_user_id: null, reason: 'Small, shared wins help all five neighbors participate.', model: 'scripted-demo' },
    { created_at: new Date().toISOString(), agent: 'auditor', action: 'Waiting for evidence', target_user_id: null, reason: 'Evidence is reviewed only after a villager chooses to submit it.', model: 'scripted-demo' },
    { created_at: new Date().toISOString(), agent: 'scheduler', action: 'Weekly recap scheduled', target_user_id: null, reason: 'Let everyone finish the week before reflecting on progress.', model: 'scripted-demo' },
  ];
  private jobs = new Map<string, Job>();

  constructor() {
    const { village, profiles } = makeFixtures();
    const feed = Object.values(profiles).flatMap(p => p.check_ins.map(c => ({ id: `feed-${c.id}`, created_at: c.created_at, user_id: c.user_id, type: 'checkin', text: `${p.villager.display_name}: ${c.body}`, payload: { kind: c.kind } }))).sort((a, b) => b.created_at.localeCompare(a.created_at));
    this.states.set(village.id, { village, profiles, feed, record: { id: village.id, name: village.name, seed: village.seed, invite_code: 'HACKLANTA' } });
    Object.values(profiles).forEach(p => this.goalAwards.add(`${village.id}:${p.villager.user_id}:${p.goal!.week_start}`));
  }

  async request<T>(method: string, path: string, user: string, input?: unknown): Promise<T> {
    // Clone replies just like an HTTP boundary; React cannot accidentally mutate server state.
    return copy(await this.route(method, path, user, input)) as T;
  }

  private async route(method: string, path: string, user: string, input?: unknown): Promise<unknown> {
    const url = new URL(path, 'http://mock.local');
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const data = (input ?? {}) as Record<string, unknown>;
    const base = this.states.get(DEMO_VILLAGE_ID)!;
    const identity = base.profiles[user]?.villager ?? this.guests.get(user);
    if (method === 'GET' && path === '/health') return { ok: true, db: 'memory', gpu_worker: 'down', build: 'web-demo-v1' };
    if (!identity) return fail(401, 'Choose a demo villager to continue.');
    const me = () => ({ user: { id: user, display_name: identity.display_name, idle_activity: identity.idle_activity ?? 'home', has_equipped_pet: [...this.states.values()].some(s => s.profiles[user]?.villager.equipped.some(i => i.slot === 'pet')), face_verified_at: Date.now() - (this.faceVerified.get(user) ?? 0) < 300000 ? new Date(this.faceVerified.get(user)!).toISOString() : null, roast_ok: false, agent_msgs_ok: false, phone_e164: null, voice_id: null, voice_consent: false, ...this.settings.get(user) }, villages: [...this.states.values()].filter(s => s.profiles[user]).map(s => ({ id: s.village.id, name: s.village.name })) });
    if (parts[0] === 'demo') {
      if (path === '/demo/guests' && method === 'POST') {
        const uid = id(), display_name = `Guest ${++this.guestNumber}`;
        this.guests.set(uid, {...copy(base.village.villagers[0]),user_id:uid,display_name,coins:0,xp:0,level:1,equipped:[],equipped_ids:[],house_level:1});
        return {id:uid,display_name};
      }
      if (path === '/demo/guests' && method === 'DELETE') {
        const removed = this.guests.size;
        for (const uid of this.guests.keys()) for (const state of this.states.values()) { delete state.profiles[uid]; state.village.villagers = state.village.villagers.filter(v => v.user_id !== uid); }
        this.guests.clear(); return {removed,seat:base.village.villagers[0].user_id};
      }
      if (path === '/demo/debug' && method === 'GET') return {enabled: true};
      for (const [key, seat] of this.seats) if (Date.now() - seat.at > 600000) this.seats.delete(key);
      if (path === '/demo/seats') return {seats: [...this.seats.values()]};
      if (path === '/demo/seat') {
        if (data.user_id !== user) return fail(403, 'Claim your own seat');
        this.seats.set(String(data.client_id), {user_id: user, at: Date.now()});
        return {conflict: [...this.seats].some(([key, seat]) => key !== data.client_id && seat.user_id === user)};
      }
      const action = parts[2], key = `${user}:${data.idempotency_key}`;
      if (this.debugKeys.has(key)) return {ok: true, replayed: true};
      const profile = base.profiles[user];
      if (action === 'xp') { const earned = base.village.world?.xp ?? base.village.villagers.reduce((sum, p) => sum + p.xp, 0); identity.xp += Number(data.amount); identity.coins += Number(data.amount); identity.level = levelFor(identity.xp); base.village.world = {...base.village.world, ...demoWorld(earned + Number(data.amount))}; }
      else if (action === 'coins') identity.coins += Number(data.amount);
      else if (action === 'inventory') { this.inventory.set(`${base.village.id}:${user}`, new Set()); identity.equipped = []; identity.equipped_ids = []; identity.house_level = 1; }
      else if (action === 'week') { profile.goal = null; profile.check_ins = profile.check_ins.filter(c => c.created_at.slice(0,10) < monday()); }
      else if (action === 'goal-done') { if (!profile.goal) return fail(409, 'Set a weekly goal first'); profile.goal.status = 'done'; }
      else if (action === 'weather') {if(base.village.world?.disaster?.kind==='blackout') fail(409,'Repair the blackout first');this.debugWeather = !this.debugWeather;}
      else if (action === 'disaster') {
        base.village.world ??= demoWorld(2500);
        if(base.village.world.disaster) fail(409,'Repair the current disaster first');
        const kind=data.disaster as import('./types').Disaster['kind'];
        if(!['scorch','outbreak','blackout','blight'].includes(kind)||kind===this.lastDisaster) fail(409,'Choose a different disaster');
        const body={scorch:'Meteor scorch! The pet shelter is closed for repairs.',outbreak:'Shelter pets are visiting the vet. Repair within 48 hours to keep your pets home.',blackout:'Storm blackout. The festival is off until the lights are back.',blight:'Garden blight! Gardening and its bonus are paused.'}[kind];
        base.village.world.disaster={kind,title:kind,body,started_at:new Date().toISOString(),deadline:new Date(Date.now()+48*3600000).toISOString(),repair_event_id:id(),target_checkins:6,target_people:3,checkins:0,people:0,closed_building:kind==='scorch'?'pet_shelter':null,pets_away:false};
        this.lastDisaster=kind;
      }
      else if(action==='repair') {if(base.village.world?.disaster){this.restorePets(base.village);base.village.world.disaster=null;base.village.world.rebuilt_at=new Date().toISOString();}}
      else if (action === 'event') base.village.active_events.unshift({id: id(), kind: 'random_event', title: 'Share a tiny win', body: 'Offline debug Mayor event', reward_xp: 50, penalty: null, status: 'active', ends_at: null});
      else if (action === 'reset') {
        if (data.confirm !== 'RESET') return fail(422, 'Confirm with RESET');
        const fixture = makeFixtures(); base.village = fixture.village; base.profiles = fixture.profiles;
        this.debugWeather = false; this.inventory.clear();
      } else return fail(404, 'Unknown debug action');
      this.debugKeys.add(key);
      base.feed.unshift({id: id(), created_at: new Date().toISOString(), user_id: user, type: 'debug', text: `\u{1f41e} debug: ${action} - ${data.reason}`, payload: {}});
      return {ok: true, replayed: false};
    }

    if (method === 'POST' && ['/auth/face-verify', '/auth/face-enroll'].includes(path)) {
      const times = (this.faceTimes.get(user) ?? []).filter(t => Date.now() - t < 60000);
      if (times.length >= 5) return fail(429, 'Five tries per minute.');
      this.faceTimes.set(user, [...times, Date.now()]);
      if (path.endsWith('face-enroll')) { this.faceVerified.delete(user); return {enrolled: true, face_found: true}; }
      const file = input instanceof FormData ? input.get('file') : null;
      if (!(file instanceof File)) return fail(422, 'Choose a selfie.');
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return fail(415, 'Unsupported image.');
      if (!file.size || file.size > 8 * 1024 * 1024) return fail(413, 'Invalid image size.');
      if (file.name === 'offline.jpg') return fail(503, 'Worker offline.');
      if (file.name === 'limited.jpg') return fail(429, 'Five tries per minute.');
      const face_found = file.name !== 'no-face.jpg', match = face_found && file.name !== 'mismatch.jpg';
      if (match) this.faceVerified.set(user, Date.now());
      return {match, face_found};
    }
    if (method === 'PATCH' && path === '/me') {
      const houseKeys = ['house_style', 'house_colors', 'house_variant', 'house_materials'].filter(k => k in data);
      let housePerson;
      if (houseKeys.length) {
        if (!data.village_id) fail(422, 'village_id is required for house settings');
        housePerson = this.states.get(String(data.village_id))?.profiles[user]?.villager;
        if (!housePerson) return fail(403, 'Village membership required');
        if ('house_style' in data && data.house_style !== null && !HOUSE_STYLES.includes(data.house_style as typeof HOUSE_STYLES[number])) fail(422, 'Invalid house style');
        if ('house_colors' in data && data.house_colors !== null && !validHouseColors(data.house_colors)) fail(422, 'Invalid house colors');
      }
      for (const key of ['house_variant', 'house_materials'] as const) {
        if (!(key in data) || data[key] === null) continue;
        const value = data[key];
        const choices: Record<string, string[]> = houseOptionsRegistry[key === 'house_variant' ? 'variants' : 'materials'];
        if (!value || typeof value !== 'object' || Array.isArray(value) || Object.entries(value).some(([part, choice]) => typeof choice !== 'string' || !choices[part]?.includes(choice))) fail(422, 'Invalid house options');
      }
      const changes: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (['village_id', ...houseKeys].includes(key)) continue;
        if (key === 'display_name') changes[key] = nonempty(value, 'Display name', 100);
        else if (key === 'idle_activity' && typeof value === 'string' && Object.hasOwn(idleActivities, value)) { if (value === 'walk_pet' && !me().user.has_equipped_pet) fail(422, 'Equip a pet before choosing Walking Pet.'); changes[key] = value; }
        else if (key === 'phone_e164') { if (value !== null && (typeof value !== 'string' || !/^\+[1-9][0-9]{6,14}$/.test(value))) fail(422, 'Use an E.164 phone number.'); changes[key] = value; }
        else if (['roast_ok', 'agent_msgs_ok', 'allow_voice_by_friends', 'receive_villagergrams'].includes(key) && typeof value === 'boolean') changes[key] = value;
        else fail(422, 'Invalid settings field.');
      }
      if (housePerson) for (const key of houseKeys) Object.assign(housePerson, {[key]: data[key]});
      if (changes.display_name && this.guests.has(user)) this.guests.get(user)!.display_name = String(changes.display_name);
      if (changes.display_name) for (const state of this.states.values()) if (state.profiles[user]) state.profiles[user].villager.display_name = String(changes.display_name);
      if (changes.idle_activity) for (const state of this.states.values()) if (state.profiles[user]) state.profiles[user].villager.idle_activity = changes.idle_activity as IdleActivity;
      this.settings.set(user, {...this.settings.get(user), ...changes}); return me();
    }
    if (method === 'DELETE' && path === '/me') {
      if (data.confirm !== 'DELETE') return fail(422, 'Type DELETE to confirm.');
      this.messages = this.messages.filter(m => m.from_user_id !== user && m.to_user_id !== user);
      for (const state of this.states.values()) { delete state.profiles[user]; state.village.villagers = state.village.villagers.filter(v => v.user_id !== user); state.feed = state.feed.filter(f => f.user_id !== user); if (state.village.owner_user_id === user) state.village.owner_user_id = state.village.villagers[0]?.user_id; }
      this.settings.delete(user); for (const [key, p] of this.presence) if (p.user_id === user) this.presence.delete(key);
      return {deleted: true, audit_id: id()};
    }
    if (method === 'GET' && path === '/me') return me();
    if (path === '/me/voice' && ['POST', 'DELETE'].includes(method)) {
      if (method === 'POST') {
        if (me().user.voice_id) fail(409, 'Delete your existing voice before replacing it.');
        if (!(input instanceof FormData) || input.get('consent') !== 'true') return fail(422, 'Voice consent is required.');
        const files = input.getAll('files');
        if (!files.length || files.length > 3) fail(422, 'Choose 1-3 memos.');
        for (const file of files) {
          if (!(file instanceof Blob) || !/^audio\/(mpeg|mp3|wav|x-wav|mp4|x-m4a|aac|ogg|webm|flac)(;|$)/.test(file.type)) return fail(415, 'Unsupported audio type.');
          if (!file.size || file.size > 10 * 1024 * 1024) fail(413, 'Memo must be nonempty and at most 10 MiB.');
        }
      }
      const voice = { voice_id: method === 'POST' ? 'simulated-demo-voice' : null, voice_consent: method === 'POST', voice_consent_at: method === 'POST' ? new Date().toISOString() : null, voice_consent_version: method === 'POST' ? 'village-voice-v1' : null };
      this.settings.set(user, {...this.settings.get(user), ...voice}); return voice;
    }
    if (method === 'POST' && path === '/villages') {
      const name = nonempty(data.name, 'Village name', 80);
      const village: Village = { owner_user_id: user, id: id(), name, seed: Math.floor(Math.random() * 1000000), villagers: [copy({ ...identity, house_slot: 0, house_style: null, house_colors: null, house_variant: null, house_materials: null })], active_events: [] };
      const record = { id: village.id, name, seed: village.seed, invite_code: id().slice(0, 8).toUpperCase() };
      this.states.set(village.id, { village, record, profiles: { [user]: { villager: village.villagers[0], goal: null, past_goals: [], check_ins: [] } }, feed: [] });
      return { village: record };
    }
    if (method === 'POST' && path === '/villages/join') {
      const code = nonempty(data.invite_code, 'Invite code', 80).toUpperCase();
      const state = [...this.states.values()].find(s => s.record.invite_code === code);
      if (!state) return fail(404, 'That invite code was not found.');
      if (!state.profiles[user]) {
        const villager = copy({ ...identity, house_slot: state.village.villagers.length, house_style: null, house_colors: null, house_variant: null, house_materials: null });
        state.village.villagers.push(villager);
        state.profiles[user] = { villager, goal: null, past_goals: [], check_ins: [] };
      }
      return { village: state.record };
    }
    if (parts[0] === 'avatars') {
      const p = base.profiles[parts[1]];
      if (!p) return fail(404, 'Villager not found.');
      if (method === 'GET' && parts.length === 2) return p.villager.avatar;
      if (method === 'POST' && parts[2] === 'photo') {
        if (parts[1] !== user) return fail(403, 'You can only update your own avatar.');
        if (!(input instanceof FormData) || input.get('consent') !== 'true') return fail(422, 'Photo consent is required.');
        this.upload(input);
        const job_id = id();
        this.jobs.set(job_id, { id: job_id, stage: 'segment', status: 'failed', error: 'The GPU worker is offline in demo mode. Your preset avatar is still available.' });
        return { job_id };
      }
    }
    if (method === 'GET' && parts[0] === 'jobs') {
      const job = this.jobs.get(parts[1]) ?? fail(404, 'Job not found.');
      const started = this.simulatedJobs.get(job.id);
      if (started !== undefined) { const age = Date.now() - started; job.stage = age < 1800 ? 'segment' : age < 4200 ? 'head' : 'stylized head'; job.status = age < 7000 ? 'running' : 'ready'; }
      return job;
    }
    if (method === 'GET' && parts[0] === 'assets') return this.assets.get(parts.slice(1).join('/')) ?? fail(404, 'Asset not found.');
    if (method === 'GET' && path === '/heads/presets') return {presets: headPresets};
    if (method === 'POST' && path === '/heads/chorus') {
      const selected = data.village_id ? this.states.get(String(data.village_id)) : base;
      if (!selected?.profiles[user]) return fail(403, 'Join this village first.');
      const members = [];
      let line:Record<string,unknown> = data.text ? {text:data.text} : {preset_id:data.preset_id};
      for (const speaker of Object.keys(selected.profiles).filter(id=>(id===user||this.settings.get(id)?.allow_voice_by_friends)&&(!Array.isArray(data.member_ids)||data.member_ids.includes(id)))) {
        try {
          const result = await this.route('POST', `/heads/${speaker}/say`, user, line) as {text:string};
          line = {text:result.text};
          members.push({...result,user_id:speaker,video_url:null,status:'unavailable'});
        } catch { members.push({user_id:speaker,audio_url:null,video_url:null,status:'error'}); }
      }
      return {members};
    }
    if (method === 'POST' && parts[0] === 'heads' && parts[2] === 'say') {
      const speaker = parts[1];
      if (![...this.states.values()].some(s => s.profiles[user] && s.profiles[speaker])) return fail(403, 'A shared village is required.');
      if (speaker !== user && !this.settings.get(speaker)?.allow_voice_by_friends) return fail(403, 'This neighbor has not allowed friends to use their AI voice.');
      if ((data.text === undefined) === (data.preset_id === undefined)) return fail(422, 'Choose text or preset_id.');
      const text = data.text !== undefined ? nonempty(data.text, 'Text', 100) : data.preset_id === 'surprise' ? 'The council of frogs approves.' : headPresets.find(p => p.id === data.preset_id)?.text;
      if (!text) return fail(422, 'Unknown preset.');
      const key = `${speaker}:${text}`, old = this.headCache.get(key);
      if (old) return {...old, cached: true};
      const day = `${user}:${new Date().toISOString().slice(0,10)}`, count = this.headCounts.get(day) ?? 0;
      if (count >= 10) return fail(429, 'Daily limit: 10 new head generations (UTC).');
      this.headCounts.set(day, count + 1);
      const line = {id: id(), text, audio_url: '/heads-demo.wav', expr_url: null, cached: false};
      this.headCache.set(key, line);
      return line;
    }
    if (method === 'POST' && path === '/voice/lines') {
      if (!base.profiles[String(data.user_id)]) return fail(404, 'Villager not found.');
      if (data.village_id) { const selected = this.states.get(String(data.village_id)); if (!selected?.profiles[user] || !selected.profiles[String(data.user_id)]) return fail(403, 'Both speakers must belong to this village.'); }
      nonempty(data.text, 'Voice line');
      return { id: id(), audio_url: null }; // Explicitly unavailable; never pretend a beep is someone's voice.
    }
    // Internal routes use synthetic demo phone aliases only, never a messaging provider.
    if (method === 'GET' && path === '/internal/outbox') return [];
    if (method === 'POST' && /^\/internal\/outbox\/[^/]+\/sent$/.test(path)) return { ok: true };
    if (method === 'POST' && path === '/internal/inbound') {
      const text = nonempty(data.text, 'Message');
      const phone = nonempty(data.phone_e164, 'Phone alias', 30);
      const match = /^\+1555000000([1-5])$/.exec(phone);
      if (!match) return { reply_text: 'This phone is not linked to a demo villager.' };
      const sender = `00000000-0000-4000-8000-00000000000${match[1]}`;
      if (/^checkin:/i.test(text)) {
        const result = await this.route('POST', `/villages/${DEMO_VILLAGE_ID}/check-ins`, sender, { kind: 'status', body: text.slice(8).trim(), idempotency_key: id() }) as CheckInResult;
        return { reply_text: `Your village heard you. Check-in saved! +${result.xp_awarded} XP.` };
      }
      return { reply_text: `How is your goal going, ${base.profiles[sender].villager.display_name}?` };
    }
    if (parts[0] !== 'villages') return fail(404, 'Endpoint not found.');
    const state = this.states.get(parts[1]);
    if (!state) return fail(404, 'Village not found.');
    const profile = state.profiles[user];
    if (!profile) return fail(403, 'Join this village first.');
    if (parts[2] === 'messages') {
      const mine = this.messages.filter(m => m.village_id === state.village.id);
      const unread_count = mine.filter(m => m.to_user_id === user && !m.read_at).length;
      if (method === 'GET') { if (parts[3] === 'unread') return {unread_count};
        const rows = mine.filter(m => url.searchParams.get('box') === 'outbox' ? m.from_user_id === user : m.to_user_id === user);
        const offset = Number(url.searchParams.get('offset')) || 0;
        return {messages: rows.slice(offset, offset + (Number(url.searchParams.get('limit')) || 50)), unread_count}; }
      if (parts[4] === 'read') { const m = mine.find(m => m.id === parts[3] && m.to_user_id === user); if (!m) return fail(404, 'Message not found.'); m.read_at ??= new Date().toISOString(); return m; }
      if (Object.keys(data).some(key => !['to_user_id','text','kind'].includes(key))) return fail(422, 'Unexpected message field.');
      if (this.messages.filter(m => m.from_user_id === user && Date.now() - Date.parse(m.created_at) < 60000).length >= 20) return fail(429, 'Too many messages. Wait 60 seconds.');
      const recipient = state.profiles[String(data.to_user_id)];
      if (!recipient || data.to_user_id === user) return fail(422, 'Choose another village member.');
      const kind = data.kind ?? 'message'; if (!['message', 'poke', 'cheer'].includes(String(kind))) return fail(422, 'Invalid message kind.');
      const message: Message = {id: id(), village_id: state.village.id, from_user_id: user, to_user_id: String(data.to_user_id), text: nonempty(data.text, 'Message', 2000), kind: kind as Message['kind'], created_at: new Date().toISOString(), read_at: null};
      this.messages.unshift(message);
      if (kind !== 'message') state.feed.unshift({id: id(), created_at: message.created_at, user_id: user, type: String(kind), text: `${profile.villager.display_name} ${kind === 'poke' ? 'poked' : 'cheered'} ${recipient.villager.display_name}: ${message.text}`, payload: {message_id: message.id, to_user_id: message.to_user_id, text: message.text}});
      return message;
    }
    if (parts[2] === 'presence') {
      if (method === 'POST') {
        if (typeof data.x !== 'number' || typeof data.z !== 'number' || !Number.isFinite(data.x) || !Number.isFinite(data.z) || Math.abs(data.x) > 10000 || Math.abs(data.z) > 10000) return fail(422, 'Invalid presence coordinates.');
        this.presence.set(`${parts[1]}:${user}`, {user_id: user, x: data.x, z: data.z, activity: nonempty(data.activity ?? 'idle', 'Activity', 80), at: Date.now()});
      }
      return {online: [...this.presence.entries()].filter(([key, p]) => key.startsWith(`${parts[1]}:`) && Date.now() - p.at < 30000).map(([, {at: _, ...p}]) => p)};
    }
    if (parts[2] === 'mayor' && parts[3] === 'bribe' && method === 'POST') {
      const coins = Number(data.coins), wish = nonempty(data.wish, 'Wish', 1000);
      if ((data.currency !== undefined && data.currency !== 'coins') || typeof data.coins !== 'number' || !Number.isInteger(coins) || coins < 1 || coins > 10000) return fail(422, 'Choose 1-10,000 coins.');
      if (profile.villager.coins < coins) return fail(409, 'Not enough coins.');
      profile.villager.coins -= coins;
      return {bribe: {id: id(), village_id: parts[1], user_id: user, coins, wish, status: 'pending', created_at: new Date().toISOString()}, balance: profile.villager.coins, receipt: `The Mayor pockets ${coins} coins and winks.`};
    }
    if (method === 'GET' && parts[2] === 'gazette') {
      const issues = demoGazette(state.village);
      return parts[3] === 'latest' ? issues[0] : issues.slice(0, Math.max(1, Math.min(30, Number(url.searchParams.get('limit')) || 14)));
    }
    if (method === 'GET' && parts[2] === 'mayor' && parts[3] === 'memory') return demoMemory(state.village);
    if(parts[2]==='treasury')return {enabled:true,cluster:'devnet',used_xp:0,daily_cap_xp:1000,lamports_per_xp:'100000'};
    if(parts[2]==='solana')return fail(409,'Mock mode does not send Solana transactions.');
    if (parts[2] === 'weekly' || parts[2] === 'competitions') {
      const result = this.audits.route(method, parts, user, data, state, key => this.evidenceOwners.get(key) === `${state.village.id}:${user}`);
      if (parts[2] === 'weekly' && result && typeof result === 'object' && 'week_start' in result) {
        const readers = (this.readingItems.get(`${state.village.id}:${result.week_start}`) ?? []).flatMap(i => i.readers);
        return {...result, reading_bonus: [...new Set(readers.map(r => r.user_id))].map(uid => ({user_id:uid, completed:readers.filter(r => r.user_id === uid).length, xp:readers.filter(r => r.user_id === uid && r.awarded).length * 5}))};
      }
      return result;
    }
    if (parts[2] === 'reactions' && ['POST', 'DELETE'].includes(method)) {
      const event = state.feed.find(e => e.id === data.target_id && e.type === 'reading_completed');
      if (event && (event.payload as {week_start:string}).week_start !== readingMonday()) return fail(409, 'Past reading weeks are read-only');
      return this.reactions.change(state.village.id, user, data, method === 'DELETE', state.profiles, state.feed, fail);
    }
    if (parts[2] === 'accomplishments' && method === 'GET') {
      const limit = Number(url.searchParams.get('limit') ?? 50);
      if (!Number.isInteger(limit) || limit < 1 || limit > 200) return fail(422, 'Limit must be 1 to 200.');
      return this.reactions.accomplishments(state.village.id, user, state.profiles, state.feed).slice(0, limit);
    }
    const person = profile.villager;
    const addFeed = (type: string, text: string, payload: object = {}) => state.feed.unshift({ id: id(), created_at: new Date().toISOString(), user_id: user, type, text, payload });
    const award = (amount: number) => { const earned = state.village.world?.xp ?? state.village.villagers.reduce((sum,p)=>sum+p.xp,0); const before = person.level; person.xp += amount; person.coins += amount; person.level = levelFor(person.xp); state.village.world = {...state.village.world, ...demoWorld(earned + Math.max(0,amount))}; if (person.level > before) addFeed('level_up', `${person.display_name} reached level ${person.level}!`, {level: person.level}); };
    if (parts[2] === 'reading') {
      const week = url.searchParams.get('week_start') ?? readingMonday();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(week) || !Number.isFinite(Date.parse(week)) || new Date(week).getUTCDay() !== 1 || week > readingMonday()) return fail(422, 'Use a current or past UTC Monday');
      const key = `${state.village.id}:${week}`, items = this.readingItems.get(key) ?? [];
      this.readingItems.set(key, items);
      const count = () => items.flatMap(i => i.readers).filter(r => r.user_id === user && r.awarded).length;
      const response = () => ({week_start: week, read_only: week !== readingMonday(), awarded_count: count(), items: items.map(i => ({...i, readers: i.readers.map(r => ({...r, reactions: this.reactions.summary(state.village.id, 'activity', r.activity_id, user)}))}))});
      if (method === 'GET') return response();
      if (week !== readingMonday()) return fail(409, 'Past reading weeks are read-only');
      if (method === 'POST' && parts[3] === 'suggest') return {items: [{title: 'Atomic Habits', author: 'James Clear', link: '', why: 'Small, consistent steps toward our weekly goals.'}]};
      if (method === 'POST' && parts.length === 3) {
        if (items.length >= 10) return fail(409, "This week's ten reading spots are full");
        const title = nonempty(data.title, 'Title', 180);
        const optional = (field: string, max: number) => { const value = data[field] ?? ''; if (typeof value !== 'string' || value.length > max) return fail(422, `Invalid ${field}`); return value.trim(); };
        const link = optional('link', 2000), author = optional('author',120), why = optional('why',500);
        if (link && !readingLink(link)) return fail(422, 'Use an http or https link');
        items.push({id:id(), user_id:user, title, link, author, why, readers:[]}); return response();
      }
      if (method === 'POST' && parts[4] === 'complete') {
        const item = items.find(i => i.id === parts[3]);
        if (!item) return fail(404, 'Reading item not found');
        const takeaway = data.takeaway ?? '';
        if (typeof takeaway !== 'string' || takeaway.length > 280) return fail(422, 'Takeaway is limited to 280 characters');
        if (!item.readers.some(r => r.user_id === user)) {
          const awarded = count() < 5;
          if (awarded) award(5);
          addFeed('reading_completed', `${person.display_name} finished reading ${item.title}`, {title:item.title, week_start:week});
          item.readers.push({user_id:user, takeaway:takeaway.trim(), awarded, activity_id:state.feed[0].id, reactions:[]});
        }
        return response();
      }
      return fail(404, 'Endpoint not found');
    }
    const activeDisaster=state.village.world?.disaster;
    if(activeDisaster?.kind==='outbreak'&&!activeDisaster.pets_away&&Date.now()>=Date.parse(activeDisaster.deadline)) {
      activeDisaster.pets_away=true;
      for(const p of state.village.villagers) {this.awayPets.set(`${state.village.id}:${p.user_id}`,p.equipped.filter(i=>i.slot==='pet'));p.equipped=p.equipped.filter(i=>i.slot!=='pet');p.equipped_ids=p.equipped.map(i=>i.item_id);}
    }
    const owner = state.village.owner_user_id === user;
    if (parts[2] === 'group-photo') {
      if (method === 'POST' && parts.length === 3) {
        if (!owner) return fail(403, 'Only the village owner can upload the group photo.');
        if (!(input instanceof FormData) || input.get('consent') !== 'true') return fail(422, 'Group consent is required.');
        const file = input.get('file');
        if (!(file instanceof Blob) || !file.size) return fail(422, 'Choose a nonempty photo.');
        this.upload(input);
        // Synthetic figures and fixed boxes, never pretend to segment the uploaded photo.
        const figures = ['#839f78', '#c492ac', '#8dadd0'].map((color, i) => `<g fill="${color}"><circle cx="${100+i*200}" cy="70" r="30"/><rect x="${60+i*200}" y="105" width="80" height="140" rx="30"/></g>`).join('');
        const key = `group/${id()}`;
        this.assets.set(key, new Blob([`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="280" viewBox="0 0 600 280"><rect width="600" height="280" fill="#eff2e3"/>${figures}</svg>`], { type: 'image/svg+xml' }));
        const job_id = id(), url = `/api/assets/${key}`;
        const crops = [0,1,2].map(i => {
          const cropKey = `${key}/person_${i}`;
          this.assets.set(cropKey, new Blob([`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="225" viewBox="${i*200+50} 30 100 225">${figures}</svg>`], { type: 'image/svg+xml' }));
          return { crop_id: `person_${i}`, url: `/api/assets/${cropKey}`, bbox: [i*200+50,30,i*200+150,255] as [number,number,number,number] };
        });
        this.groupPhotos.set(job_id, { vid: state.village.id, photo: { job_id, status: 'ready', photo_url: url, width: 600, height: 280, crops } });
        state.village.group_photo_job_id = job_id;
        return { job_id };
      }
      const group = this.groupPhotos.get(parts[3]);
      if (!group || group.vid !== state.village.id) return fail(404, 'Group photo not found in this village.');
      if (method === 'GET' && parts.length === 4) return group.photo;
      if (method === 'POST' && parts[4] === 'claim') {
        if (group.photo.status !== 'ready') return fail(409, 'The group photo is still processing.');
        const crop = group.photo.crops.find(c => c.crop_id === data.crop_id);
        if (!crop) return fail(404, 'Crop not found.');
        if (crop.claimed_by && crop.claimed_by !== user) return fail(409, 'That person has already been claimed.');
        if (group.photo.crops.some(c => c.claimed_by === user && c !== crop)) return fail(409, 'You have already claimed a person.');
        if (crop.avatar_job_id) return { job_id: crop.avatar_job_id };
        const job_id = id(); crop.claimed_by = user; crop.claimed_name = person.display_name; crop.avatar_job_id = job_id;
        this.jobs.set(job_id, { id: job_id, stage: 'segment', status: 'running', error: null }); this.simulatedJobs.set(job_id, Date.now());
        return { job_id };
      }
      return fail(404, 'Endpoint not found.');
    }
    if (method === 'GET' && parts[2] === 'agent-log') return this.logs;
    if (parts[2] === 'goals' && parts[4] === 'stretch' && method === 'POST') {
      const target = Object.values(state.profiles).find(p => p.goal?.id === parts[3]);
      if (!target?.goal) return fail(404, 'Goal not found.');
      const goal = target.goal;
      if (goal.user_id !== user) return fail(403, 'Only the goal owner can go beyond.');
      if (goal.week_start !== monday()) return fail(409, 'This week is closed.');
      this.audits.goalEdit(state.village.id, goal.id);
      const tiers = goal.stretches ??= [];
      if (parts.length === 5) {
        if (data.title != null && typeof data.title !== 'string') return fail(422, 'Invalid title.');
        const title = typeof data.title === 'string' && data.title.trim() ? nonempty(data.title, 'Stretch target', 140) : goal.title;
        const active = tiers.find(s => s.status === 'active');
        if (active) { if (active.title === title) return goal; return fail(409, 'Finish your current stretch first.'); }
        if (goal.status !== 'done' || tiers.length >= 3) return fail(409, 'Complete your goal first; maximum three stretch tiers per week.');
        tiers.push({goal_id: goal.id, tier: tiers.length + 1, title, status: 'active', completed_at: null});
        goal.status = 'stretch'; return goal;
      }
      if (parts[6] !== 'status' || data.status !== 'done') return fail(422, 'Choose done.');
      const tier = tiers.find(s => s.tier === Number(parts[5]));
      if (!tier) return fail(404, 'Stretch tier not found.');
      if (tier.status !== 'done') {
        tier.status = 'done'; tier.completed_at = new Date().toISOString(); goal.status = 'done';
        award(10); goal.stretch_bonus = tiers.filter(s => s.status === 'done').length;
        addFeed('stretch_completed', `${person.display_name} went above & beyond: ${tier.title} (+10 XP / coins)`, {goal_id: goal.id, tier: tier.tier, title: `Went above & beyond: ${tier.title}`, bonus_xp: 10, bonus_coins: 10});
      }
      return goal;
    }
    if (parts[2] === 'goals' && parts[4] === 'status'  && method === 'POST') {
      const target = Object.values(state.profiles).find(p => p.goal?.id === parts[3]);
      if (!target?.goal) return fail(404, 'Goal not found.');
      if (!owner && target.villager.user_id !== user) return fail(403, 'Only the goal owner or village owner can change this goal.');
      if (target.goal.stretches?.length) return fail(409, 'Update the current stretch tier instead.');
      this.audits.goalEdit(state.village.id, target.goal.id);
      if (data.status !== 'done' && data.status !== 'missed') return fail(422, 'Choose done or missed.');
      if (data.status === 'done' && target.goal.status !== 'done') {
        target.goal.completed_at = new Date().toISOString();
        state.feed.unshift({id: id(), created_at: target.goal.completed_at, user_id: target.villager.user_id, type: 'goal_completed', text: `${target.villager.display_name} completed a goal: ${target.goal.title}`, payload: {goal_id: target.goal.id, title: target.goal.title}});
      }
      if (data.status !== 'done') target.goal.completed_at = null;
      target.goal.status = data.status; return target.goal;
    }
    if (parts[2] === 'events' && parts[4] === 'complete' && method === 'POST') {
      if (!owner) return fail(403, 'Only the village owner can complete an event.');
      const event = state.village.active_events.find(e => e.id === parts[3]);
      if (!event) return fail(404, 'Event not found.');
      if (!Array.isArray(data.user_ids) || !data.user_ids.length || data.user_ids.some(uid => typeof uid !== 'string' || !state.profiles[uid])) return fail(422, 'Select village members.');
      for (const uid of new Set(data.user_ids as string[])) {
        const key = `${state.village.id}:${event.id}:${uid}`;
        if (this.eventAwards.has(key)) continue;
        this.eventAwards.add(key); const v = state.profiles[uid].villager; v.xp += event.reward_xp; v.coins += event.reward_xp; v.level = levelFor(v.xp);
      }
      event.status = 'completed'; addFeed('event_completed', `${event.title} completed.`); return { event };
    }
    if (parts[2] === 'check-ins' && parts[4] === 'review') {
      const check = Object.values(state.profiles).flatMap(p => p.check_ins).find(c => c.id === parts[3]);
      if (!check?.review) return fail(404, 'Review not found.');
      if (method === 'GET') return check.review;
      if (method === 'POST' && parts[5] === 'override') {
        if (!owner) return fail(403, 'Only the village owner can override a review.');
        check.review = { verdict: 'verified', confidence: 1, reason: nonempty(data.reason, 'Reason'), model: 'human-owner' };
        this.logs.unshift({ created_at: new Date().toISOString(), agent: 'auditor', action: 'Owner overrode evidence review', target_user_id: check.user_id, reason: check.review.reason, model: 'human-owner' });
        return check.review;
      }
    }
    if (method === 'GET' && parts[2] === 'feed') return state.feed.slice(0, Math.max(0, Math.min(200, Number(url.searchParams.get('limit') ?? 50)))).map(f => ({...f, reactions: this.reactions.summary(state.village.id, 'activity', f.id, user)}));
    if (method === 'GET' && parts[2] === 'users') {
      const p = state.profiles[parts[3]] ?? fail(404, 'Villager not found.');
      const decorate = (g: NonNullable<Profile['goal']>) => ({...g, reactions: this.reactions.summary(state.village.id, 'goal', g.id, user)});
      return {...p, goal: p.goal ? decorate(p.goal) : null, past_goals: p.past_goals.map(decorate)};
    }
    if (method === 'GET' && parts.length === 2) return { ...state.village, world: { ...(state.village.world ?? demoWorld(state.village.villagers.reduce((sum, v) => sum + v.xp, 0))), ...(this.debugWeather && state === base ? {weather: "festival_night" as const} : {}), ...(state.village.world?.disaster?.kind === "blackout" ? {weather:"rain",time_of_day:"night"} : {}) } };
    if (method === 'GET' && parts[2] === 'feed') return state.feed.slice(0, Math.max(0, Math.min(100, Number(url.searchParams.get('limit') ?? 50))));
    if (method === 'GET' && parts[2] === 'users') return state.profiles[parts[3]] ?? fail(404, 'Villager not found.');
    if (method === 'POST' && parts[2] === 'goals') {
      this.audits.goalEdit(state.village.id, profile.goal?.id);
      const title = nonempty(data.title, 'Goal', 140);
      const week_start = monday();
      const key = `${state.village.id}:${user}:${week_start}`;
      if (profile.goal && profile.goal.week_start !== week_start) profile.past_goals.unshift({ ...profile.goal, status: profile.goal.status === 'active' ? 'missed' : profile.goal.status });
      const previous = profile.goal?.week_start === week_start ? profile.goal : null;
      if (previous?.stretches?.length) return fail(409, 'Your base goal is complete.');
      profile.goal = { ...previous, id: profile.goal?.week_start === week_start ? profile.goal.id : id(), user_id: user, week_start, title, detail: typeof data.detail === 'string' ? data.detail.slice(0, 1000) : null, status: previous?.status ?? 'active' };
      if (!this.goalAwards.has(key)) { award(20); this.goalAwards.add(key); }
      addFeed('goal_set', `${person.display_name} set a weekly goal: ${title}`);
      return profile.goal;
    }
    if (method === 'POST' && parts[2] === 'check-ins') {
      const body = nonempty(data.body, 'Check-in');
      const key = `${state.village.id}:${user}:${nonempty(data.idempotency_key, 'Submission key', 200)}`;
      const existing = this.retries.get(key);
      if (existing) return { ...existing, xp_awarded: 0 };
      if (data.kind !== 'status' && data.kind !== 'progress') return fail(422, 'Choose status or progress.');
      if (data.kind === 'progress' && (!profile.goal || data.goal_id !== profile.goal.id || !['active', 'stretch'].includes(profile.goal.status))) return fail(422, 'Set a weekly goal before sharing progress.');
      if (data.stretch_tier != null && data.kind !== 'progress') return fail(422, 'Stretch tiers require goal progress.');
      if (data.kind === 'progress') {
        if (profile.goal!.week_start !== monday()) return fail(409, 'This week is closed.');
        const active = profile.goal!.stretches?.find(s => s.status === 'active');
        if ((active?.tier ?? null) !== (data.stretch_tier ?? null)) return fail(422, 'Choose the current stretch tier.');
        this.audits.goalEdit(state.village.id, profile.goal!.id);
      }
      const today = new Date().toISOString().slice(0, 10);
      const postedToday = profile.check_ins.some(c => c.created_at.startsWith(today));
      const statusToday = profile.check_ins.some(c => c.kind === 'status' && c.created_at.startsWith(today));
      const xp_awarded = data.kind === 'progress' ? 25 : statusToday ? 0 : 10;
      const evidence = typeof data.evidence_asset_id === 'string' ? data.evidence_asset_id : null;
      if (evidence && this.evidenceOwners.get(evidence) !== `${state.village.id}:${user}`) return fail(403, 'Evidence must belong to you and this village.');
      const review: Review | null = evidence ? { verdict: 'verified', confidence: 1, reason: 'Scripted demo review. No AI was called.', model: 'scripted-demo' } : null;
      const check_in = { stretch_tier: data.stretch_tier as number | undefined, id: id(), created_at: new Date().toISOString(), user_id: user, kind: data.kind as CheckInInput['kind'], body, goal_id: data.kind === 'progress' ? profile.goal!.id : null, evidence_url: evidence ? `/api/assets/${evidence}` : null, review };
      profile.check_ins.unshift(check_in);
      const disaster=state.village.world?.disaster;
      if(disaster) {
        const recent=Object.values(state.profiles).flatMap(p=>p.check_ins.filter(c=>Date.parse(c.created_at)>=Math.max(Date.parse(disaster.started_at),Date.now()-48*3600000)).map(c=>({...c,user_id:p.villager.user_id})));
        disaster.checkins=recent.length;disaster.people=new Set(recent.map(c=>c.user_id)).size;
        if(disaster.checkins>=disaster.target_checkins&&disaster.people>=disaster.target_people){this.restorePets(state.village);state.village.world!.disaster=null;state.village.world!.rebuilt_at=new Date().toISOString();}
      }
      if (!postedToday) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        person.streak_days = profile.check_ins.some(c => c.created_at.startsWith(yesterday)) ? person.streak_days + 1 : 1;
      }
      if (data.kind === 'status') person.status_line = body;
      award(xp_awarded);
      addFeed('checkin', `${person.display_name}: ${body}`, { kind: data.kind, body, check_in_id: check_in.id, has_evidence: !!evidence });
      const result = { check_in, xp_awarded }; this.retries.set(key, result); return result;
    }
    if (method === 'POST' && parts[2] === 'evidence') { const key = this.upload(input); this.evidenceOwners.set(key, `${state.village.id}:${user}`); return { evidence_asset_id: key }; }
    const inventoryKey = `${state.village.id}:${user}`;
    if (!this.inventory.has(inventoryKey)) this.inventory.set(inventoryKey, new Set([
      ...person.equipped_ids, ...(person.house_level >= 2 ? ['house_lv2'] : []),
    ]));
    const owned = this.inventory.get(inventoryKey)!;
    const projection = () => { person.equipped_ids = person.equipped.map(item => item.item_id); return { equipped: person.equipped, equipped_ids: person.equipped_ids }; };
    const requireItem = (item: Omit<ShopItem, 'owned'>) => {
      if (item.requires_item && !owned.has(item.requires_item)) fail(409, 'Unlock the required item first.');
      if (item.requires_building && !buildings(state.village.world ?? demoWorld(state.village.villagers.reduce((sum, p) => sum + p.xp, 0))).some(b => b.id === item.requires_building)) fail(409, 'Unlock the required village building first.');
    };
    if (parts[2] === 'villagergrams') {
      if (method === 'GET') return {members: state.village.villagers.map(p => ({id:p.user_id, display_name:p.display_name, portrait:p.avatar.portrait, allow_voice_by_friends: this.settings.get(p.user_id)?.allow_voice_by_friends === true, can_receive: this.settings.get(p.user_id)?.receive_villagergrams === true && Boolean(this.settings.get(p.user_id)?.phone_e164)}))};
      const speaker = state.profiles[String(data.speaker_id)]?.villager, recipient = state.profiles[String(data.recipient_id)]?.villager;
      if (!speaker || !recipient) return fail(403, 'Village members only.');
      if (!this.settings.get(speaker.user_id)?.allow_voice_by_friends || !this.settings.get(recipient.user_id)?.receive_villagergrams || !this.settings.get(recipient.user_id)?.phone_e164) return fail(403, 'Speaker and recipient must opt in in Settings.');
      const key = String(data.idempotency_key), day = new Date().toISOString().slice(0,10);
      if (this.grams.has(key)) return {id:key,status:'queued'};
      const today = [...this.grams.values()].filter(g => g.day === day);
      if (today.filter(g => g.sender === user).length >= 3 || today.filter(g => g.recipient === recipient.user_id).length >= 5) return fail(429, 'Daily Villager-gram limit reached.');
      const text = nonempty(data.text, 'Line', 140);
      if (/https?:|www\.|\d{7}|hate you|kill yourself/i.test(text)) return fail(422, 'Choose a kind fictional line without links or phone numbers.');
      if (!owned.has('villagergram')) return fail(409, 'Buy a Villager-gram first.');
      owned.delete('villagergram'); this.grams.set(key,{sender:user,recipient:recipient.user_id,day});
      addFeed('villagergram', `${person.display_name} made ${speaker.display_name}'s villager say: ${text}`, {text});
      return {id:key,status:'queued'};
    }
    if (parts[2] === 'items') {
      const tokens = () => this.photoTokens.get(inventoryKey) ?? 0;
      if (method === 'POST' && parts[3] === 'token') {
        const price = catalog.find(i => i.id === 'photo_token')!.price_coins;
        if (person.coins < price) return fail(409, 'Not enough coins');
        person.coins -= price; this.photoTokens.set(inventoryKey,tokens()+1); return {id:id()};
      }
      if (method === 'POST' && parts[3] === 'from-photo') {
        if (!(input instanceof FormData) || input.get('consent') !== 'true') return fail(422,'Photo consent is required.');
        const file = input.get('file'); if (!(file instanceof File)) return fail(422,'Choose a photo.');
        if (!tokens()) return fail(409,'A photo token is required.');
        const jid = id(), iid = id(), slot = input.get('kind') === 'object' ? 'decoration' : input.get('slot') === 'head' ? 'head' : 'torso';
        const preview = `photo-items/${iid}.png`; this.assets.set(preview,file);
        this.photoTokens.set(inventoryKey,tokens()-1);
        this.photoJobs.set(jid,{id:jid,owner:user,vid:state.village.id,started:Date.now(),fail:file.name === 'failure.png',refunded:false,status:'queued',item:{id:iid,item_id:iid,slot,asset_key:null,custom:true,tint:{primary:'#527dba',secondary:'#ffffff'},preview:`/api/assets/${preview}`,created_at:new Date().toISOString()}});
        return {id:jid,status:'queued',item:null};
      }
      if (method === 'GET' && parts[3] === 'jobs') {
        const job = this.photoJobs.get(parts[4]); if (!job || job.owner !== user || job.vid !== state.village.id) return fail(404,'Photo job not found.');
        const age = Date.now()-job.started;
        job.status = age < 1500 ? 'queued' : age < 4500 ? 'running' : job.fail ? 'failed' : 'done';
        if (job.status === 'failed' && !job.refunded) { this.photoTokens.set(inventoryKey,tokens()+1); job.refunded = true; }
        return {id:job.id,status:job.status,stage:age < 2500 ? 'segment' : age < 3500 ? 'stylize' : '3D',refunded:job.refunded,error:job.fail ? 'No object found in the photo.' : null,item:job.status === 'done' ? job.item : null};
      }
      return {items:[...this.photoJobs.values()].filter(j => j.owner === user && j.vid === state.village.id && j.status === 'done').map(j => j.item),photo_item_tokens:tokens()};
    }
    if (method === 'PATCH' && parts[2] === 'inventory' && parts[4] === 'colors') {
      const item = catalog.find(i => i.id === parts[3]);
      if (!item || !owned.has(item.id) || item.kind !== 'clothing') return fail(404, 'Owned clothing item not found.');
      const colors = data.colors as ItemColors;
      if (Object.keys(data).length !== 1 || !colors || typeof colors !== 'object' || !/^#[0-9a-fA-F]{6}$/.test(colors.primary ?? '') || Object.entries(colors).some(([k,v]) => !['primary','secondary','accent'].includes(k) || (v !== null && (typeof v !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(v))))) return fail(422, 'Use six-digit hex colors.');
      const normalized = Object.fromEntries(Object.entries(colors).filter(([,v]) => v !== null).map(([k,v]) => [k,v.toLowerCase()])) as ItemColors;
      this.itemColors.set(`${inventoryKey}:${item.id}`, normalized);
      person.equipped = person.equipped.map(i => i.item_id === item.id ? {...i, colors: normalized} : i);
      return {item_id:item.id, colors:normalized};
    }
    if (method === 'GET' && parts[2] === 'shop') return { items: catalog.map(item => ({ ...item, colors: this.itemColors.get(`${inventoryKey}:${item.id}`), away: this.awayPets.get(inventoryKey)?.some(p=>p.item_id===item.id) ?? false, owned: owned.has(item.id) })), balance: person.coins };
    if (method === 'POST' && parts[2] === 'inventory' && ['equip', 'unequip'].includes(parts[3])) {
      const custom = [...this.photoJobs.values()].find(j => j.item.id === data.item_id && j.owner === user && j.vid === state.village.id && j.status === 'done');
      if (custom) { person.equipped = parts[3] === 'equip' ? replaceSlot(person.equipped,custom.item) : person.equipped.filter(i => i.item_id !== custom.item.id); return projection(); }
      const item = catalog.find(i => i.id === data.item_id);
      if (!item || !owned.has(item.id)) return fail(404, 'Item not owned.');
      if (Object.keys(data).length !== 1) return fail(422, 'Only item_id is accepted.');
      if (item.id === 'house_paddock' && parts[3] === 'unequip') return fail(409, 'The paddock is a permanent house add-on');
      if (parts[3] === 'equip') { requireItem(item); person.equipped = replaceSlot(person.equipped, {...equipmentFor(item.id), colors:this.itemColors.get(`${inventoryKey}:${item.id}`)}); }
      else person.equipped = person.equipped.filter(current => current.item_id !== item.id);
      return projection();
    }
    if (method === 'POST' && parts[2] === 'shop' && parts[3] === 'buy') {
      const item = catalog.find(i => i.id === data.item_id);
      if (!item) return fail(404, 'Item not found.');
      if(item.id==='revival_potion') {
        if(this.awayPets.get(inventoryKey)?.length) {if(person.coins<30)fail(409,'Insufficient coins');person.coins-=30;this.restorePets(state.village,user);}
        return {balance:person.coins,inventory:[...owned].map(item_id=>({item_id}))};
      }
      if(item.slot==='pet'&&state.village.world?.disaster?.closed_building==='pet_shelter') fail(409,'Pet shelter: Closed for repairs');
      if (item.source && item.source !== 'shop') return fail(409, 'Complete the unlock requirement.');
      if (!owned.has(item.id)) {
        requireItem(item);
        if (item.kind === 'farm_animal' && catalog.filter(i => i.kind === 'farm_animal' && owned.has(i.id)).length >= 6) return fail(409, 'Your paddock is full (6 animals)');
        if (person.coins < item.price_coins) return fail(409, 'You need a few more coins for this.');
        person.coins -= item.price_coins; owned.add(item.id);
        if (item.kind !== 'consumable') person.equipped = replaceSlot(person.equipped, {...equipmentFor(item.id), colors:this.itemColors.get(`${inventoryKey}:${item.id}`)}); projection();
        if (item.id === 'house_lv2') person.house_level = Math.max(2, person.house_level);
        if (item.id === 'house_lv3') person.house_level = 3;
        addFeed('purchase', `${person.display_name} unlocked ${item.name}.`, { item_id: item.id });
      }
      return { balance: person.coins, inventory: [...owned].map(item_id => ({ item_id, equipped: person.equipped_ids.includes(item_id) })) };
    }
    if (method === 'POST' && parts[2] === 'mayor') {
      if (parts[3] === 'nudge') {
        const target = state.profiles[String(data.target_user_id)];
        if (!target) return fail(404, 'Villager not found.');
        return { text: `${target.villager.display_name}, how is your goal going? Send an update when you can.`, audio_url: null };
      }
      if (parts[3] !== 'pray' && parts[3] !== 'recap') return fail(404, 'Endpoint not found.');
      const prayer = parts[3] === 'pray' ? nonempty(data.text, 'Your wish') : null;
      const event: MayorEvent = { created_at: new Date().toISOString(), model: 'scripted-demo', id: id(), kind: prayer ? 'prayer_response' : 'recap', title: prayer ? 'Request received' : 'This week in the village', body: prayer ? `Noted, ${person.display_name}: “${prayer}” Post an update when you have one; a friend can join in.` : `${state.village.villagers.length} neighbors, ${Object.values(state.profiles).reduce((n, p) => n + p.check_ins.filter(c => c.created_at.slice(0, 10) >= monday()).length, 0)} check-ins this week. ${state.village.villagers.map(v => v.display_name).join(', ')}: you made the town bulletin.`, reward_xp: 0, penalty: null, status: 'completed', ends_at: null };
      addFeed('mayor_event', event.body); return event;
    }
    return fail(404, 'Endpoint not found.');
  }

  private upload(input: unknown): string {
    const file = input instanceof FormData ? input.get('file') : null;
    if (!(file instanceof Blob) || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) return fail(422, 'Choose a JPG, PNG, or WebP image under 5 MB.');
    const key = `evidence/${id()}`; this.assets.set(key, file); return key;
  }
}
