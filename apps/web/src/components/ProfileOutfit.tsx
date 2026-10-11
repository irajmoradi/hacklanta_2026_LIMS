import { change as editHistory, historyOf, step } from './houseHistory';
import { useHouseLeaveGuard } from './HouseLeaveGuard';
import { CurrencyText } from './Currency';
import { PhotoItems } from './PhotoItems';
import { LockKeyhole, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Equipment, EquippedItem, EquipmentSlot, ShopItem, Villager } from '../api/types';
import { api } from '../api/client';
import { replaceSlot } from '../api/equipment';
import { PreviewEditor } from './TryOnPane';
import { ItemColorPanel } from './ItemColorPanel';
import { colorPresets } from '../scene/itemColors';
import type { ItemColors } from '../api/types';
import { errorText, mediaUrl } from './shared';
import { ShowcasePreview } from './ShowcasePreview';
import { ItemThumbnail } from './ItemThumbnail';
import { itemDetails, leftSlots, rightSlots, slotItems, slotLabels } from './showcaseData';

function PhotoPreview({url}: {url: string}) {
  const [source, setSource] = useState<string | null>(null);
  useEffect(() => {
    let active = true, resolved: string | undefined;
    setSource(null);
    void mediaUrl(url).then(value => { resolved = value; if (active) setSource(value); else if (value.startsWith('blob:')) URL.revokeObjectURL(value); }).catch(() => {});
    return () => { active = false; if (resolved?.startsWith('blob:')) URL.revokeObjectURL(resolved); };
  }, [url]);
  return source ? <img className="outfit-photo" src={source} alt="Custom photo item" onError={() => setSource(null)}/> : <span className="neutral-item" aria-hidden="true"/>;
}

