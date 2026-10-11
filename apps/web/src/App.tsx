import { ActivityUpdate } from './components/ActivityUpdate';
import { VoiceBarks } from './sound/VoiceBarks';
import { SoundButton, NeighborsStrip } from './components/VillageChrome';
import { useCallback, useEffect, memo, useMemo, useRef, useState } from 'react';
import { Friends } from './components/Friends';
import { NavigationGuide, type Place } from './components/NavigationGuide';
import { socialNudges } from './components/friendsData';
import { VillageIcon } from './components/VillageIcon';
import { VillageAlerts } from './components/VillageAlerts';
import { useToast, ToastNotice } from './components/Toast';
import type { SceneReward } from './components/CinematicScene';
const CinematicScene = lazyPanel(() => import('./components/CinematicScene').then(m => ({default:m.CinematicScene})));
const HouseInterior = lazyPanel(() => import('./components/HouseInterior').then(m => ({default:m.HouseInterior})));
import { pollWithBackoff } from './api/retry';
import { ReadingList } from './components/ReadingList';
import { ActivityNavigation, ActivityEvidence, ActivityTitles } from './components/ActivityFeed';
import { standings } from './components/colosseumData';
import { activityTarget, type ActivityTarget } from './components/activityData';
import { readingMonday, type ReadingShelf } from './api/reading';
import { Dialog } from './components/shared';
import { Dashboard } from './components/Dashboard';
import { useCleanView } from './components/useCleanView';
import { Accomplishments } from './components/Accomplishments';
import { DemoTools } from './components/DemoTools';
import { savedSeat, saveSeat } from './api/seat';
import { FaceCheck } from './components/FaceCheck';
import { PresenceProvider } from './components/Presence';
import { Messages, useUnread } from './components/Messages';
import { SoundLifecycle } from './sound/SoundControls';
import { sound } from './sound/engine';
import { Gazette } from './components/Gazette';
import { VillagePanel } from './components/VillagePanel';
import { GroupPhotoPanel } from './components/GroupPhotoPanel';
import { DisasterContext } from './components/DisasterBanner';
import { newBuildings } from './api/world';
import { SettingsPanel } from './components/SettingsPanel';
import { Tour } from './components/Tour';
import { defaultVillage, rememberVillage } from './api/villagePreference';
import { WeekPanel } from './components/WeekPanel';
import { lazyPanel, prefetchWhenIdle } from './components/lazyPanel';
const CompetitionsPanel = lazyPanel(() => import('./components/CompetitionsPanel').then(m => ({default:m.CompetitionsPanel})));
import { Celebration } from './components/Celebration';
import type { WeekState } from './api/types';
import { Maximize, Settings, CalendarDays, Trophy, Crown, Flag, Leaf, Plus, ShoppingBag, Sparkles, Sprout, Users, X } from 'lucide-react';
import { api } from './api/client';
import { levelFor, type CheckInInput, type Me, type FeedItem, type Profile, type Village } from './api/types';
import { VillageScene } from './scene/VillageScene';
const ProfilePanel = lazyPanel(() => import('./components/ProfilePanel').then(m => ({default:m.ProfilePanel})));
const GoalModal = lazyPanel(() => import('./components/Modals').then(m => ({default:m.GoalModal})));
const ShopModal = lazyPanel(() => import('./components/Modals').then(m => ({default:m.ShopModal})));
import { blip, errorText, Portrait } from './components/shared';

import { AgentPanel, isOwner } from './components/AgentPanel';
import { VillagePicker } from './components/VillagePicker';
import { ClaimVillager } from './components/ClaimVillager';
import { Onboarding } from './components/Onboarding';

const WarmShop = memo(ShopModal);
const WarmCompetitions = memo(CompetitionsPanel);

