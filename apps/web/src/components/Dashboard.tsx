import { ModalHeader } from './ModalHeader';
import { dashboardCollapsedOnBoot } from './chromePreferences';
import { lazyPanel } from './lazyPanel';
const HeadChorus = lazyPanel(() => import('./HeadStudio').then(m => ({default:m.HeadChorus})));
import { CurrencyAmount, CurrencyIcon, CurrencyText } from './Currency';
import { useEffect, useRef, useState } from 'react';
import type { FeedItem, Profile, Village } from '../api/types';
import { ActivityFeed } from './ActivityFeed';
import { groupActivity } from './activityData';
import { XpBar } from './shared';
import './Dashboard.css';
import { VillageIcon, widgetIcons } from './VillageIcon';

function WidgetBadge({id}: {id: Id}) { return <span className={`widget-badge widget-badge-${id}`}><VillageIcon name={widgetIcons[id]}/></span>; }

const ids = ['feed', 'corner', 'goal'] as const;
type Id = typeof ids[number];
const titles: Record<Id, string> = { feed: 'Around the village', corner: 'Your corner', goal: "This week's goal" };
type Preferences = { order: Id[]; hidden: Id[]; collapsed: boolean };
function read(key: string): Preferences {
  try { const p = JSON.parse(localStorage.getItem(key) || '{}'); return { order: [...new Set<Id>([...(Array.isArray(p.order) ? p.order.filter((id: Id) => ids.includes(id)) : []), ...ids])], hidden: Array.isArray(p.hidden) ? p.hidden.filter((id: Id) => ids.includes(id)) : [], collapsed: p.collapsed === true }; } catch { return { order: [...ids], hidden: [], collapsed: false }; }
}
export function Dashboard({ village, me, feed, zoomed, onCheckIn, onGoal, onAccomplishments, onActivity, onReading, onGazette }: { village: Village; me: Profile; feed: FeedItem[]; zoomed: boolean; onCheckIn: () => void; onGoal: () => void; onAccomplishments: () => void; onReading: () => void; onGazette: () => void; onActivity: (item: FeedItem) => void }) {
  const key = `village:dashboard:${village.id}:${me.villager.user_id}`;
  const [prefs, setPrefs] = useState(() => {const saved = read(key); return {...saved, collapsed: dashboardCollapsedOnBoot(saved.collapsed, window.matchMedia('(max-width: 700px)').matches)};});
  const [override, setOverride] = useState(false);
  const [open, setOpen] = useState<Id | null>(null), [menu, setMenu] = useState<Id | null>(null);
  const [closing, setClosing] = useState(false);
  const panel = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [filter, setFilter] = useState('all'), [limit, setLimit] = useState(8);
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(prefs)); } catch { /* Session preferences still work. */ } }, [key, prefs]);
  useEffect(() => setOverride(false), [zoomed]);
  useEffect(() => () => clearTimeout(timer.current), []);
  function minimize() {
    if (!open || closing) return;
    const node = panel.current, slot = document.querySelector(`[data-widget="${open}"]`);
    if (node && slot) {
      const from = node.getBoundingClientRect(), to = slot.getBoundingClientRect();
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      node.animate([{opacity:1,transform:'none'}, {opacity:0,transform:reduced ? 'none' : `translate(${to.left-from.left}px, ${to.top-from.top}px) scale(${to.width/from.width}, ${to.height/from.height})`}], {duration:180,fill:'forwards',easing:'ease'});
    }
    setClosing(true); timer.current = setTimeout(() => { setOpen(null); setClosing(false); trigger.current?.focus(); }, 180); }
  useEffect(() => { if (!open) return; panel.current?.focus(); const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); minimize(); } }; window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape); }, [open, closing]);
  useEffect(() => { const reset = () => setPosition({ x: 0, y: 0 }); window.addEventListener('resize', reset); return () => window.removeEventListener('resize', reset); }, []);
  const collapsed = prefs.collapsed || (zoomed && !override);
  const grouped = groupActivity(feed);
  const activity = grouped.filter(g => filter === 'all' || (filter === 'mine' ? g.items[0].user_id === me.villager.user_id : g.items[0].type === filter));
  const days = Array.from({length: 28}, (_, i) => { const date = new Date(); date.setUTCDate(date.getUTCDate() - 27 + i); return date.toISOString().slice(0,10); });
  function content(id: Id, full: boolean) {
    if (id === 'feed') return <>{full && <label>Show <select aria-label="Activity filter" value={filter} onChange={e => {setFilter(e.target.value);setLimit(8);}}><option value="all">Everyone</option><option value="mine">My activity</option>{[...new Set(grouped.map(g => g.items[0].type))].map(type => <option key={type} value={type}>{type.replaceAll('_',' ')}</option>)}</select></label>}<ActivityFeed onOpen={item => {setOpen(null); onActivity(item);}} groups={full ? activity.slice(0,limit) : grouped.slice(0,4)} vid={village.id} people={village.villagers} compact={!full}/>{!grouped.length && <p>No activity yet. Open Friends and send someone a wave.</p>}{full && <><button className="text-button" disabled={limit >= activity.length} onClick={() => setLimit(n => n+8)}>Load more</button><p className="help-text">Showing {Math.min(limit,activity.length)} of {activity.length} available recent entries.</p><button className="text-button" onClick={onAccomplishments}>Accomplishments</button></>}</>;
    if (id === 'corner') return <><div className="wallet-balances"><span><CurrencyIcon currency="XP"/><span data-testid={full ? undefined : "my-xp"}>{me.villager.xp}</span> XP</span><span data-testid={full ? undefined : "my-coins"}><CurrencyAmount amount={me.villager.coins} currency="coins"/></span><span><CurrencyIcon currency="SOL"/> &mdash; SOL <small className="devnet-tag">devnet &middot; test</small></span></div><div className="corner-progress"><span className="streak-ring" aria-label={`${me.villager.streak_days} day streak`}><strong>{me.villager.streak_days}</strong><small>day streak</small></span><XpBar person={me.villager}/></div>{full && <><h3>XP breakdown</h3><p><CurrencyAmount amount={50*(me.villager.level-1)**2} currency="XP"/> to reach this level; <CurrencyAmount amount={Math.max(0,me.villager.xp-50*(me.villager.level-1)**2)} currency="XP"/> earned toward the next.</p><p className="help-text">An XP award ledger is not available. Your total above is authoritative.</p><h3>Check-in calendar · last 28 days (UTC)</h3><div className="streak-calendar">{days.map(day => {const checked = me.check_ins.some(c => c.created_at.startsWith(day));return <span key={day} className={checked ? 'checked' : ''} title={`${day}: ${checked ? 'checked in' : 'no check-in in available history'}`}>{Number(day.slice(-2))}{checked && ' ✓'}</span>;})}</div><p className="help-text">Marked days come from available check-in history.</p></>}<button className="text-button" onClick={onCheckIn}>Check in today</button></>;
    return <><p className={full ? '' : 'widget-summary'}>{me.goal?.title}</p>{full && <><p>{me.goal?.detail}</p><p>Status: {me.goal?.status}</p></>}<button className="text-button" onClick={onGoal}>View goal</button><button className="text-button" onClick={onAccomplishments}>See accomplishments</button></>;
  }
  function move(id: Id, delta: number) { setPrefs(p => {const order=[...p.order], at=order.indexOf(id), to=at+delta; if(to>=0 && to<order.length) [order[at],order[to]]=[order[to],order[at]];return {...p,order};}); }
  return <><aside className={`dashboard ${collapsed ? 'is-collapsed' : ''}`} aria-label="Village dashboard" data-collapsed={collapsed}>
    <div className="dashboard-body" ref={node => { if(node) node.inert = collapsed; }}>
      <header className="dashboard-heading"><strong>Your dashboard</strong><button className="dashboard-gazette" onClick={() => {setPrefs(p => ({...p,collapsed:true}));setOpen(null);onGazette();}}>Gazette</button><button aria-label="Collapse dashboard" onClick={() => setPrefs(p => ({...p,collapsed:true}))}>‹</button></header>
      <div className="dashboard-cards">{prefs.order.filter(id => !prefs.hidden.includes(id) && (id !== 'goal' || me.goal)).map(id => <section className="dashboard-card" key={id} data-widget={id} aria-label={titles[id]}><header><h2><WidgetBadge id={id}/>{titles[id]}</h2><button aria-label={`Pop out ${titles[id]}`} onClick={e => {trigger.current=e.currentTarget;clearTimeout(timer.current);setClosing(false);setPosition({x:0,y:0});setOpen(id);}}>⤢</button><button aria-label={`Options for ${titles[id]}`} aria-expanded={menu === id} onClick={() => setMenu(menu === id ? null : id)}>⋯</button></header>{menu === id && <div className="widget-options"><button disabled={prefs.order.indexOf(id)===0} onClick={() => move(id,-1)}>Move up</button><button disabled={prefs.order.indexOf(id)===prefs.order.length-1} onClick={() => move(id,1)}>Move down</button><button onClick={() => {setPrefs(p => ({...p,hidden:[...p.hidden,id]}));setMenu(null);if(open===id)setOpen(null);}}>Hide widget</button></div>}{content(id,false)}</section>)}</div>
      {prefs.hidden.length > 0 && <details className="restore-widgets"><summary>Hidden widgets ({prefs.hidden.length})</summary>{prefs.hidden.map(id => <button key={id} onClick={() => setPrefs(p => ({...p,hidden:p.hidden.filter(i => i!==id)}))}>Show {titles[id]}</button>)}</details>}
    </div>
    {collapsed && <button className="dashboard-ribbon" aria-label="Reopen dashboard" onClick={() => {setPrefs(p => ({...p,collapsed:false}));setOverride(true);}}>›</button>}
  </aside>{open && <div ref={panel} tabIndex={-1} role="dialog" aria-label={titles[open]} className={`widget-popout widget-theme-${open} ${closing ? 'minimizing' : ''}`} style={{translate:`${position.x}px ${position.y}px`}}><ModalHeader title={<><WidgetBadge id={open}/>{titles[open]}</>} closeLabel={`Minimize ${titles[open]}`} onClose={minimize} onPointerDown={e => {if((e.target as HTMLElement).closest('button'))return;const node=e.currentTarget, rect=panel.current!.getBoundingClientRect(), start={clientX:e.clientX,clientY:e.clientY,...position};node.setPointerCapture(e.pointerId);node.onpointermove=ev => {setPosition({x:start.x+Math.max(-rect.left,Math.min(innerWidth-rect.right,ev.clientX-start.clientX)),y:start.y+Math.max(-rect.top,Math.min(innerHeight-rect.bottom,ev.clientY-start.clientY))});};node.onpointerup=node.onpointercancel=()=>{node.onpointermove=null;};}} /><div className="widget-detail">{content(open,true)}</div></div>}</>;
}
