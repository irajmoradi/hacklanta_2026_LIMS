import { change, historyOf, step } from './houseHistory';
import { useHouseLeaveGuard } from './HouseLeaveGuard';
import { paintHousePreview } from './previewColors';
import { PreviewEditor } from './TryOnPane';
import { VillageIcon } from './VillageIcon';
import { ToastNotice } from './Toast';
import { HOUSE_VARIANTS, MATERIAL_CHOICES, cleanHouseOptions, type HouseOptions, type HouseMaterials } from '../scene/houseOptions';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { api } from '../api/client';
import type { HouseColors, Villager } from '../api/types';
import { HOUSE_PALETTES, HOUSE_PARTS, HOUSE_STYLES, selectHouse, validHouseColors, type HouseStyle } from '../scene/houseStyles';
import { OptionalModel } from '../scene/OptionalModel';
import { errorText } from './shared';
import './houseEditor.css';

const COZY = ['#f1d9ad','#eee3c8','#d9ddd0','#b6c6c9','#9dc9cc','#c4b3d6','#e7bca3','#ca795d','#b86c52','#aa6351','#d7a95f','#718c73','#487d6b','#536f87','#69566b','#4f3c35'];
const names: Record<HouseStyle, string> = {cottage:'Cottage', modern:'Modern', aframe:'A-frame', tudor:'Tudor', beach:'Beach', townhouse:'Townhouse'};
const normalize = (colors: HouseColors) => Object.fromEntries(Object.entries(colors).map(([k,v]) => [k,v.toLowerCase()])) as HouseColors;

function Preview({person}: {person: Villager & HouseOptions}) {
  const group = useRef<Group>(null), house = selectHouse(person);
  const initialColors = useMemo(() => house.colors, [house.model, JSON.stringify(house.materials)]);
  useLayoutEffect(() => {if (group.current) paintHousePreview(group.current,house.colors);}, [house.colors]);
  useFrame((_, delta) => { if (group.current) {group.current.rotation.y += delta * .22; paintHousePreview(group.current,house.colors);} });
  return <group ref={group} rotation={[0,-.5,0]} position={[0,-1.3,0]}>
    <OptionalModel name={house.model} size={3} colors={initialColors} surfaces={house.materials}>
      <mesh position={[0,1,0]}><boxGeometry args={[2,2,2]}/><meshStandardMaterial name="wall" color={house.colors.wall}/></mesh>
      <mesh position={[0,2.3,0]} rotation={[0,Math.PI/4,0]}><coneGeometry args={[1.7,1,4]}/><meshStandardMaterial name="roof" color={house.colors.roof}/></mesh>
    </OptionalModel>
  </group>;
}

/** Tiny architectural silhouettes keep every option available without generated assets. */
function Thumbnail({style}: {style: HouseStyle}) {
  const colors = HOUSE_PALETTES[style][0], flat = style === 'modern', tall = style === 'townhouse';
  return <svg viewBox="0 0 100 74" aria-hidden="true">
    <ellipse cx="50" cy="68" rx="40" ry="4" fill="#ddd5c3"/>
    <path d={style === 'aframe' ? 'M15 65 L50 8 L85 65 Z' : tall ? 'M32 65 V12 H68 V65 Z' : 'M20 65 V30 H80 V65 Z'} fill={colors.wall}/>
    <path d={flat ? 'M16 26 H84 V34 H16 Z' : tall ? 'M28 12 H72 V19 H28 Z' : style === 'aframe' ? 'M10 65 L50 3 L90 65 H81 L50 17 L19 65 Z' : 'M12 33 L50 8 L88 33 Z'} fill={colors.roof}/>
    {style === 'tudor' && <path d="M23 34 L77 62 M77 34 L23 62 M50 32 V64" stroke={colors.trim} strokeWidth="4"/>}
    <path d="M44 65 V44 H58 V65" fill={colors.door}/>
    <path d={tall ? 'M40 25 H48 V35 H40 Z M55 25 H63 V35 H55 Z' : 'M27 40 H38 V50 H27 Z M64 40 H75 V50 H64 Z'} fill={colors.accent} stroke={colors.trim} strokeWidth="2"/>
    {style === 'beach' && <path d="M15 58 H85 M22 55 V69 M78 55 V69" stroke={colors.trim} strokeWidth="3"/>}
  </svg>;
}