type Modal = 'update' | 'reading' | 'friends' | 'help' | 'accomplishments' | 'face' | 'messages' | 'gazette' | 'village' | 'group-photo' | 'checkin' | 'goal' | 'shop' | 'mayor' | 'agents' | 'week' | 'compete' | 'settings' | null;
function prefetchModal(modal: Modal) {
  const panel = modal === 'compete' ? CompetitionsPanel : modal === 'checkin' || modal === 'mayor' ? CinematicScene : modal === 'shop' ? ShopModal : modal === 'goal' ? GoalModal : null;
  void panel?.preload().catch(() => {});
}
export default function App({ onSignOut, onSignIn }: { onSignOut?: () => void; onSignIn?: () => void }) {
  const [sceneReward, setSceneReward] = useState<SceneReward | null>(null);
  const sceneTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(sceneTimer.current), []);
  const [interiorVisible, setInteriorVisible] = useState(false);
  useEffect(() => { const changed = (e: Event) => setInteriorVisible((e as CustomEvent).detail); window.addEventListener("village-interior-visible", changed); return () => window.removeEventListener("village-interior-visible", changed); }, []);
  const [homeOpen, setHomeOpen] = useState(false);
  const [hallOpen, setHallOpen] = useState(false);
  useEffect(() => { const open = () => setHallOpen(true); window.addEventListener("village-open-hall", open); return () => window.removeEventListener("village-open-hall", open); }, []);
  useEffect(() => { const enter = () => setHomeOpen(true); window.addEventListener('village-enter-home', enter); return () => window.removeEventListener('village-enter-home', enter); }, []);
  const [activityLink, setActivityLink] = useState<{item: FeedItem; target: ActivityTarget} | null>(null);
  const [shopItem, setShopItem] = useState<string | null>(null);
  const [faceInvite, setFaceInvite] = useState(true);
  const recognized = useRef(new Set<string>());
  const [deleted, setDeleted] = useState(false);
  const [messagePeer, setMessagePeer] = useState<string | null>(null);
  const [mailRevision, setMailRevision] = useState(0);
  const mailChanged = useCallback(() => setMailRevision(n => n + 1), []);
  const [gazetteIssue, setGazetteIssue] = useState<string | null>(null);
  const [readIssue, setReadIssue] = useState<string | null>(null);
  const [unlocks, setUnlocks] = useState<string[]>([]);
  const clearUnlocks = useCallback(() => setUnlocks([]), []);
  const [tour, setTour] = useState<number | null>(() => new URLSearchParams(location.search).get('tour') === '1' ? 0 : null);
  const [tourReady, setTourReady] = useState(false);
  const [week, setWeek] = useState<WeekState | null>(null);
  const [celebration, setCelebration] = useState<{ids: string[]; title: string} | null>(null);
  const finishCelebration = useCallback(() => setCelebration(null), []);
  const celebrate = useCallback((ids: string[], title: string) => { setModal(null); setSelected(null); setCelebration({ids, title}); }, []);
  const [memberships, setMemberships] = useState<Me['villages']>([]);
  const [profileAttempt, setProfileAttempt] = useState(0);
  const [skipClaim, setSkipClaim] = useState(false);
  const [onboarding, setOnboarding] = useState<Me | null>(null);
  const [village, setVillage] = useState<Village | null>(null);
  const [arenaMounted, setArenaMounted] = useState(false);
  useEffect(() => {
    if (!village) return;
    return prefetchWhenIdle(() => Promise.all([
      ProfilePanel.preload(), ShopModal.preload(), HouseInterior.preload(),
      CinematicScene.preload(), CompetitionsPanel.preload(),
      import('./components/HeadStudio'), import('./scene/ShopInterior'),
    ]));
  }, [village?.id]);
  const [goalBursts, setGoalBursts] = useState<Record<string, string>>({});
  const seenCompletions = useRef<{key: string; ids: Set<string>}>({key: "", ids: new Set()});
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [activityTitles, setActivityTitles] = useState<Record<string,string>>({});
  const feedCompetitions = [...new Set(feed.flatMap(item => {const id = (item.payload as {competition_id?: string}).competition_id; return item.type.startsWith('competition_') && id ? [id] : [];}))].sort().join(',');
  useEffect(() => {
    let active = true; setActivityTitles({});
    if (village && feedCompetitions) void api.competitions(village.id).then(rows => {if (active) setActivityTitles(Object.fromEntries(rows.map(row => [row.id,row.title])));}).catch(() => {});
    return () => {active = false;};
  }, [village?.id, feedCompetitions]);
  const [me, setMe] = useState<Profile | null>(null);
  const [user, setUser] = useState(api.user);
  useEffect(() => setActivityLink(null), [village?.id,user]);
  useEffect(() => {
    const key = `${village?.id}:${user}`;
    const completions = feed.filter(item => item.type === 'goal_completed');
    const prior = seenCompletions.current;
    seenCompletions.current = {key, ids: new Set(completions.map(item => item.id))};
    if (prior.key !== key) { setGoalBursts({}); return; }
    const fresh = completions.filter(item => item.user_id && !prior.ids.has(item.id));
    if (fresh.length) setGoalBursts(Object.fromEntries(fresh.map(item => [item.user_id!, item.id])));
  }, [feed, village?.id, user]);
  useEffect(() => { if (!Object.keys(goalBursts).length) return; const timer = setTimeout(() => setGoalBursts({}), 3200); return () => clearTimeout(timer); }, [goalBursts]);

  const [challenge, setChallenge] = useState<{name: string; request: number} | null>(null);
  const [accomplishmentTarget, setAccomplishmentTarget] = useState(0);
  const [houseTarget, setHouseTarget] = useState(0);
  const [selected, setSelectedId] = useState<string | null>(null);
  const setSelected = useCallback((id: string | null, section?: 'house' | 'accomplishments') => { setSelectedId(id); setAccomplishmentTarget(section === 'accomplishments' ? Date.now() : 0); setHouseTarget(section === 'house' ? Date.now() : 0); }, []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false), [profileError, setProfileError] = useState('');
  const unread = useUnread(deleted ? undefined : village?.id, user, mailRevision);
  const [shopSection,setShopSection] = useState<'general'|'farm'>('general');
  const [modal, setModalState] = useState<Modal>(null);
  const setModal = useCallback((next: Modal) => {
    if (next !== 'compete') setChallenge(null);
    if (next === 'compete') performance.mark('arena-request');
    if (next === null) performance.mark('scene-exit-request');
    setModalState(next);
    if (next === 'checkin' || next === 'mayor') { performance.mark('scene-request'); setSelected(null); }
    else { clearTimeout(sceneTimer.current); setSceneReward(null); }
  }, []);
  useEffect(() => {
    if (!village || arenaMounted || modal || selected || homeOpen || hallOpen) return;
    // Allocate the second renderer only while the town is idle; foreground
    // entrances take priority over speculative arena work.
    let idle = 0;
    const timer = setTimeout(() => { idle = requestIdleCallback(() => setArenaMounted(true), {timeout: 2000}); }, 1200);
    return () => {clearTimeout(timer); cancelIdleCallback(idle);};
  }, [village?.id, arenaMounted, modal, selected, homeOpen, hallOpen]);
  const closeModal = useCallback(() => {setActivityLink(null); setModal(null);}, [setModal]);
  const openSettings = useCallback(() => setModal('settings'), [setModal]);
  useEffect(() => { if (modal !== 'shop') setShopItem(null); }, [modal]);
  const [error, setError] = useState(''), [loading, setLoading] = useState(true), [switching, setSwitching] = useState(false);
  const { toast } = useToast();
  const openActivity = useCallback((item: FeedItem) => {
    const target = activityTarget(item);
    setActivityLink({item, target}); setSelected(null); setModal(null);
    if (target.kind === 'profile' || target.kind === 'activity' || target.kind === 'goal') setSelected(target.userId);
    else if (target.kind === 'house') setSelected(target.userId, 'house');
    else if (target.kind === 'shop') {setShopItem(target.id); setModal('shop');}
    else if (target.kind === 'competition') setModal('compete');
    else if (target.kind === 'hall') setHallOpen(true);
    else if (target.kind === 'reading') setModal('reading');
    else if (target.kind === 'gazette') setModal('gazette');
    else if (target.kind === 'mayor' || target.kind === 'alerts') setModal('update');
  }, [setModal, setSelected]);
  // Older goals remain addressable from their events, including completed weeks.
  const linkedGoalId = activityLink?.target.kind === 'goal' ? activityLink.target.id : undefined;
  const linkedProfile = profile && activityLink?.target.kind === 'goal' && activityLink.target.userId === selected
    ? {...profile, goal: [profile.goal, ...profile.past_goals].find(goal => goal?.id === linkedGoalId) ?? profile.goal}
    : profile;

  const seenSocial = useRef<{key: string; ids: Set<string>}>({key:'',ids:new Set()});
  useEffect(() => {
    if (!village || loading || switching) return;
    const key = `${village.id}:${user}`, prior = seenSocial.current;
    if (prior.key !== key) {seenSocial.current = {key,ids:new Set(feed.map(i => i.id))}; return;}
    const fresh = socialNudges(feed, prior.ids, user);
    feed.forEach(i => prior.ids.add(i.id));
    fresh.slice(0,3).forEach(item => {
      const name = village.villagers.find(p => p.user_id === item.user_id)?.display_name ?? 'A friend';
      const vid = village.id, sender = user, recipient = item.user_id!;
      let sent = false;
      toast({id:`social:${key}:${item.id}`, kind:'info',title:`${name} ${item.type === 'goal_completed' ? 'finished a goal' : 'checked in'}`,duration:10000,action:{label:'Cheer',onClick:async () => {
        if (sent || api.user !== sender || villageRef.current?.id !== vid) return;
        sent = true;
        try {await api.sendMessage(vid,recipient,'Cheering you on!','cheer'); toast('Cheer sent!');} catch(e) {sent=false; toast({kind:'error',title:errorText(e)});}
      }}});
    });
  }, [feed, village?.id, user, loading, switching]);
  const guideSeen = useRef(new Set<string>());
  useEffect(() => {
    if (!village || loading || switching || tour !== null) return;
    const key = `village:guide:v1:${user}`;
    if (guideSeen.current.has(key)) return;
    guideSeen.current.add(key);
    try {if (localStorage.getItem(key)) return; localStorage.setItem(key,'seen');} catch { /* Session fallback. */ }
    setSelected(null); setModal('help');
  }, [village?.id, user, loading, switching]);
  function goTo(place: Place) {
    setTour(null); setSelected(null);
    if (place === 'house') {setModal(null); setSelected(user,'house');}
    else if (place === 'library') setModal('settings');
    else setModal(place);
  }
  const [zoomed, setZoomed] = useState(false);
  const { clean, enterClean, exitClean } = useCleanView(!modal && !loading && !!village, () => { setSelected(null); setTour(null); });
  const generation = useRef(0), profileGeneration = useRef(0), refreshGeneration = useRef(0);
  const selectedRef = useRef(selected); selectedRef.current = selected;
  const villageRef = useRef(village); villageRef.current = village;

  const refresh = useCallback(async () => {
    const vid = villageRef.current?.id; if (!vid) return;
    const version = generation.current, request = ++refreshGeneration.current, uid = api.user, chosen = selectedRef.current;
    const selfRequest = api.profile(vid, uid);
    const [next, activity, self, other] = await Promise.all([api.village(vid), api.feed(vid), selfRequest, chosen === uid ? selfRequest : chosen ? api.profile(vid, chosen) : Promise.resolve(null)]);
    if (version !== generation.current || request !== refreshGeneration.current) return;
    const added = newBuildings(villageRef.current, next);
    if (next.active_events.some(e => e.penalty === 'crater' && e.status === 'failed' && !villageRef.current?.active_events.some(old => old.id === e.id && old.status === 'failed'))) sound.play('crater_boom_cartoon');
    for (const event of next.active_events.filter(e => e.id !== next.world?.disaster?.repair_event_id && !villageRef.current?.active_events.some(old => old.id === e.id))) { sound.play('event_drumroll'); toast({kind:'event',title:event.title,detail:event.body}); }
    const disaster = next.world?.disaster;
    if (disaster && disaster.started_at !== villageRef.current?.world?.disaster?.started_at) {
      toast({kind:'disaster',title:disaster.title,detail:disaster.body,icon:{scorch:'🌋',outbreak:'🐾',blackout:'🌩️',blight:'🐛'}[disaster.kind],action:{label:'View',onClick:()=>setModal('mayor')}});
    }
    if (next.world?.rebuilt_at && next.world.rebuilt_at !== villageRef.current?.world?.rebuilt_at) { setCelebration({ids: [], title: "Rebuilt. Everyone is home."}); sound.play("prayer_chime"); }
    villageRef.current = next;
    if (added.length) setUnlocks(added.map(b => b.name));
    setVillage(next); setFeed(activity); setMe(self);
    if (chosen === selectedRef.current) setProfile(other);
  }, []);
  useEffect(() => {
    if (!village?.id || deleted) return;
    return pollWithBackoff(async () => { if (document.visibilityState === 'visible') await refresh(); }, 15000, false);
  }, [village?.id, deleted, refresh]);
  const boot = useCallback(async () => {
    setLoading(true); setError('');
    try {
      await api.initialize();
      if (!api.tokenProvider) api.user = savedSeat(api.mode) || api.user;
      const identity = await api.me();
      setFaceInvite(!identity.user.face_verified_at);
      api.user = identity.user.id; setMemberships(identity.villages);
      const vid = defaultVillage(identity);
      if (!vid) { setOnboarding(identity); return; }
      setOnboarding(null);
      const [world, activity, self] = await Promise.all([api.village(vid), api.feed(vid), api.profile(vid, api.user)]);
      setVillage(world); setFeed(activity); setMe(self); rememberVillage(api.user, vid); setUser(api.user);
    } catch (e) { setError(errorText(e)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void boot(); }, [boot]);
  useEffect(() => {
    if (!selected || !village) { profileGeneration.current++; setProfile(null); return; }
    const current = ++profileGeneration.current;
    setProfile(null); setProfileLoading(true); setProfileError('');
    void api.profile(village.id, selected).then(result => { if (current === profileGeneration.current) setProfile(result); }).catch(e => { if (current === profileGeneration.current) setProfileError(errorText(e)); }).finally(() => { if (current === profileGeneration.current) setProfileLoading(false); });
  }, [selected, village?.id, profileAttempt, user]);
  useEffect(() => {
    if (!village || deleted) return;
    let active = true;
    setWeek(null);
    const stop = pollWithBackoff(async () => {
      const [next, activity] = await Promise.all([api.week(village.id), api.feed(village.id)]);
      if (active) { setWeek(next); setFeed(activity); }
    }, 15000);
    return () => { active = false; stop(); };
  }, [village?.id, user, deleted]);
  const featuredVillager = village?.villagers.find(v => v.avatar.portrait.kind === 'lam_head') ?? village?.villagers[0];
  useEffect(() => {
    setTourReady(false);
    if (tour === null || !village) return;
    setModal(null); setSelected(null);
    const timer = setTimeout(() => setTourReady(true), 100);
    return () => clearTimeout(timer);
  }, [tour, village?.id, featuredVillager?.user_id]);
  useEffect(() => {
    setGazetteIssue(null);
    try { setReadIssue(localStorage.getItem(`village:gazette:${village?.id}:${user}`)); } catch { setReadIssue(null); }
  }, [village?.id, user]);
  useEffect(() => {
    if (modal !== 'gazette' || !gazetteIssue) return;
    setReadIssue(gazetteIssue);
    try { localStorage.setItem(`village:gazette:${village?.id}:${user}`, gazetteIssue); } catch { /* Session state still works without storage. */ }
  }, [modal, gazetteIssue, village?.id, user]);
  async function switchVillage(vid: string) {
    if (switching || vid === village?.id) return;
    ++generation.current; ++profileGeneration.current; setSwitching(true); setError('');
    setSelected(null); setProfile(null); setModal(null); setCelebration(null); setUnlocks([]);
    try {
      const [world, activity, self] = await Promise.all([api.village(vid), api.feed(vid), api.profile(vid, api.user)]);
      setVillage(world); setFeed(activity); setMe(self); rememberVillage(api.user, vid);
    } catch (e) { toast({kind: 'error', title: errorText(e)}); throw e; }
    finally { setSwitching(false); }
  }
  async function switchUser(uid: string) {
    if (!village || uid === api.user || switching) return;
    const previous = api.user; ++generation.current;
    api.user = uid; setSwitching(true); setError('');
    try { const identity = await api.me(); if (!identity.villages.length) { setUser(uid); saveSeat(api.mode, uid); setOnboarding(identity); setVillage(null); setMe(null); setModal(null); setSelected(null); return; } const [self, world] = await Promise.all([api.profile(village.id, uid), api.village(village.id)]); setOnboarding(null); setMe(self); setVillage(world); setUser(uid); saveSeat(api.mode, uid); setSelected(null); setProfile(null); setFaceInvite(!identity.user.face_verified_at); setMemberships(identity.villages); } catch (e) { api.user = previous; toast({kind: 'error', title: errorText(e)}); throw e; } finally { setSwitching(false); }
  }
  const sceneVillage = useMemo(() => village && ({...village, villagers: village.villagers.map(v => ({...v, auditor: week?.village_id === village.id && week.auditor_id === v.user_id, celebrated: celebration?.ids.includes(v.user_id), goalBurst: goalBursts[v.user_id]}))}), [village, week, celebration, goalBursts]);
  const sceneSelect = useCallback((id: string, section?: 'house') => { exitClean(); setSelected(id, section); }, [exitClean, setSelected]);
  const sceneLocation = useCallback(() => { exitClean(); setSelected(null); setModal(null); }, [exitClean, setSelected, setModal]);
  const sceneShop = useCallback((section?: 'farm') => { exitClean(); setShopSection(section ?? 'general'); setModal('shop'); }, [exitClean, setModal]);
  const sceneMayor = useCallback(() => { exitClean(); setModal('mayor'); }, [exitClean, setModal]);
  const sceneNews = useCallback(() => { exitClean(); setModal('gazette'); }, [exitClean, setModal]);
  async function submitCheckIn(input: CheckInInput) {
    if (!village || !me) return;
    const snapshot = me;
    const today = new Date().toISOString().slice(0, 10);
    const expected = input.kind === 'progress' ? 25 : me.check_ins.some(c => c.kind === 'status' && c.created_at.startsWith(today)) ? 0 : 10;
    setMe({ ...me, villager: { ...me.villager, coins: me.villager.coins + expected, xp: me.villager.xp + expected, level: levelFor(me.villager.xp + expected) } });
    let result;
    try { result = await api.checkIn(village.id, input); } catch (e) { setMe(snapshot); throw e; }
    // Once accepted, a failed refresh must not make the user resubmit an already-saved note.
    setMe({ ...snapshot, villager: { ...snapshot.villager, coins: snapshot.villager.coins + result.xp_awarded, xp: snapshot.villager.xp + result.xp_awarded, level: levelFor(snapshot.villager.xp + result.xp_awarded) }, check_ins: [result.check_in, ...snapshot.check_ins.filter(c => c.id !== result.check_in.id)] });
    void refresh().catch(() => toast({kind:'error',title:'Check-in saved; village could not refresh',action:{label:'Retry',onClick:refresh}}));
    sound.play('checkin_pop');
    if (result.check_in.review) sound.play(result.check_in.review.verdict === 'verified' ? 'evidence_stamp_ok' : 'evidence_buzzer_sus');
    if (levelFor(snapshot.villager.xp + result.xp_awarded) > snapshot.villager.level) { sound.play('level_up_fanfare'); setCelebration({ ids: [user], title: `Level ${levelFor(snapshot.villager.xp + result.xp_awarded)}` }); }
    if (result.xp_awarded) { blip(); toast({kind:'reward', amount:result.xp_awarded, currency:'coins', title:`+${result.xp_awarded} XP`, detail:'Check-in saved.'}); }
    else toast('Check-in saved.');
    setSceneReward({xp: result.xp_awarded, start: performance.now()/1000});
    sceneTimer.current = setTimeout(() => setModal(null), matchMedia('(prefers-reduced-motion: reduce)').matches ? 900 : 1500);
  }

  if (deleted) return <main className="boot-screen"><Sprout size={40} /><h1>Your account has been deleted.</h1><p>You are signed out of Village.</p>{onSignOut && <button className="button secondary" onClick={onSignOut}>Return to sign in</button>}</main>;
  if (loading) return <main className="boot-screen"><span className="brand-mark"><Sprout size={30} /></span><h1>Your village.</h1><p>Loading the village…</p><div className="loading-dots">• • •</div></main>;
  if (onboarding && onSignOut && !skipClaim) return <ClaimVillager onClaimed={boot} onSkip={() => setSkipClaim(true)} onSignOut={onSignOut} />;
  if (onboarding) return <Onboarding identity={onboarding} onJoined={boot} />;
  if (!village || !me) return <main className="boot-screen"><Leaf size={40} /><h1>The village could not load.</h1><p role="alert">{error}</p><button className="button primary" onClick={() => void boot()}>Try again</button><p className="help-text">For the offline demo, start with VITE_MOCK=1.<br />A connected API needs a valid VITE_DEMO_USER.</p></main>;
  const common = { vid: village.id, onClose: closeModal, refresh, toast };
  return <ActivityTitles.Provider value={activityTitles}><ActivityNavigation.Provider value={openActivity}><ActivityEvidence.Provider value={profile?.check_ins ?? []}><DisasterContext.Provider value={village.world?.disaster ?? null}><PresenceProvider vid={village.id} user={user} activity={modal === 'shop' ? 'shopping' : modal === 'week' ? 'in Week panel' : selected ? 'viewing profile' : modal ? `in ${modal}` : 'exploring village'}><VoiceBarks key={village.id+user} vid={village.id} user={user} feed={feed}/><SoundLifecycle arena={modal === 'compete'} weather={village.world?.weather} time={village.world?.time_of_day} /><div className={`app ${selected ? 'has-profile' : ''} ${clean ? 'clean-view' : ''} ${modal === 'checkin' || modal === 'mayor' ? 'in-cinematic' : ''}`}>
    <header className="topbar"><a className="brand" href="/" aria-label="Village home"><span className="brand-mark"><Sprout size={24} /></span>village<span className="brand-dot">.</span></a><div className="village-identity"><span className="identity-divider" /><VillagePicker memberships={memberships} current={village.id} busy={switching || !!modal} onSelect={id => switchVillage(id).catch(() => {})} onJoined={async id => { const identity = await api.me(); setMemberships(identity.villages); await switchVillage(id); }} /></div><div className="topbar-right">{!onSignOut && (village.id === '13370000-0000-4000-8000-000000000000' || api.mode === 'mock') && <DemoTools onSignIn={onSignIn} village={village} user={user} switchUser={switchUser} refresh={refresh} />}<button className="button secondary ai-entry" onClick={() => setModal('agents')}><Sparkles size={14} /> AI at work</button><button className="button secondary help-entry" aria-label="What can I do here?" onClick={() => {setSelected(null); setModal('help');}}>Help</button><button className="button secondary inbox-entry" aria-pressed={modal === 'messages'} title={unread ? `${unread} unread messages` : 'Your village inbox'} onClick={() => {setMessagePeer(null); setModal('messages');}}><VillageIcon name="bell" size={16}/>Inbox {unread > 0 && <span className="unread-badge">{unread}</span>}</button><button className="button secondary settings-entry" aria-label="Open Settings" aria-pressed={modal === 'settings'} onClick={() => setModal('settings')}><Settings size={16} aria-hidden="true" />Settings</button><button className="profile-entry" aria-label="My profile" aria-pressed={selected === user} onClick={() => setSelected(user)}><Portrait person={me.villager} /></button></div><div className="topbar-utilities">{onSignIn && <button className="button secondary" style={{width: 'auto', whiteSpace: 'nowrap'}} onClick={onSignIn}>Sign in</button>}<VillageAlerts key={village.id} disaster={village.world?.disaster} events={village.active_events} onRepair={() => setModal("checkin")} onEvents={() => setModal("mayor")} />{onSignOut && <button className="text-button" onClick={onSignOut}>Sign out</button>}<button className="button secondary clean-entry" aria-label="Enter clean fullscreen view" title="Fullscreen (F)" onClick={enterClean}><Maximize size={16} aria-hidden="true" /></button><SoundButton /></div></header>
    <main className="village-main">
      <VillageScene onLocationOpen={sceneLocation} onReading={() => setModal('reading')} cinematic={modal === 'checkin' || modal === 'mayor' ? modal : null} sceneReward={sceneReward} currentUser={user} controlsBlocked={!!modal || interiorVisible} onZoomChange={setZoomed} paused={interiorVisible || modal === 'compete' || modal === 'shop' || modal === 'reading'} village={sceneVillage!} selected={selected} onSelect={sceneSelect} onShop={sceneShop} onMayor={sceneMayor} onGazette={sceneNews} />
      <section className="welcome"><p className="eyebrow"><span className="sun-symbol"><VillageIcon name="sun" size={14}/></span> THE NEIGHBORHOOD</p><h1>Your friends.<br />One village.</h1><p>Set a goal. See what the neighbors are up to.</p></section>
      <Dashboard onGazette={() => setModal('gazette')} onReading={() => setModal('reading')} onActivity={openActivity} key={`${village.id}:${user}:${clean}`} village={village} me={me} feed={feed} zoomed={zoomed} onCheckIn={() => setModal('checkin')} onGoal={() => setModal('goal')} onAccomplishments={() => setModal('accomplishments')} />
      {clean && <ToastNotice kind="info" message="Press any key to exit clean view"/>}
      <div className="social-entry-stack"><button className="button secondary friends-entry" aria-keyshortcuts="b" title="Friends (B)" onClick={() => {setSelected(null); setModal('friends');}}>Friends</button><button className="button secondary hall-entry" onClick={()=>setHallOpen(true)}>Community Hall</button><button className="button secondary accomplishments-entry" onClick={() => {setSelected(null); setModal('accomplishments');}}>Accomplishments</button></div><NeighborsStrip key={village.id} villagers={village.villagers} onSelect={setSelected} />
      <nav className="action-dock" aria-label="Village actions">
        {([
          ['checkin', 'Check in', 'C', Plus], ['village', 'Village', 'V', Sprout], ['goal', 'My goal', 'I', Flag],
          ['week', 'Weekly review', 'Alt+W', CalendarDays], ['compete', 'Compete', 'P', Trophy], ['mayor', 'Mayor', 'M', Crown], ['shop', 'Shop', 'Alt+S', ShoppingBag],
        ] as const).map(([id, label, key, Icon]) => <button key={id} onPointerEnter={() => prefetchModal(id)} onFocus={() => prefetchModal(id)} className={id === 'checkin' ? 'checkin-action' : undefined} aria-label={label} aria-pressed={modal === id} aria-keyshortcuts={key.toLowerCase()} title={`${label} - ${key}`} disabled={switching} onClick={() => setModal(id)}><Icon size={18} /><span>{label}</span>
          {id === 'week' && week?.village_id === village.id && week.status === 'open' && week.goals.some(g => !g.excluded && !g.grade) && <span className="hud-badge" aria-label="Pending grades">{week.goals.filter(g => !g.excluded && !g.grade).length}</span>}
        </button>)}
      </nav>
    </main>
    {hallOpen && <HouseInterior hall person={me.villager} vid={village.id} onClose={() => setHallOpen(false)} />}
    {homeOpen && village.villagers.find(p => p.user_id === user) && <HouseInterior person={village.villagers.find(p => p.user_id === user)!} vid={village.id} onClose={() => setHomeOpen(false)} />}
    {selected && <ProfilePanel accomplishmentTarget={accomplishmentTarget} houseTarget={houseTarget} onShopItem={id => {setShopItem(id); setModal('shop');}} profile={linkedProfile} loading={profileLoading} error={profileError} onRetry={() => setProfileAttempt(n => n + 1)} onClose={() => {setActivityLink(null);setSelected(null);}} key={`profile:${selected}`} vid={village.id} owner={isOwner(village)} refresh={refresh} mine={selected === user} onCheckIn={() => setModal('checkin')} onSettings={() => setModal('settings')} onMessage={() => {setMessagePeer(selected); setModal('messages');}} />}
    {modal === 'help' && <NavigationGuide onClose={closeModal} onGo={goTo} onTour={() => {setModal(null); setTour(0);}} />}
    {modal === 'friends' && <Friends key={`${village.id}:${user}`} village={village} user={user} onClose={closeModal} onProfile={(id,section) => {setModal(null);setSelected(id,section);}} onMessage={id => {setSelected(null);setMessagePeer(id);setModal('messages');}} onChallenge={name => {setSelected(null);setChallenge({name,request:Date.now()});setModal('compete');}} />}
    {modal === 'reading' && <ReadingList key={`${village.id}:${user}`} village={village} refresh={refresh} onClose={common.onClose} />}
    {modal === 'accomplishments' && <Accomplishments key={`${village.id}:${user}`} village={village} onClose={common.onClose} />}
    {modal === 'messages' && <Messages key={`${village.id}:${user}`} village={village} initial={messagePeer} onClose={common.onClose} changed={mailChanged} />}
    {modal === 'gazette' && <Gazette key={`${village.id}:${user}`} village={village} onClose={common.onClose} onProfile={id => { setModal(null); setSelected(id); }} />}
    {modal === 'village' && <VillagePanel onGazette={() => setModal('gazette')} onIssue={setGazetteIssue} village={village} onClose={common.onClose} refresh={refresh} onPhoto={() => setModal('group-photo')} />}
    {modal === 'group-photo' && <GroupPhotoPanel key={`${village.id}:${user}`} village={village} onClose={common.onClose} refresh={refresh} />}
    {unlocks.length > 0 && <Celebration aboveDialog title={`New building unlocked: ${unlocks.join(', ')}`} onDone={clearUnlocks} />}
    {modal === 'face' && <FaceCheck key={`face:${user}`} name={me.villager.display_name} onClose={() => {setModal(null); setFaceInvite(false);}} onRecognized={() => {setFaceInvite(false); if (!recognized.current.has(user)) {recognized.current.add(user); let seen = false; try {const key = `village:face-badge:${user}`; seen = localStorage.getItem(key) === 'seen'; localStorage.setItem(key, 'seen');} catch { /* Session deduplication still works without storage. */ } if (!seen) toast('Recognized by the village');}}} />}
    {modal === 'settings' && <SettingsPanel onSignOut={onSignOut} onFaceCheck={() => setModal('face')} onClose={common.onClose} refresh={refresh} onDeleted={() => {++generation.current; ++profileGeneration.current; sound.stop(); setModal(null); setSelected(null); setVillage(null); setMe(null); setFeed([]); setDeleted(true); api.tokenProvider = undefined; onSignOut?.();}} />}
    {tour !== null && tourReady && <Tour onGo={goTo} featuredName={featuredVillager?.display_name ?? "Your neighbor"} step={tour} onStep={setTour} onClose={() => setTour(null)} />}
    {modal === 'week' && <WeekPanel key={`${village.id}:${user}`} village={village} onClose={common.onClose} refresh={refresh} onWeek={setWeek} celebrate={celebrate} />}
    {(arenaMounted || modal === 'compete') && <WarmCompetitions warmAllowed={(!modal && !selected && !homeOpen && !hallOpen) || modal === 'compete'} challenge={challenge} active={modal === 'compete'} key={`arena:${village.id}:${user}`} village={village} onClose={common.onClose} refresh={refresh} celebrate={celebrate} />}
    {celebration && <Celebration title={`${celebration.title}${celebration.ids.length ? ' - ' + celebration.ids.map(id => village.villagers.find(v => v.user_id === id)?.display_name).join(', ') : ''}`} onDone={finishCelebration} />}
    {modal === 'agents' && <AgentPanel village={village} onClose={common.onClose} refresh={refresh} />}
    {(modal === 'checkin' || modal === 'mayor') && <CinematicScene key={`${modal}:${village.id}:${user}`} kind={modal} feed={feed} village={village} profile={me} week={week} reward={sceneReward} onGoal={() => setModal('goal')} onPlay={() => setModal('compete')} onClose={common.onClose} submit={submitCheckIn} refresh={refresh}/>}
    {modal === 'goal' && <GoalModal {...common} profile={me} />}
    <WarmShop active={modal === 'shop'} person={village.villagers.find(v => v.user_id === user)} {...common} onSettings={openSettings} focusItem={shopItem} initialSection={shopSection} />
    {modal === 'update' && activityLink && <ActivityUpdate item={activityLink.item} village={village} onClose={common.onClose}/>}
    {activityLink && <ActivityDestination key={`${activityLink.item.id}:${selected}:${modal}`} link={activityLink} vid={village.id} selected={selected} modal={modal} onFallback={() => {setActivityLink(null); setModal(null); setSelected(activityLink.item.user_id);}} />}
    <KeyboardShortcuts onOpen={next => { if (!modal && !switching && tour === null) setModal(next); }} />
  </div></PresenceProvider></DisasterContext.Provider></ActivityEvidence.Provider></ActivityNavigation.Provider></ActivityTitles.Provider>;
}
function KeyboardShortcuts({ onOpen }: { onOpen: (modal: Modal) => void }) {
  useEffect(() => {
    const keys: Record<string, Modal> = { b: 'friends', a: 'accomplishments', c: 'checkin', v: 'village', w: 'week', p: 'compete', s: 'shop', m: 'mayor', g: 'gazette', i: 'goal' };
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || document.querySelector('dialog[open]') || event.target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(event.target.tagName) || event.target.isContentEditable)) return;
      const key=event.key.toLowerCase();
      if (key === 'c' ? event.shiftKey : ['a','w','s'].includes(key) !== event.altKey) return;
      const next = keys[key]; if (next) { event.preventDefault(); onOpen(next); }
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [onOpen]);
  return null;
}

