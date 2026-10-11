import type { ItemColors } from '../api/types';

export const cozyPalette = ['#bc6651', '#d58d78', '#e9a9b1', '#b89bb8', '#8876a8', '#557ca7', '#8bb7c5', '#3b9790', '#689b68', '#a8b896', '#d7b86d', '#ffe4a1', '#f1d9ad', '#8a6044', '#465b72', '#384852'];
export const colorPresets: {name: string; colors: ItemColors}[] = [
  {name: 'Terracotta', colors: {primary:'#bc6651', secondary:'#f1d9ad', accent:'#3b9790'}},
  {name: 'Woodland', colors: {primary:'#689b68', secondary:'#d7b86d', accent:'#8a6044'}},
  {name: 'Twilight', colors: {primary:'#557ca7', secondary:'#b89bb8', accent:'#ffe4a1'}},
];
export const isHex = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value);

// Existing authored colors remain intact until the owner chooses a palette.
const legacyChannels: Record<string, keyof ItemColors> = {
  jacket:'primary', shirt:'primary', roof:'primary', wood:'primary', metal:'primary',
  wall:'secondary', trim:'secondary', light:'secondary', blossom:'accent',
};
export function materialColor(name: string, colors?: Partial<ItemColors>, named = true): string | undefined {
  if (!colors) return;
  const channel = ['primary','secondary','accent'].includes(name) ? name as keyof ItemColors : legacyChannels[name];
  // Legacy caps have only an accent material: let the main swatch recolor them.
  const value = colors[!named && name === 'accent' ? 'primary' : channel];
  return value && isHex(value) ? value : undefined;
}
