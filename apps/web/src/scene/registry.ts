import fallback from './catalog.fallback.json' with { type: 'json' };
import { mergeRegistry, normalizeCatalog, type Entry } from './registryData';
export { available, type Entry, type District } from './registryData';
// Vite resolves this optional relative import at build time; an absent parallel catalog is legal.
const modules = import.meta.glob('../../../../packages/catalog/dist/catalog.ts', { eager: true });
export const registry = mergeRegistry(fallback.entries as Entry[], Object.values(modules).flatMap(normalizeCatalog));
export const entryFor = (id: string) => registry.find(e => e.id === id || modelName(e) === id);
export const modelName = (e: Entry) => (e.asset?.glb ?? e.id).split('/').pop()!.replace(/\.glb$/, '');
export const roleEntry = (role: string) => registry.find(e => e.placement?.role === role)!;
export function homeEntry(level: number, slot: number, equipped: string[]) {
  return registry.find(e => equipped.includes(e.id) && e.placement?.role === 'home')
    ?? registry.find(e => e.placement?.role === 'home' && e.placement.level === Math.max(1, Math.min(5, level)) && !!e.placement.variant === !!(slot % 2))
    ?? registry.find(e => e.placement?.role === 'home')!;
}