/** Scoped adapter for existing panels that do not yet expose target-ID props.
 * Resolve IDs with read-only APIs, then use only navigation controls. Never click
 * join, submit, purchase, review, generation, or other mutation controls here.
 */
function ActivityDestination({link, vid, selected, modal, onFallback}: {
  link: {item: FeedItem; target: ActivityTarget}; vid: string; selected: string | null; modal: Modal;
  onFallback: () => void;
}) {
  const {target} = link;
  const [media, setMedia] = useState<{url: string; video: boolean} | null>(null);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let cancelled = false, observer: MutationObserver | undefined, timeout: ReturnType<typeof setTimeout> | undefined;
    let objectUrl = '', highlighted: HTMLElement | undefined;
    const highlight = (node?: HTMLElement | null) => {
      if (!node || !node.getClientRects().length) return false;
      node.classList.add('activity-destination'); node.tabIndex = -1;
      node.scrollIntoView({block:'center',behavior:'instant'}); node.focus({preventScroll:true}); highlighted = node;
      return true;
    };
    const watch = (step: () => boolean) => {
      if (cancelled) return;
      const run = () => {if (cancelled) return; if (step()) {observer?.disconnect(); clearTimeout(timeout);}};
      observer = new MutationObserver(run); observer.observe(document.body,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['open','aria-selected','aria-pressed']});
      timeout = setTimeout(() => {observer?.disconnect(); if (!cancelled) setMessage('This detail is no longer available. You can visit their profile.');},15000);
      run();
    };
    const button = (root: ParentNode, selector: string, text: string) => Array.from(root.querySelectorAll<HTMLButtonElement>(selector)).find(node => node.textContent?.trim() === text);
    const load = async () => {
      if (target.kind === 'activity' && selected === target.userId) {
        let tabOpened = false;
        watch(() => {
          const root = document.querySelector('.profile-panel'); if (!root) return false;
          const tab = button(root,'[role=tab]','Activity'); if (!tab) return false;
          if (!tabOpened) {tabOpened = true; tab.click(); return false;}
          if (tab.getAttribute('aria-selected') !== 'true') return false;
          const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-activity-id]'));
          const node = (target.id ? nodes.find(node => node.dataset.checkinId === target.id) : undefined) ?? nodes.find(node => node.dataset.activityId === target.eventId);
          const details = node?.closest('details'); if (details && !details.open) details.open = true;
          return highlight(node);
        });
      } else if (target.kind === 'goal' && selected === target.userId) {
        let opened = false;
        watch(() => {
          const root = document.querySelector('.profile-panel'); if (!root) return false;
          const tab = button(root,'[role=tab]','Overview'); if (!tab) return false;
          if (!opened) {opened = true; tab.click();}
          return highlight(root.querySelector<HTMLElement>('.profile-section'));
        });
      } else if (target.kind === 'competition' && modal === 'compete') {
        const detail = await api.competition(vid,target.id);
        const entry = detail.entries.find(entry => entry.id === target.entryId);
        if (cancelled) return;
        let picked = false, participantOpened = false;
        watch(() => {
          const root = document.querySelector('dialog[open].arena-modal'); if (!root) return false;
          const filter = button(root,'[aria-label="Competition list filters"] button',detail.status === 'settled' ? 'Past' : 'Current');
          if (!filter) return false;
          if (filter.getAttribute('aria-pressed') !== 'true') {filter.click(); return false;}
          const banners = root.querySelectorAll<HTMLButtonElement>('.arena-banner');
          if (!picked) {
            const banner = Array.from(banners).find(node => node.dataset.competitionId === target.id); if (!banner || banner.disabled || banner.querySelector('strong')?.textContent !== detail.title) return false;
            picked = true; banner.click(); return false;
          }
          if (!entry) return highlight(root.querySelector<HTMLElement>('.arena-header'));
          if (!participantOpened) {
            // Match by the same ID-based standings order used by the Colosseum;
            // display names are not unique and decision events belong to auditors.
            const participant = root.querySelectorAll<HTMLButtonElement>('.arena-rail button[aria-label^="Progress of "]')[standings(detail).findIndex(row => row.user_id === entry.user_id)];
            if (!participant) return false;
            participantOpened = true; participant.click(); return false;
          }
          const entries = detail.entries.filter(e => e.user_id === entry.user_id);
          return highlight(root.querySelectorAll<HTMLElement>('[aria-label="Participant evidence"] .arena-evidence')[entries.findIndex(e => e.id === entry.id)]);
        });
      } else if (target.kind === 'reading' && modal === 'reading') {
        const week = target.week && /^\d{4}-\d{2}-\d{2}$/.test(target.week) ? target.week : readingMonday();
        const shelf = await api.request<ReadingShelf>('GET',`/villages/${vid}/reading?week_start=${encodeURIComponent(week)}`);
        const index = shelf.items.findIndex(item => item.id === target.id);
        if (index < 0) throw new Error('This reading item is no longer on the shelf.');
        watch(() => {
          const root = document.querySelector('.reading-library'); if (!root) return false;
          const shown = root.querySelector('.reading-weeks strong')?.textContent?.match(/\d{4}-\d{2}-\d{2}/)?.[0];
          if (!shown) return false;
          if (shown !== week) {button(root,'.reading-weeks button',shown > week ? 'Previous week' : 'Next week')?.click(); return false;}
          const card = root.querySelectorAll<HTMLElement>('.reading-card')[index];
          if (!card?.querySelector('h3')?.textContent?.startsWith(shelf.items[index].title)) return false;
          return highlight(card);
        });
      } else if (target.kind === 'media') {
        let source: {audio_url?: string | null; video_url?: string | null};
        if (target.media === 'gram') {
          source = await api.request('GET',`/villages/${vid}/villagergrams/${encodeURIComponent(target.id)}`);
          if (!source.video_url) source = await api.request('GET',`/voice/lines/${encodeURIComponent(target.id)}`);
        } else source = await api.request('GET',`/voice/lines/${encodeURIComponent(target.id)}`);
        const url = source.video_url ?? source.audio_url;
        if (!url) throw new Error('No recording is available for this message yet.');
        if (!/^\/api\/assets\//.test(url)) throw new Error('This recording is unavailable.');
        const blob = await api.request<Blob>('GET',url.slice(4));
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob); setMedia({url:objectUrl,video:!!source.video_url});
      }
    };
    void load().catch(e => {if (!cancelled) setMessage(errorText(e));});
    return () => {cancelled = true; observer?.disconnect(); clearTimeout(timeout); highlighted?.classList.remove('activity-destination'); if (objectUrl) URL.revokeObjectURL(objectUrl);};
  }, [link, vid, selected, modal]);
  if (target.kind === 'media') return <Dialog title="Village recording" eyebrow="AROUND THE VILLAGE" onClose={onFallback}><p>{link.item.text}</p>{message ? <p role="status">{message}</p> : media ? media.video ? <video controls autoPlay src={media.url} style={{maxWidth:'100%'}}/> : <audio controls autoPlay src={media.url}/> : <p role="status">Loading recording…</p>}<button className="text-button" onClick={onFallback}>Visit profile</button></Dialog>;
  return message ? <Dialog title="Activity detail" eyebrow="AROUND THE VILLAGE" onClose={onFallback}><p role="status">{message}</p><button className="button secondary" onClick={onFallback}>Visit profile</button></Dialog> : null;
}