export function HouseEditor({person, vid, refresh, onClose}: {onClose: () => void; person: Villager; vid: string; refresh: () => Promise<void>}) {
  const [history, setHistory] = useState(() => historyOf<{options: HouseOptions; style: HouseStyle | null; colors: HouseColors | null}>({options: cleanHouseOptions(person), style: person.house_style ?? null as HouseStyle | null, colors: person.house_colors ?? null as HouseColors | null}));
  const {options, style, colors} = history.present;
  const scope = useRef<HTMLElement>(null);
  const setOptions = (options: HouseOptions) => setHistory(h => change(h, {...h.present, options}));
  const setStyle = (style: HouseStyle | null) => setHistory(h => change(h, {...h.present, style}));
  const setColors = (colors: HouseColors | null) => setHistory(h => change(h, {...h.present, colors}));
  const [part, setPart] = useState<typeof HOUSE_PARTS[number]>('wall');
  const [hex, setHex] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const draft = {...person, ...options, house_style: style, house_colors: colors};
  const house = selectHouse(draft);
  function paint(value: string) { setColors({...normalize(house.colors), [part]: value}); setHex(''); setMessage(''); }
  async function save() {
    if (hex) {setError('Apply or clear the custom hex before saving.'); return false;}
    setBusy(true); setError(''); setMessage('');
    try { await api.updateSettings({village_id: vid, house_style: style, house_colors: colors, ...options}); void refresh().catch(() => setError('House saved; the village could not refresh.')); setHistory(h => historyOf(h.present)); setMessage('House saved. Welcome home!'); return true; }
    catch (e) { setError(errorText(e)); return false; } finally { setBusy(false); }
  }
  function discard() {setHistory(h => historyOf(h.past[0] ?? h.present)); setHex(''); setMessage(''); return true;}
  function travel(forward = false) {if (!busy) {setHistory(h => step(h, forward)); setHex(''); setMessage('');}}
  const guard = useHouseLeaveGuard({scope, dirty: history.past.length > 0 || !!hex, busy, save, discard, escape: () => {discard(); onClose();}, cancelOnEscape: true});
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!scope.current?.contains(e.target as Node) || document.querySelector('.interior-dialog') || document.querySelector('.house-leave-dialog') || (e.target as HTMLElement).closest('input,textarea,select,[contenteditable="true"]')) return;
      if ((e.ctrlKey || e.metaKey) && ['z','y'].includes(e.key.toLowerCase())) {e.preventDefault(); travel(e.shiftKey || e.key.toLowerCase() === 'y');}
    };
    window.addEventListener('keydown', handler, true); return () => window.removeEventListener('keydown', handler, true);
  });
  return <PreviewEditor scope={scope} title="Edit your house" onCancel={() => {if (!busy) {discard(); onClose();}}} preview={<div className="house-preview" aria-label="Rotating house preview" data-model={house.model} data-colors={JSON.stringify(house.colors)}>
      <Canvas camera={{position:[5,3.3,6], fov:38}} dpr={1}><color attach="background" args={['#f0eddf']}/><ambientLight intensity={1.8}/><directionalLight position={[4,7,5]} intensity={2.5}/><Preview person={draft}/></Canvas>
    </div>}>
    <section className="house-editor" aria-label="House editor">
    {guard.prompt}
    <div className="editor-scroll"><div className="house-history-actions" aria-label="House change history">
      <span aria-live="polite">{history.past.length ? `Unsaved changes (${history.past.length})` : 'No unsaved changes'}</span>
      <button disabled={busy || !history.past.length} onClick={() => travel()} aria-keyshortcuts="Control+z Meta+z" title="Undo (Ctrl/Cmd+Z)">Undo</button>
      <button disabled={busy || !history.future.length} onClick={() => travel(true)} aria-keyshortcuts="Control+Shift+z Meta+Shift+z Control+y" title="Redo (Ctrl/Cmd+Shift+Z or Ctrl+Y)">Redo</button>
      <button disabled={busy || (!history.past.length && !hex)} onClick={discard}>Discard all</button>
    </div>
    <h3>A home that feels like you</h3><p className="help-text">Choose a shape, then make it your own.</p>
    <fieldset disabled={busy}><legend>House style</legend><div className="house-style-grid">
      {HOUSE_STYLES.map(value => <button type="button" key={value} aria-pressed={style === value} onClick={() => {setStyle(value); setMessage('');}}><Thumbnail style={value}/>{names[value]}</button>)}
    </div><button type="button" className="text-button" aria-pressed={style === null} onClick={() => setStyle(null)}>Auto style</button>
    <p className="help-text">House level {person.house_level}. All six styles are available.</p><div className="house-levels" aria-label="House levels">{[1,2,3,4,5].map(level => <span key={level}><VillageIcon name={level > person.house_level ? 'lock' : 'check'} size={14}/> Level {level}</span>)}</div>
    {person.house_level > 3 && <p className="help-text">Classic uses the grand house shape at levels 4–5. Tower and greenhouse options keep your chosen style.</p>}
    </fieldset>
    <fieldset disabled={busy}><legend>Architecture — level {house.level}</legend>
    <div className="house-parts">{HOUSE_VARIANTS[String(house.level) as keyof typeof HOUSE_VARIANTS].map(value => <button type="button" key={value} aria-pressed={house.variant === value} onClick={() => {setOptions({...options, house_variant:{...options.house_variant,[house.level]:value}});setMessage('');}}>{value === 'bay' ? 'Bay window' : value === 'greenhouse' ? 'Greenhouse annex' : value[0].toUpperCase()+value.slice(1)}</button>)}</div>
    <p className="help-text">Your choice is remembered separately for each level in this village.</p></fieldset>
    <fieldset disabled={busy}><legend>Building materials</legend>{(Object.keys(MATERIAL_CHOICES) as (keyof HouseMaterials)[]).map(key => <label key={key} style={{display:'block',marginBottom:8}}>{key === 'wall' ? 'Siding' : key[0].toUpperCase()+key.slice(1)} <select aria-label={`${key} material`} value={options.house_materials?.[key] ?? ''} onChange={event => {const materials={...options.house_materials}; if (event.target.value) Object.assign(materials,{[key]:event.target.value}); else delete materials[key];setOptions({...options,house_materials:materials});setMessage('');}}><option value="">Style default</option>{MATERIAL_CHOICES[key].map(value => <option key={value} value={value}>{value[0].toUpperCase()+value.slice(1)}</option>)}</select></label>)}</fieldset>
    <fieldset disabled={busy}><legend>Ready-made palettes</legend><div className="house-presets">{HOUSE_PALETTES[house.style].map((palette,index) => <button type="button" key={index} aria-label={`Preset palette ${index+1}`} onClick={() => {setColors(normalize(palette)); setHex(''); setMessage('');}}>{Object.values(palette).map((color,i) => <span key={i} style={{background:color}}/>)}</button>)}</div><button type="button" className="text-button" onClick={() => {setColors(null);setHex('');}}>Use automatic palette</button></fieldset>
    <fieldset disabled={busy}><legend>Paint each part</legend><div className="house-parts">{HOUSE_PARTS.map(value => <button type="button" key={value} aria-pressed={part === value} onClick={() => {setPart(value);setHex('');}}><i style={{background:house.colors[value]}}/>{value}</button>)}</div>
    <div className="house-swatches">{COZY.map(color => <button type="button" key={color} aria-label={`Paint ${part} ${color}`} aria-pressed={house.colors[part].toLowerCase() === color} style={{background:color}} onClick={() => paint(color)}/>)}</div>
    <label>Custom {part} hex<input aria-label="Custom hex" value={hex} placeholder={house.colors[part].toLowerCase()} maxLength={7} onChange={e => setHex(e.target.value.toLowerCase())}/></label>
    {hex && !/^#[0-9a-f]{6}$/.test(hex) && <p className="help-text">Use # followed by six hex digits, such as #487d6b.</p>}
    <button type="button" className="button secondary" disabled={!/^#[0-9a-f]{6}$/.test(hex)} onClick={() => paint(hex)}>Apply hex</button></fieldset>
    </div><div className="editor-actions"><button className="button primary" disabled={busy || !!hex || (colors !== null && !validHouseColors(colors))} onClick={() => void save()}>{busy ? 'Saving…' : 'Save house'}</button><button className="button secondary" disabled={busy} onClick={onClose}>Cancel house</button></div>
    <ToastNotice message={message}/>{error && <p role="alert" className="form-error">{error}</p>}
  </section></PreviewEditor>;
}
