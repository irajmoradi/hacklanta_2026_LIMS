import { useEffect, useRef, type RefObject, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { ItemColors, ShopItem, Villager } from '../api/types';
import { colorPresets } from '../scene/itemColors';
import { CurrencyAmount } from './Currency';
import { ShowcasePreview } from './ShowcasePreview';
import { previewsHouse } from './tryOn';
import './tryOn.css';

export function TryOnPane({item, person, colors, busy, canBuy, reasons, onColors, onBuy, onDone}: {
  item: ShopItem; person: Villager; colors?: ItemColors; busy: boolean; canBuy: boolean; reasons: string;
  onColors: (colors?: ItemColors) => void; onBuy: () => void; onDone: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); heading.current?.scrollIntoView({block:'nearest'}); }, [item.id]);
  return <section className="try-on-pane" aria-label={`Try on ${item.name}`}>
    <h3 ref={heading} tabIndex={-1}>Try on: {item.name}</h3>
    <p role="status">{person.display_name}{previewsHouse(item) ? "’s house" : ' wearing'} · {item.name}. Nothing changes until you buy.</p>
    <ShowcasePreview person={person} selected={item.id} house={previewsHouse(item)} wardrobe />
    {item.kind === 'clothing' && <div className="try-on-colors" role="group" aria-label="Try colors">
      <button className="button secondary" disabled={busy} aria-pressed={!colors} onClick={() => onColors()}>Original</button>
      {colorPresets.map(preset => <button key={preset.name} className="button secondary" disabled={busy} aria-pressed={colors?.primary === preset.colors.primary} onClick={() => onColors(preset.colors)}><span style={{background:preset.colors.primary}} />{preset.name}</button>)}
    </div>}
    {reasons && <p className="help-text">{reasons}</p>}
    <div className="try-on-actions"><button className="button" disabled={busy || !canBuy} onClick={onBuy}>Buy (<CurrencyAmount amount={item.price_coins} currency="coins" />)</button><button className="button secondary" disabled={busy} onClick={onDone}>Done</button></div>
  </section>;
}

/** One preview and one scrolling control pane, shared by owned-item and house editing. */
export function PreviewEditor({title, preview, children, onCancel, scope}: {
  scope?: RefObject<HTMLElement>; title: string; preview: ReactNode; children: ReactNode; onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    window.dispatchEvent(new CustomEvent('village-interior-visible', {detail:true}));
    return () => {
      dialog.current?.close();
      window.dispatchEvent(new CustomEvent('village-interior-visible', {detail:false}));
      if (trigger?.isConnected) trigger.focus({preventScroll:true});
    };
  }, []);
  return createPortal(<dialog ref={dialog} className="preview-editor" aria-label={title}
    onKeyDown={e => e.stopPropagation()} onCancel={e => {e.preventDefault(); e.stopPropagation(); onCancel();}}>
    <h2>{title}</h2>
    <div ref={scope as RefObject<HTMLDivElement>} className="preview-editor-layout">
      <div className="preview-editor-render">{preview}</div>
      <div className="preview-editor-controls">{children}</div>
    </div>
  </dialog>, document.body);
}
