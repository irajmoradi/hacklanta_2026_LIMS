import { useState } from 'react';
import type { ItemColors, ShopItem } from '../api/types';
import { cozyPalette, colorPresets, isHex } from '../scene/itemColors';

export function ItemColorPanel({item, colors, busy, onChange, onSave, onCancel}: {
  item: ShopItem; colors: ItemColors; busy: boolean;
  onChange: (colors: ItemColors) => void; onSave: () => void; onCancel: () => void;
}) {
  const [channel, setChannel] = useState<keyof ItemColors>('primary');
  const [hex, setHex] = useState(colors.primary);
  function choose(next: ItemColors) { onChange(next); setHex(next[channel] ?? next.primary); }
  return <section className="item-color-panel" aria-label={`Colors for ${item.name}`}>
    <div className="editor-scroll"><h3>{item.name} colors</h3><p className="help-text">Try a palette on your villager, then save it to this item.</p>
    <fieldset disabled={busy}><legend>Color channel</legend>
      {(['primary','secondary','accent'] as const).map(key => <button key={key} type="button" className="button secondary" aria-pressed={key === channel} onClick={() => { setChannel(key); setHex(colors[key] ?? colors.primary); }}>{key}</button>)}
    </fieldset>
    <div className="color-swatches" aria-label="Cozy palette">{cozyPalette.map(color => <button key={color} disabled={busy} style={{background:color}} aria-label={`Use ${color}`} aria-pressed={colors[channel] === color} onClick={() => choose({...colors, [channel]:color})} />)}</div>
    <div className="color-presets">{colorPresets.map(preset => <button key={preset.name} disabled={busy} className="button secondary" onClick={() => choose(preset.colors)}>{preset.name}</button>)}</div>
    <label>Custom hex<input aria-label="Custom hex" disabled={busy} value={hex} maxLength={7} spellCheck={false} aria-invalid={!isHex(hex)} onChange={e => { setHex(e.target.value); if (isHex(e.target.value)) onChange({...colors,[channel]:e.target.value.toLowerCase()}); }} /></label>
    {!isHex(hex) && <p className="help-text">Enter # followed by six hex digits.</p>}
    </div><div className="editor-actions"><button className="button" disabled={busy || !isHex(hex)} onClick={onSave}>Save colors</button>
    <button className="button secondary" disabled={busy} onClick={onCancel}>Cancel colors</button></div>
  </section>;
}
