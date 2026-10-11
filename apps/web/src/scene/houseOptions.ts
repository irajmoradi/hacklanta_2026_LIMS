import registry from '../../../../packages/catalog/house-options.json' with { type: 'json' };
export const HOUSE_VARIANTS = registry.variants;
export const MATERIAL_CHOICES = registry.materials;
export type HouseVariant = string;
export type HouseMaterials = Partial<Record<keyof typeof MATERIAL_CHOICES, keyof typeof import('../../../../assets/materials/library.json')>>;
export type HouseOptions = { house_variant?: Record<string, HouseVariant> | null; house_materials?: HouseMaterials | null };
export function cleanHouseOptions(value: unknown): {house_variant?: Record<string, string>; house_materials?: HouseMaterials} {
  if (!value || typeof value !== 'object') return {};
  const input = value as HouseOptions;
  const variants: NonNullable<HouseOptions['house_variant']> = {};
  for (const level of [1,2,3,4,5] as const) {
    const choice = input.house_variant?.[level];
    if (typeof choice === 'string' && (HOUSE_VARIANTS[level] as readonly string[]).includes(choice)) variants[level] = choice;
  }
  const materials: Record<string, string> = {};
  for (const part of Object.keys(MATERIAL_CHOICES) as (keyof HouseMaterials)[]) {
    const choice = input.house_materials?.[part];
    if (typeof choice === 'string' && (MATERIAL_CHOICES[part] as readonly string[]).includes(choice)) materials[part] = choice;
  }
  return {house_variant: variants, house_materials: materials as HouseMaterials};
}
