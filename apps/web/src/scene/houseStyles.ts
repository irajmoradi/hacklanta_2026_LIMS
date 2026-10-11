import palettes from './housePalettes.json' with { type: 'json' };
import type { Villager } from '../api/types';
import type { Entry } from './registryData';
import { cleanHouseOptions, type HouseOptions } from './houseOptions';
import variantBounds from './houseVariantBounds.json' with { type: 'json' };

export const HOUSE_STYLES = ['cottage', 'modern', 'aframe', 'tudor', 'beach', 'townhouse'] as const;
export type HouseStyle = typeof HOUSE_STYLES[number];
export const HOUSE_PALETTES = palettes;
export const HOUSE_PARTS = ['wall', 'roof', 'trim', 'door', 'accent'] as const;
export function validHouseColors(value: unknown): value is import('../api/types').HouseColors {
  return !!value && typeof value === 'object' && Object.keys(value).length === 5 &&
    HOUSE_PARTS.every(part => typeof (value as Record<string, unknown>)[part] === 'string' && /^#[0-9a-f]{6}$/.test((value as Record<string, string>)[part]));
}
export function houseHash(id: string) {
  let hash = 2166136261;
  for (const byte of new TextEncoder().encode(id)) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  return hash;
}
export function selectHouse(person: Pick<Villager, 'user_id' | 'house_level' | 'equipped' | 'equipped_ids' | 'house_style' | 'house_colors'> & HouseOptions) {
  const hash = houseHash(person.user_id);
  const equipped = [...person.equipped.map(i => i.asset_key ?? i.item_id), ...person.equipped_ids]
    .map(id => /^house_(cottage|modern|aframe|tudor|beach|townhouse)(?:_lv[1-3])?$/.exec(id)).find(Boolean);
  // Separate style/palette hash domains; both API and offline seed cohorts get
  // five distinct styles without depending on membership order or house slot.
  const style = (person.house_style ?? equipped?.[1] ?? HOUSE_STYLES[houseHash(`${person.user_id}:style`) % HOUSE_STYLES.length]) as HouseStyle;
  const level = Math.max(1, Math.min(5, Number.isFinite(person.house_level) ? Math.floor(person.house_level) : 1));
  const paletteIndex = Math.floor(hash / HOUSE_STYLES.length) % 3;
  const options = cleanHouseOptions(person);
  const variant = options.house_variant?.[level] ?? 'classic';
  return { style, level, paletteIndex, colors: person.house_colors ?? palettes[style][paletteIndex],
    variant, materials: options.house_materials,
    model: variant !== 'classic' ? `house_${style}_lv${level}_${variant}` : level > 3 ? `house_lv${level}` : `house_${style}_lv${level}` };
}

/** Authored metres, before the shared 2.2x lot scale. Roof upgrades use the
 * front of the left slope, clear of built-in chimneys, vents and rear decks. */
export function houseAttachment(house: ReturnType<typeof selectHouse>, entry: Entry, homeSize = 5.5): {offset: [number,number,number]; rotation: [number,number,number]; size: number} {
  const original = { offset: entry.asset?.attach?.offset ?? [0,0,0] as [number,number,number],
    rotation: entry.asset?.attach?.rotation ?? [0,0,0] as [number,number,number], size: entry.placement?.size ?? 1 };
  if (house.level > 3) {
    if (house.variant !== 'classic') {
      const key = `${house.style}_${house.variant}` as keyof typeof variantBounds;
      const envelope = variantBounds[key];
      if (envelope) {
        const height = house.level === 4 ? 4.75 : 7.6;
        const normalize = homeSize / Math.max(6.6,height);
        const factors = [6.6,height,6.19].map((v,i)=>v/(envelope.max[i]-envelope.min[i])*normalize);
        const native = houseAttachment({...house,level:3},entry);
        return {offset:native.offset.map((v,i)=>(v-(i===1 ? envelope.min[i] : (envelope.min[i]+envelope.max[i])/2))*factors[i]) as [number,number,number],
          rotation:[native.rotation[0],native.rotation[1],Math.atan(Math.tan(native.rotation[2])*factors[1]/factors[0])],size:native.size*Math.min(factors[0],factors[2])};
      }
    }
    // ASSET-006 legacy lv4 is a fitted Tudor lv3; lv5 is a fitted beach lv3.
    // Measured GLB envelopes: native 3.15 x (4.225/4.33) x 3.36,
    // legacy 6.6 x (4.75/7.6) x 6.19. OptionalModel centers and normalizes it.
    const fourth = house.level === 4, height = fourth ? 4.75 : 7.6;
    const normalize = homeSize / Math.max(6.6,height);
    const factors = [6.6/3.15, height/(fourth ? 4.225 : 4.33), 6.19/3.36].map(v=>v*normalize);
    const native = houseAttachment({...house,level:3,style:fourth?'tudor':'beach'},entry);
    return {offset: native.offset.map((v,i)=>v*factors[i]) as [number,number,number],
      rotation: [native.rotation[0],native.rotation[1],Math.atan(Math.tan(native.rotation[2])*factors[1]/factors[0])],
      size: native.size*Math.min(factors[0],factors[2])};
  }
  const {style, level} = house;
  const base = style === 'beach' ? .52 : .22, top = base + 1.5 + (level-1)*.66;
  if (entry.id === 'upgrade_solar_roof') {
    const rise = style === 'aframe' ? top + 1 - .55 : style === 'cottage' || style === 'tudor' ? .9 : .45;
    const slope = style === 'modern' ? 0 : Math.atan(rise / (style === 'aframe' ? 1.6 : 1.575));
    const y = style === 'modern' ? top + .29 : top + (style === 'aframe' ? 1 : rise) - .7*Math.tan(slope) + .12;
    return {offset: [-.7,y,.55] as [number,number,number], rotation: [0,0,slope] as [number,number,number], size: .95};
  }
  const offsets: Record<string, [number,number,number]> = {
    house_backyard: [0,0,house.variant === 'greenhouse' ? -2.8 : -2.05], upgrade_porch: [0,base,house.variant === 'porch' || house.variant === 'balcony' ? 2.15 : 1.65],
    upgrade_garden_gnome: [-1.65,0,1.8], upgrade_neon_sign: [0,base+.8,1.08],
  };
  return offsets[entry.id] ? {...original, offset: offsets[entry.id], size: entry.id === 'house_backyard' ? 1.15 : entry.id === 'upgrade_porch' ? 1.35 : entry.id === 'upgrade_neon_sign' ? .6 : .35} : original;
}
