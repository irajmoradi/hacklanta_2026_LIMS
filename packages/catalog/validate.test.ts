import { expect, test } from 'bun:test';
import source from './catalog.json';
import { validate } from './validate';

test('all shipped models and legacy content validate', async () => {
  expect((await validate(source)).entries.length).toBe(source.entries.length);
});

const cases: [string, (data: any) => void][] = [
  ['zero scatter weight', d => d.entries.find((e: any) => e.id === 'nature_oak').scatter.weight = 0],
  ['unknown scatter surface', d => d.entries.find((e: any) => e.id === 'nature_oak').scatter.surface = 'lava'],
  ['scatter without nature tag', d => d.entries.find((e: any) => e.id === 'nature_oak').tags = []],
  ['unknown variant material', d => d.entries.find((e: any) => e.id === 'nature_oak').asset.variants[0].materials.missing = '#ffffff'],
  ['duplicate variant ids', d => { const a=d.entries.find((e: any) => e.id === 'nature_oak').asset; a.variants[1].id=a.variants[0].id; }],
  ['negative variant scale', d => d.entries.find((e: any) => e.id === 'nature_oak').asset.variants[0].scale = -1],
  ['malformed variant color', d => d.entries.find((e: any) => e.id === 'nature_oak').asset.variants[0].materials.leaf = 'green'],
  ['separate scene progression', d => d.entries.find((e: any) => e.id === 'colosseum').unlock = {village_level: 1}],
  ['separate scene shop', d => d.entries.find((e: any) => e.id === 'colosseum').tags.push('shop')],
  ['duplicate', d => d.entries.push(d.entries[0])],
  ['missing requirement', d => d.entries[0].requires = ['missing']],
  ['cycle', d => d.entries[0].requires = [d.entries[0].id]],
  ['invalid slot', d => d.entries[0].slot = 'pet'],
  ['missing GLB', d => d.entries[0].asset.glb = '/models/missing.glb'],
  ['path traversal', d => d.entries[0].asset.glb = '/models/../secret.glb'],
  ['bad vector', d => d.entries[0].asset.attach.offset = [0, 1]],
  ['bad generated fit offset', d => d.entries[0].fit = {generated: {offset: [0, 1]}}],
  ['zero generated fit scale', d => d.entries[0].fit = {generated: {scale: [1, 0, 1]}}],
  ['unknown generated fit field', d => d.entries[0].fit = {generated: {surprise: 1}}],
  ['ambiguous anchor', d => d.entries[0].asset.attach.anchor = 'ground'],
  ['negative price', d => d.entries[0].price_coins = -1],
  ['bad progression', d => d.levels[1].xp = 0],
  ['missing district', d => d.buildings[0].placement.district = 'missing'],
  ['missing unlock', d => d.levels[1].buildings = []],
  ['invalid source', d => d.entries[0].source = 'free'],
  ['duplicate pack', d => d.event_packs.push(d.event_packs[0])],
  ['missing piece', d => d.event_packs[0].pieces = ['missing']],
  ['non-event piece', d => d.event_packs[0].pieces = ['tree_a']],
  ['non-decoration piece', d => { d.entries[0].tags.push('event_pack'); d.event_packs[0].pieces = [d.entries[0].id]; }],
  ['duplicate piece', d => d.event_packs[0].pieces.push(d.event_packs[0].pieces[0])],
  ['empty pack', d => d.event_packs[0].pieces = []],
  ['invalid weather', d => d.event_packs[0].weather = 'snow'],
  ['unknown pack field', d => d.event_packs[0].surprise = true],
];
for (const [name, mutate] of cases) test(`rejects ${name}`, async () => {
  const data = structuredClone(source); mutate(data);
  await expect(validate(data)).rejects.toThrow();
});

test('a new event pack and meshless piece need only registry data', async () => {
  const data = structuredClone(source);
  data.entries.push({ id: 'test_confetti', kind: 'decoration', slot: 'decoration',
    name: 'Test Confetti', description: 'Procedural confetti', price_coins: 0,
    tags: ['event_pack'], source: 'event:test_reunion', rarity: 'common' } as any);
  data.event_packs.push({ id: 'test_reunion', name: 'Reunion', pieces: ['test_confetti'], mood: 'joyful' } as any);
  expect((await validate(data)).event_packs?.at(-1)?.id).toBe('test_reunion');
});

test('shared house choices resolve to registered variants and material recipes', async () => {
  const options = await Bun.file(new URL('./house-options.json', import.meta.url)).json();
  const recipes = await Bun.file(new URL('../../assets/materials/library.json', import.meta.url)).json();
  for (const [level, choices] of Object.entries(options.variants)) for (const choice of choices as string[]) {
    if (choice === 'classic') continue;
    for (const style of ['cottage','modern','aframe','tudor','beach','townhouse']) {
      const entry = source.entries.find(e => e.id === `house_${style}_lv${level}_${choice}`);
      expect(entry?.kind).toBe('house');
      expect(entry?.asset?.glb).toBe(`/models/house_${style}_lv${level}_${choice}.glb`);
    }
  }
  for (const choices of Object.values(options.materials)) for (const choice of choices as string[]) expect(recipes[choice]).toBeDefined();
});

for (const bad of ['Mayor\u00e2\u20ac\u2122s Medal', 'Mayor\u00c3\u00a2\u00e2\u201a\u00ac Medal', 'Broken\ufffd']) test(`rejects mojibake ${bad}`, async () => {
  const data = structuredClone(source); data.entries[0].name = bad;
  await expect(validate(data)).rejects.toThrow('mojibake');
});