/** Public equipment stays separate from the owner's private collection. */
// scrollIntoView also scrolls overflow:hidden ancestors (the whole app); only scroll the panel's own scroller.
function scrollWithinPanel(el: HTMLElement | null) {
  let box = el?.parentElement ?? null;
  while (box && !(/(auto|scroll)/.test(getComputedStyle(box).overflowY) && box.scrollHeight > box.clientHeight)) box = box.parentElement;
  if (el && box) box.scrollTop += el.getBoundingClientRect().top - box.getBoundingClientRect().top;
}
export function ProfileOutfit({person: sourcePerson, mine, vid, refresh, houseTarget = 0, section = 'outfit', onShopItem, onClose = () => {}}: {onClose?: () => void; person: Villager; mine: boolean; vid: string; refresh: () => Promise<void>; houseTarget?: number; section?: 'outfit' | 'house'; onShopItem: (id: string) => void}) {
  const [acceptedEquipment, setAcceptedEquipment] = useState<Equipment | null>(null);
  const [decorHistory, setDecorHistory] = useState(() => historyOf(sourcePerson.equipped));
  const persisted = useRef(sourcePerson.equipped);
  const basePerson = acceptedEquipment ? {...sourcePerson, ...acceptedEquipment} : sourcePerson;
  const person = section === 'house' && decorHistory.past.length + decorHistory.future.length > 0 ? {...basePerson, equipped:decorHistory.present, equipped_ids:decorHistory.present.map(i=>i.item_id)} : basePerson;
  useEffect(() => {persisted.current = sourcePerson.equipped; setDecorHistory(h => h.past.length || h.future.length ? h : historyOf(sourcePerson.equipped));}, [sourcePerson]);
  useEffect(() => setAcceptedEquipment(null), [sourcePerson]);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [colors, setColors] = useState<ItemColors | null>(null);
  const [collection, setCollection] = useState<ShopItem[]>([]);
  const [photos, setPhotos] = useState<EquippedItem[]>([]);
  const [selected, setSelected] = useState<EquippedItem | null>(null), [hovered, setHovered] = useState<EquippedItem | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const house = useRef<HTMLElement>(null), detail = useRef<HTMLDivElement>(null);
  const [detailHouse, setDetailHouse] = useState(false);
  useEffect(() => {
    let active = true;
    if (mine) {
      void api.shop(vid).then(shop => { if (active) setCollection(shop.items); }).catch(e => { if (active) setError(errorText(e)); });
      void api.photoItems(vid).then(result => { if (active) setPhotos(result.items.map(item => ({...item, item_id:item.id, asset_key:item.glb_url ?? null, acquired_at:item.created_at, custom:true}))); }).catch(e => { if (active) setError(errorText(e)); });
    }
    return () => { active = false; };
  }, [mine, vid, sourcePerson, acceptedEquipment]);
  useEffect(() => { if (houseTarget) scrollWithinPanel(house.current); }, [houseTarget]);
  const owned = (item: EquippedItem) => person.equipped.some(i => i.item_id === item.item_id) || collection.some(i => i.id === item.item_id && i.owned) || photos.some(i => i.item_id === item.item_id);
  const active = selected ? person.equipped_ids.includes(selected.item_id) : false;
  const highlight = hovered ?? selected;
  const open = (item: EquippedItem, isHouse: boolean) => { setDetailHouse(isHouse); setSelected(item); setColors(null); setError(''); if (isHouse) scrollWithinPanel(house.current); };
  useEffect(() => { if (selected) detail.current?.focus({preventScroll:true}); }, [selected, detailHouse, colors === null]);
  async function change() {
    if (!selected || busy || !mine || !owned(selected)) return;
    if (section === 'house') {
      setSelected(null);
      setDecorHistory(h => editHistory(h, active ? person.equipped.filter(i=>i.item_id !== selected.item_id) : replaceSlot(person.equipped, selected)));
      return;
    }
    setBusy(true); setError('');
    try { const result = await api[active ? 'unequip' : 'equip'](vid, selected.item_id); setAcceptedEquipment(result); if (detailHouse) setSelected(null); void refresh().catch(() => setError('Outfit saved; the village could not refresh.')); }
    catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }
  const isHouseItem = (i: EquippedItem) => ['house','decoration','house_addon','farm_animal'].includes(i.slot);
  async function saveDecor() {
    setBusy(true); setError('');
    try {
      const wanted = decorHistory.present.filter(isHouseItem);
      for (const item of persisted.current.filter(isHouseItem)) if (!wanted.some(i=>i.item_id === item.item_id)) {
        const result = await api.unequip(vid, item.item_id); persisted.current = result.equipped; setAcceptedEquipment(result);
      }
      for (const item of wanted) if (!persisted.current.some(i=>i.item_id === item.item_id)) {
        const result = await api.equip(vid, item.item_id); persisted.current = result.equipped; setAcceptedEquipment(result);
      }
      setDecorHistory(historyOf(persisted.current));
      void refresh().catch(() => setError('Decor saved; the village could not refresh.'));
      return true;
    } catch (e) {setError(errorText(e)); return false;} finally {setBusy(false);}
  }
  function discardDecor() {setDecorHistory(historyOf(persisted.current)); return true;}
  const decorGuard = useHouseLeaveGuard({scope:house, dirty:section === 'house' && !!decorHistory.past.length, busy:section === 'house' && busy, save:saveDecor, discard:discardDecor, escape:() => {if (selected && detailHouse) setSelected(null); else onClose();}, cancelOnEscape:!!selected && detailHouse});
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!house.current?.contains(e.target as Node) || section !== 'house' || busy || !decorHistory.past.length && !decorHistory.future.length || document.querySelector('.house-leave-dialog') || document.querySelector('.interior-dialog') || (e.target as HTMLElement).closest('input,textarea,select,[contenteditable=true]')) return;
      if ((e.ctrlKey || e.metaKey) && ['z','y'].includes(e.key.toLowerCase())) {e.preventDefault(); setDecorHistory(h=>step(h,e.shiftKey || e.key.toLowerCase()==='y'));}
    };
    window.addEventListener('keydown',key,true); return()=>window.removeEventListener('keydown',key,true);
  });
  const tile = (item: EquippedItem, isHouse = false, locked = false) => {
    const meta = itemDetails(item);
    return <button type="button" key={item.item_id} className={`showcase-tile ${selected?.item_id === item.item_id ? 'selected' : ''} ${locked ? 'locked' : ''}`} data-item-id={item.item_id} data-rarity={meta.rarity}
      aria-label={`${meta.name}${locked ? ' · How to earn' : ''}`} aria-pressed={selected?.item_id === item.item_id}
      onMouseEnter={() => setHovered(item)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(item)} onBlur={() => setHovered(null)} onClick={() => open(item, isHouse)}>
      {item.preview ? <PhotoPreview url={item.preview}/> : item.custom ? <span className="neutral-item" aria-hidden="true"/> : <ItemThumbnail staticFallback id={item.item_id} assetKey={item.asset_key} rarity={meta.rarity} fallback={<span className="neutral-item" aria-hidden="true"/>} />}
      <span><strong>{meta.name}</strong><small>{locked ? 'How to earn' : person.equipped_ids.includes(item.item_id) ? 'Equipped' : 'Owned'}</small></span>{locked && <LockKeyhole size={12}/>}
    </button>;
  };
  const slots = (list: EquipmentSlot[]) => <div className="showcase-slots">{list.map(slot => <div className="showcase-slot" key={slot}><span className="slot-caption">{slotLabels[slot]}</span>{slotItems(person.equipped,slot).map(i => tile(i, slot === 'house' || slot === 'decoration'))}{!slotItems(person.equipped,slot).length && <div className="empty-slot">{slot === 'voice_style' ? 'Natural voice' : 'Empty slot'}</div>}</div>)}</div>;
  const card = (isHouse: boolean) => selected && detailHouse === isHouse && <div className="showcase-detail" ref={detail} tabIndex={-1} role="region" aria-label="Item details" data-rarity={itemDetails(selected).rarity}>
    <button className="icon-button detail-close" aria-label="Close item details" onClick={() => setSelected(null)}><X size={16}/></button>
    <span className="eyebrow">{itemDetails(selected).rarity} · {slotLabels[selected.slot]}</span>
    <h4>{itemDetails(selected).name}</h4><p>{itemDetails(selected).description}</p>
    <p className="item-source"><CurrencyText text={itemDetails(selected).source} /></p>
    {selected.acquired_at && <p>Acquired {new Date(selected.acquired_at).toLocaleDateString()}</p>}
    {!owned(selected) && !selected.custom && <p><strong>How to earn:</strong> {itemDetails(selected).description}</p>}
    {!selected.custom && <button className="button secondary" onClick={() => onShopItem(selected.item_id)}>View {itemDetails(selected).name} in shop</button>}
    {selected.slot === 'voice_style' && <p>Voice style is heard when this villager speaks.</p>}
    {!isHouse && mine && owned(selected) && selected.item_id !== 'house_paddock' && <button className="button secondary" disabled={busy} onClick={() => void change()}>{busy ? 'Updating…' : detailHouse ? (active ? 'Remove' : 'Save') : active ? 'Unequip' : 'Equip'} {itemDetails(selected).name}</button>}
    {mine && owned(selected) && collection.find(i => i.id === selected.item_id)?.kind === 'clothing' && <button className="button secondary" onClick={() => {const saved = collection.find(i => i.id === selected.item_id)?.colors ?? person.equipped.find(i => i.item_id === selected.item_id)?.colors; setColors(saved?.primary ? {...saved,primary:saved.primary} : colorPresets[0].colors);}}>Choose colors</button>}

    {error && <p role="alert">{error}</p>}
  </div>;
  const equippable = <T extends {slot: EquipmentSlot | 'consumable'}>(item: T): item is T & {slot: EquipmentSlot} => item.slot !== 'consumable';

  const houseItems = person.equipped.filter(i => ['house', 'decoration', 'house_addon', 'farm_animal'].includes(i.slot));
  if (selected && detailHouse && section === 'house') return <PreviewEditor scope={house} title={`Preview ${itemDetails(selected).name}`} onCancel={() => {if (!busy) setSelected(null);}}
    preview={<ShowcasePreview editor house person={!active && owned(selected) ? {...person, equipped:replaceSlot(person.equipped,selected), equipped_ids:[...person.equipped_ids,selected.item_id]} : person} selected={selected.item_id} />}>
    {decorGuard.prompt}<div className="editor-scroll">{card(true)}<p>Apply this item to your house draft, then Save decor to keep it.</p></div><div className="editor-actions">
      {mine && owned(selected) && selected.item_id !== 'house_paddock' && <button className="button" disabled={busy} onClick={() => void change()}>{active ? 'Remove house item' : 'Save house item'}</button>}
      <button className="button secondary" disabled={busy} onClick={() => setSelected(null)}>Cancel house item</button>
    </div>
  </PreviewEditor>;
  if (colors && selected && collection.find(i => i.id === selected.item_id)) return <PreviewEditor title={`Colors for ${itemDetails(selected).name}`} onCancel={() => {if (!busy) setColors(null);}}
    preview={<ShowcasePreview editor person={{...person, equipped:replaceSlot(person.equipped, {...selected,colors})}} selected={selected.item_id} />}>
    <ItemColorPanel item={collection.find(i => i.id === selected.item_id)!} colors={colors} busy={busy} onChange={setColors} onCancel={() => setColors(null)} onSave={() => {setBusy(true); setError(''); void api.itemColors(vid, selected.item_id, colors).then(() => { setCollection(items => items.map(item => item.id === selected.item_id ? {...item,colors} : item)); setAcceptedEquipment({...person, equipped:person.equipped.map(item => item.item_id === selected.item_id ? {...item,colors} : item)}); setColors(null); void refresh().catch(() => setError('Colors saved; the village could not refresh.')); }).catch(e => setError(errorText(e))).finally(() => setBusy(false));}} />
    {error && <p role="alert">{error}</p>}
  </PreviewEditor>;
  return <div className="profile-showcases">
    {section === 'outfit' && <section className="profile-section profile-outfit" aria-label="Villager showcase">
      <div className="showcase-heading"><span className="eyebrow">THE COLLECTION</span><h3>Villager showcase</h3><p>Your equipped rewards are on display.</p></div>
      <div className="showcase-layout">{slots(leftSlots)}<ShowcasePreview person={colors && selected ? {...person, equipped:replaceSlot(person.equipped, {...selected,colors})} : person} selected={highlight?.item_id ?? null}/>{slots(rightSlots.filter(s => !['house', 'decoration'].includes(s)))}</div>
      {card(false)}
      {mine && <section className="showcase-collection" aria-label="Owned items"><h3>Owned items</h3><div className="showcase-collection-grid">{collection.filter(equippable).filter(i => i.owned && !['house', 'decoration', 'house_addon', 'farm_animal'].includes(i.slot)).map(i => tile({...i,item_id:i.id}))}{photos.filter(i => i.slot !== 'decoration').map(i => tile(i))}</div><button className="text-button" aria-expanded={photoOpen} onClick={() => setPhotoOpen(v => !v)}>Create a photo item</button>{photoOpen && <PhotoItems vid={vid} refresh={refresh}/>}</section>}
      {!person.equipped.some(i => i.custom) && <p className="help-text">No custom photo items equipped.</p>}
      {error && !selected && <p role="alert">{error}</p>}
    </section>}
    {section === 'house' && <section ref={house} className="profile-section house-showcase" aria-label="House showcase">
      {decorGuard.prompt}
      {mine && <div className="house-history-actions" aria-label="Decor change history">
        <span aria-live="polite">{decorHistory.past.length ? `Unsaved changes (${decorHistory.past.length})` : 'No unsaved changes'}</span>
        <button disabled={busy || !decorHistory.past.length} onClick={()=>setDecorHistory(h=>step(h))} aria-keyshortcuts="Control+z Meta+z" title="Undo (Ctrl/Cmd+Z)">Undo</button>
        <button disabled={busy || !decorHistory.future.length} onClick={()=>setDecorHistory(h=>step(h,true))} aria-keyshortcuts="Control+Shift+z Meta+Shift+z Control+y" title="Redo (Ctrl/Cmd+Shift+Z or Ctrl+Y)">Redo</button>
        <button disabled={busy || !decorHistory.past.length} onClick={discardDecor}>Discard all</button>
        <button disabled={busy || !decorHistory.past.length} onClick={()=>void saveDecor()}>Save decor</button>
      </div>}
      <div className="showcase-heading"><span className="eyebrow">A PLACE TO CALL YOUR OWN</span><h3>House showcase</h3><p>Level {person.house_level} · {person.display_name}’s home</p></div>
      <div className="showcase-layout house-layout">
        <div className="showcase-slots">{houseItems.filter((_,i) => i % 2 === 0).map(i => tile(i,true))}</div>
        <ShowcasePreview person={person} house selected={highlight?.item_id ?? null}/>
        <div className="showcase-slots">{houseItems.filter((_,i) => i % 2 === 1).map(i => tile(i,true))}</div>
      </div>
      {!person.equipped.some(i => i.slot === 'decoration') && <p className="help-text">No decorations placed yet.</p>}
      {card(true)}
      {mine && <section className="showcase-collection" aria-label="Owned house items"><h3>Owned house items</h3><div className="showcase-collection-grid">{collection.filter(equippable).filter(i => i.owned && ['house', 'decoration', 'house_addon', 'farm_animal'].includes(i.slot)).map(i => tile({...i,item_id:i.id},true))}{photos.filter(i => i.slot === 'decoration').map(i => tile(i,true))}</div></section>}
    </section>}
  </div>;
}
