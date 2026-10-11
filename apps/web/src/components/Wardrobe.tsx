import { TryOnPane } from './TryOnPane';
import { canTryOn, tryOnPerson } from './tryOn';
import type { ToastInput } from './toastStore';
import { toast as notify } from './Toast';
import { CurrencyAmount, CurrencyIcon, CurrencyText } from './Currency';
import { sourceLabel } from './showcaseData';
import { ItemColorPanel } from './ItemColorPanel';
import { colorPresets } from '../scene/itemColors';
import { replaceSlot } from '../api/equipment';
import type { ItemColors, EquippedItem } from '../api/types';
import { ItemThumbnail } from './ItemThumbnail';
import { sound } from '../sound/engine';
import { Crown, Glasses, Shirt, Footprints, PawPrint, Home, Volume2, Flower2, Ribbon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { Shop, ShopItem, Villager, VillageWorld } from '../api/types';
import { itemState } from '../api/shopState';
import { PanelSkeleton, errorText, mediaUrl } from './shared';
import { ShowcasePreview } from './ShowcasePreview';

export function WardrobePreview({person}: {person: Villager}) {
  return <ShowcasePreview person={person} selected={null} wardrobe />;
}

export function EquipmentPanel({ vid, refresh, wardrobe: wardrobeProp = false, toast = notify, focusItem, onShopItem, initialSection = 'general', onSection, onPurchase, onLoaded, onPreview }: { onPreview?: (person: Villager | null) => void; onSection?: (section: 'general'|'farm') => void; onPurchase?: (item: ShopItem) => void; onLoaded?: (data: {shop: Shop; person: Villager}) => void; vid: string; refresh: () => Promise<void>; wardrobe?: boolean; initialSection?: 'general'|'farm'; focusItem?: string | null; onShopItem?: (id: string) => void; toast?: (text: string | ToastInput) => void }) {
  const [data, setData] = useState<{shop: Shop; person: Villager; world?: VillageWorld} | null>(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [attempt, setAttempt] = useState(0), [voiceState, setVoiceState] = useState('');
  const [collectionMode, setCollectionMode] = useState(false);
  const wardrobe = wardrobeProp || collectionMode;
  const [slotFilter, setSlotFilter] = useState('all');
  const [section,setSection] = useState<'general'|'farm'>(initialSection);
  useEffect(() => { onSection?.(section); }, [section, onSection]);
  useEffect(() => { if (data) onLoaded?.(data); }, [data, onLoaded]);
  const cards = useRef(new Map<string, HTMLElement>());
  const [focused, setFocused] = useState(focusItem);
  const focusCard = (id: string) => { setCollectionMode(false); setSlotFilter('all'); const item = data?.shop.items.find(i => i.id === id); setSection(item?.kind === 'farm_animal' || item?.kind === 'pet' || id === 'house_paddock' ? 'farm' : 'general'); setFocused(id); const card = cards.current.get(id); card?.scrollIntoView({block:'center'}); card?.focus({preventScroll:true}); };
  useEffect(() => { setFocused(focusItem); if (focusItem) setCollectionMode(false); }, [focusItem]);
  useEffect(() => { if (data && focused) { const card = cards.current.get(focused); card?.scrollIntoView({block:'center'}); card?.focus({preventScroll:true}); } }, [!!data, focused, section]);
  useEffect(() => { if (focused && data) { const item = data.shop.items.find(i => i.id === focused); setSection(item?.kind === 'farm_animal' || item?.kind === 'pet' || focused === 'house_paddock' ? 'farm' : 'general'); } }, [focused, !!data]);
  const [trying, setTrying] = useState<{item: ShopItem; colors?: ItemColors} | null>(null);
  const draftPerson = data && trying ? tryOnPerson(data.person, trying.item, trying.colors) : null;
  useEffect(() => { onPreview?.(draftPerson); }, [data, trying, onPreview]);
  useEffect(() => () => onPreview?.(null), [onPreview]);
  useEffect(() => { setTrying(null); setSlotFilter('all'); }, [section, vid]);
  const returnFocus = useRef<string | null>(null);
  useEffect(() => {
    if (!trying && !busy && returnFocus.current) {
      cards.current.get(returnFocus.current)?.querySelector<HTMLButtonElement>('[data-try-on]')?.focus();
      returnFocus.current = null;
    }
  }, [trying, busy]);
  const doneTrying = () => { returnFocus.current = trying?.item.id ?? null; setTrying(null); };
  const [paddockOffer,setPaddockOffer] = useState<ShopItem|null>(null);
  const audio = useRef<HTMLAudioElement | null>(null), alive = useRef(true), lock = useRef(false), revision = useRef(0);
  const stopAudio = () => { if (audio.current) { audio.current.pause(); if (audio.current.src.startsWith('blob:')) URL.revokeObjectURL(audio.current.src); audio.current = null; } };
  const load = async () => { const [shop, profile, village] = await Promise.all([api.shop(vid), api.profile(vid, api.user), api.village(vid)]); return {shop, person: profile.villager, world: village.world}; };
  useEffect(() => {
    alive.current = true; let active = true; setData(null); setError('');
    void load().then(value => { if (active) setData(value); }).catch(e => { if (active) setError(errorText(e)); });
    return () => { active = false; alive.current = false; stopAudio(); };
  }, [vid, attempt]);
  function refreshAccepted() {
    const version = revision.current;
    void Promise.all([load().then(next => { if (alive.current && version === revision.current) setData(next); }), refresh()])
      .catch(() => { if (alive.current && version === revision.current) setError('Saved; refresh the shop to see the latest village.'); });
  }
  async function change(item: ShopItem, action: 'buy' | 'equip' | 'unequip', addPaddock = false) {
    if (lock.current) return; lock.current = true; ++revision.current; setBusy(true); setError(''); stopAudio(); setVoiceState('');
    try {
      if (addPaddock) await api.buy(vid, 'house_paddock');
      const result = await api[action](vid, item.id);
      setPaddockOffer(null); sound.play(action === 'buy' ? 'coin_purchase' : 'equip_swoosh');
      if (item.slot === 'pet' && action !== 'unequip') sound.play('pet_bark_happy');
      if (!alive.current) return;
      if (action === 'buy') onPurchase?.(item);
      setData(current => {
        if (!current) return current;
        if ('balance' in result) {
          const owned = new Set(result.inventory.map(i => i.item_id));
          const equipped: EquippedItem[] = result.inventory.filter(i => i.equipped).flatMap(i => {
            const meta = current.shop.items.find(candidate => candidate.id === i.item_id);
            return meta && meta.slot !== 'consumable' ? [{...meta, ...current.person.equipped.find(existing => existing.item_id === meta.id), item_id:meta.id, slot:meta.slot}] : [];
          });
          equipped.push(...current.person.equipped.filter(i => i.custom && (item.slot === 'farm_animal' || i.slot !== item.slot)));
          return {...current, shop:{...current.shop, balance:result.balance, inventory:result.inventory, items:current.shop.items.map(i => ({...i, owned:owned.has(i.id)}))}, person:{...current.person, coins:result.balance, equipped, equipped_ids:equipped.map(i => i.item_id)}};
        }
        return {...current, person:{...current.person, ...result}};
      });
      if (action === 'buy' && trying?.item.id === item.id) {
        if (trying.colors && item.kind === 'clothing') {
          try { await api.itemColors(vid, item.id, trying.colors); }
          catch (e) { setError(`Purchased and equipped, but colors could not save: ${errorText(e)}. Retry in your wardrobe.`); }
        }
        if (alive.current) doneTrying();
      }
      toast?.({title:action === 'buy' ? item.kind === 'farm_animal' ? 'Your animal is in the paddock.' : 'Item equipped.' : 'Your outfit is updated.',detail:item.name});
      refreshAccepted();
    }
    catch (e) {
      if (alive.current) {
        setPaddockOffer(null); setError(errorText(e)); notify({kind:'error',title:errorText(e)});
        const results = await Promise.allSettled([load(), refresh()]);
        if (alive.current) {
          setData(results[0].status === 'fulfilled' ? results[0].value : null);
          if (results[1].status === 'rejected') setError(message => `${message} Profile could not refresh.`);
        }
      }
    }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  async function previewVoice() {
    if (!data || lock.current) return; lock.current = true; setBusy(true); setError(''); setVoiceState(''); stopAudio();
    try {
      const result = await api.voice(data.person.user_id, 'How did your goal go today? The village wants an update.', vid);
      if (!alive.current) return;
      if (!result.audio_url) {
        const style = data.person.equipped.find(i => i.slot === 'voice_style')?.item_id;
        const samples: Record<string, string> = { voice_pirate: 'Arrr, how goes yer goal? The village awaits yer report.', voice_hype_coach: 'How did your goal go today? Give the village an update!', voice_shakespearean: 'How fares thy goal? Thy village waits upon thy news.' };
        setVoiceState(api.mode === 'mock' ? `Demo sample: ${samples[style ?? ''] ?? 'How did your goal go today? The village wants an update.'} (No voice provider called.)` : 'Your voice is not connected yet.'); return;
      }
      const url = await mediaUrl(result.audio_url);
      if (!alive.current) { if (url.startsWith('blob:')) URL.revokeObjectURL(url); return; }
      const player = new Audio(url); audio.current = player;
      player.onerror = () => { if (alive.current) setError('Audio could not play. Please try again.'); stopAudio(); };
      player.onended = stopAudio;
      await player.play();
    } catch (e) { if (alive.current) setError(errorText(e)); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  const [selection, setSelection] = useState<{id: string; colors: ItemColors} | null>(null);
  async function saveColors() {
    if (!selection || lock.current) return;
    lock.current = true; ++revision.current; setBusy(true); setError('');
    try {
      await api.itemColors(vid, selection.id, selection.colors);
      if (alive.current) { setData(current => current ? {...current, person:{...current.person, equipped:current.person.equipped.map(item => item.item_id === selection.id ? {...item, colors:selection.colors} : item)}} : current); setSelection(null); }
      toast?.('Item colors saved.'); refreshAccepted();
    } catch (e) { if (alive.current) setError(errorText(e)); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  const selectedItem = data?.shop.items.find(i => i.id === selection?.id);
  const previewPerson = data && selection && selectedItem && selectedItem.slot !== 'consumable' ? {...data.person, equipped:replaceSlot(data.person.equipped, {item_id:selectedItem.id, slot:selectedItem.slot, asset_key:selectedItem.asset_key, colors:selection.colors})} : data?.person;
  const equipped = data?.person.equipped_ids ?? [];
  const styles = data?.shop.items.filter(i => itemState(i, data.shop, data.world).state === 'owned' && i.slot === 'voice_style') ?? [];
  return <div className="equipment-panel">
    {error && <p role="alert" className="form-error">{error}</p>}
    {!data ? <>{error ? <p>Wardrobe unavailable.</p> : <PanelSkeleton label="Opening the shutters..." />}{error && <button className="button secondary" onClick={() => setAttempt(n => n + 1)}>Retry shop</button>}</> : <>
      {focused && !data.shop.items.some(i => i.id === focused) && <p role="status" className="help-text">This item is not sold in the shop. Check its event or reward details for how to earn it.</p>}
      {!wardrobeProp && section==='general' && <div className="farm-tabs" role="tablist" aria-label="Shop collection">
        <button role="tab" aria-selected={!collectionMode} onClick={() => {setCollectionMode(false);setSlotFilter('all');setSelection(null);setTrying(null);}}>Shop items</button>
        <button role="tab" aria-selected={collectionMode} onClick={() => {setCollectionMode(true);setSlotFilter('all');setSelection(null);setTrying(null);}}>My wardrobe</button>
      </div>}
      {wardrobe && <WardrobePreview person={previewPerson!} />}
      {wardrobe && selection && selectedItem && <ItemColorPanel key={selection.id} item={selectedItem} colors={selection.colors} busy={busy} onChange={colors => setSelection({...selection,colors})} onSave={() => void saveColors()} onCancel={() => setSelection(null)} />}
      {!wardrobe && trying && draftPerson && <TryOnPane item={trying.item} person={draftPerson} colors={trying.colors} busy={busy}
        canBuy={itemState(trying.item, data.shop, data.world).state === 'buyable'}
        reasons={itemState(trying.item, data.shop, data.world).reasons.join('. ')}
        onColors={colors => setTrying({...trying, colors})} onBuy={() => void change(trying.item, 'buy')} onDone={doneTrying} />}
      <div className="shop-intro"><p>{wardrobe ? 'Your collection. One item per slot.' : 'Small rewards for showing up.'}</p><span className="balance"><CurrencyIcon currency="coins" /><strong data-testid="shop-balance">{data.shop.balance}</strong> coins</span></div>
      {!wardrobe && <div className="farm-tabs" role="tablist" aria-label="Shop departments"><button role="tab" aria-selected={section==='general'} onClick={()=>setSection('general')}>Village Shop</button><button role="tab" aria-selected={section==='farm'} onClick={()=>setSection('farm')}>Farm Store</button></div>}
      {section==='farm' && <div className="farm-intro"><h3>Farm Store</h3><p>Up to six animals graze beside your house. Dogs and cats follow villagers; farm animals stay in their paddocks.</p><p>Unlocks with the Pet Shelter at village level 4 (<CurrencyAmount amount={2500} currency="XP" /> collective). A house paddock costs <CurrencyAmount amount={80} currency="coins" />.</p></div>}
      {paddockOffer && <section role="region" aria-label="Paddock offer" className="farm-offer"><h3>Add a paddock to your house (<CurrencyAmount amount={80} currency="coins" />)</h3><p>{paddockOffer.name} needs a fenced side yard. Paddock + animal: <CurrencyAmount amount={80+paddockOffer.price_coins} currency="coins" />.</p><button className="button" disabled={busy || data.shop.balance < 80+paddockOffer.price_coins} onClick={()=>void change(paddockOffer,'buy',true)}>Add paddock and buy {paddockOffer.name}</button><button className="button secondary" disabled={busy} onClick={()=>setPaddockOffer(null)}>Cancel</button></section>}
      <details className="voice-style-picker" hidden={section==='farm'}><summary>Voice styles</summary><label htmlFor="talking-style">Talking style</label><select id="talking-style" disabled={busy} value={styles.find(i => equipped.includes(i.id))?.id ?? ''} onChange={e => { const item = styles.find(i => i.id === (e.target.value || equipped.find(id => styles.some(i => i.id === id)))); if (item) void change(item, e.target.value ? 'equip' : 'unequip'); }}><option value="">Natural voice</option>{styles.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><p className="help-text">&ldquo;How did your goal go today? The village wants an update.&rdquo;</p><button className="button secondary" disabled={busy} onClick={() => void previewVoice()}>Preview sample line</button><small>AI-generated voice &middot; generated only when you click</small>{voiceState && <p role="status">{voiceState}</p>}</details>
      {section==='general' && <div className="farm-tabs" role="tablist" aria-label="Clothing slots" style={{flexWrap:'wrap'}}>{[['all','All'],['bottoms','Bottoms'],['shoes','Shoes'],['face','Glasses']].map(([slot,label]) => <button key={slot} role="tab" aria-selected={slotFilter===slot} onClick={() => setSlotFilter(slot)}>{label}</button>)}</div>}
      <div className="shop-grid">{data.shop.items.filter(i => (slotFilter === 'all' || String(i.slot) === slotFilter) && (i.kind !== 'consumable' || i.id === 'revival_potion') && (!wardrobe || itemState(i, data.shop, data.world).state === 'owned') && (wardrobe || (section==='farm') === (i.kind==='farm_animal' || i.kind==='pet' || i.id==='house_paddock'))).map(item => {
        const active = equipped.includes(item.id);
        const gated = !!item.source && item.source !== 'shop';
        const Icon = {farm_animal:PawPrint, house_addon:Home, consumable:Volume2, bottoms:Shirt, shoes:Footprints, head:Crown, face:Glasses, torso:Shirt, neck:Ribbon, pet:PawPrint, house:Home, voice_style:Volume2, decoration:Flower2}[item.slot];
        const state = itemState(item, data.shop, data.world);
        const owned = state.state === 'owned';
        const explanation = state.reasons.join('. ') || (owned ? 'Already in your collection' : `Buy for ${item.price_coins} coins`);
        const needsPaddock = item.kind==='farm_animal' && !data.shop.items.find(i=>i.id==='house_paddock')?.owned;
        const farmFull = item.kind==='farm_animal' && data.shop.items.filter(i=>i.kind==='farm_animal' && i.owned).length>=6;
        const canOfferPaddock = needsPaddock && !owned && !farmFull && state.requirements.length === 1 && state.prerequisites.includes('house_paddock') && data.shop.balance >= item.price_coins + 80;
        return <article ref={el => { if (el) cards.current.set(item.id, el); else cards.current.delete(item.id); }} tabIndex={-1} className={`shop-item ${owned ? 'owned' : ''} ${focused === item.id ? 'focused' : ''}`} key={item.id} data-item-id={item.id}>
          <div className={`item-art ${item.kind} ${gated && !owned ? 'locked-art' : ''}`} aria-hidden="true"><ItemThumbnail id={item.id} assetKey={item.asset_key} rarity={item.rarity} fallback={<Icon size={32} strokeWidth={1.4} />} /></div>
          <h3>{onShopItem ? <button className="text-button" onClick={() => onShopItem(item.id)}>{item.name}</button> : item.name}</h3><p className="item-slot">{item.slot.replaceAll('_', ' ')}{item.away ? ' · Away - revive or repair' : active ? ' · Equipped' : owned ? ' · Owned' : gated ? ' · Locked reward' : ''}</p>
          <span className={`shop-state ${state.state}`} title={explanation} tabIndex={0} aria-label={`${state.state}: ${explanation}`}>{owned ? 'Owned' : state.state === 'locked' ? 'Locked' : 'Buyable'}</span>
          {!!state.reasons.length && <ul className="shop-reasons">{state.reasons.map(reason => <li key={reason}><CurrencyText text={reason} /></li>)}</ul>}
          {state.prerequisites.map(id => { const required = data.shop.items.find(i => i.id === id); return required && <button key={id} className="text-button requirement-link" onClick={() => focusCard(id)}>View {required.name}</button>; })}
          {gated && <p className="help-text">{sourceLabel(item.source ?? undefined)}<br/><strong>How to earn:</strong> {item.description}</p>}
          {farmFull && !owned && <p className="help-text">Your paddock is full (6 animals)</p>}
          {!wardrobe && !gated && <button className="button secondary" title={explanation} aria-label={`Buy ${item.name}`} disabled={(!canOfferPaddock && state.state !== 'buyable') || farmFull || busy} onClick={() => canOfferPaddock ? setPaddockOffer(item) : void change(item, 'buy')}>{owned ? 'Owned' : state.state === 'locked' ? 'Locked' : <CurrencyAmount amount={item.price_coins} currency="coins" />}</button>}
          {!wardrobe && canTryOn(item) && <button data-try-on className="button secondary" disabled={busy} aria-label={`Try on ${item.name}`} onClick={() => setTrying({item})}>{"\u{1F441}"} Try on</button>}
          {owned && item.kind !== 'consumable' && !item.away && item.id !== 'house_paddock' && <button className="button secondary" aria-label={`${active ? 'Unequip' : 'Equip'} ${item.name}`} disabled={busy || (!active && !!state.requirements.length)} onClick={() => void change(item, active ? 'unequip' : 'equip')}>{active ? 'Unequip' : 'Equip'}</button>}

          {wardrobe && item.owned && item.kind === 'clothing' && <button className="button secondary" disabled={busy} aria-label={`Colors for ${item.name}`} onClick={() => setSelection({id:item.id,colors:item.colors?.primary ? {...item.colors, primary:item.colors.primary} : colorPresets[0].colors})}>Choose colors</button>}
        </article>;
      })}</div>
    </>}
  </div>;
}
