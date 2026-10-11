import { afterEach, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ItemThumbnail, ThumbnailImage } from './ItemThumbnail';
import { readFileSync } from 'node:fs';
import catalog from '../../../../packages/catalog/catalog.json';

const window = new Window();
Object.assign(window, { SyntaxError });
Object.assign(globalThis, { window, document: window.document, navigator: window.navigator, IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;

test('every priced catalog entry has a transparent 512px PNG thumbnail', () => {
  const priced = catalog.entries.filter(entry => (entry.price_coins ?? 0) > 0);
  expect(priced.length).toBeGreaterThan(0);
  for (const entry of priced) {
    const png = readFileSync(new URL(`../../public/thumbs/${entry.id}.png`, import.meta.url));
    expect(png.subarray(0, 8).toString('hex'), entry.id).toBe('89504e470d0a1a0a');
    expect(png.readUInt32BE(16), entry.id).toBe(512);
    expect(png.readUInt32BE(20), entry.id).toBe(512);
    expect(png[25], entry.id).toBe(6); // PNG RGBA color type
  }
});
afterEach(async () => { await act(async () => root?.unmount()); root = undefined; document.body.replaceChildren(); });

test('successful thumbnail avoids mounting live fallback; failure mounts it and a new URL retries', async () => {
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  let mounts = 0;
  function Fallback() { mounts++; return <span data-live-model="true">Live model</span>; }
  const render = async (src: string) => { await act(async () => root!.render(<ThumbnailImage src={src} fallback={<Fallback />} />)); };
  await render('/thumbs/hat_cap.png');
  expect(host.querySelector('img')?.getAttribute('src')).toBe('/thumbs/hat_cap.png');
  expect(mounts).toBe(0);
  await act(async () => { host.querySelector('img')!.dispatchEvent(new window.Event('error') as unknown as Event); });
  expect(host.querySelector('img')).toBeNull(); expect(host.querySelector('[data-live-model]')).not.toBeNull();
  await render('/thumbs/pet_dog.png');
  expect(host.querySelector('img')?.getAttribute('src')).toBe('/thumbs/pet_dog.png');
  expect(host.querySelector('[data-live-model]')).toBeNull();
});


test('new outfits and farm animals request their item-specific art and safely fall back to icons', async () => {
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  for (const id of ['outfit_hoodie', 'goat_kid', 'goat_kid_friend', 'duckling', 'calf', 'chicken', 'house_paddock', 'revival_potion']) {
    await act(async () => root!.render(<ItemThumbnail id={id} fallback={<span>Item icon</span>} />));
    expect(host.querySelector('img')?.getAttribute('src')).toBe(`/thumbs/${id}.png`);
    expect(host.querySelector('canvas')).toBeNull();
    await act(async () => { host.querySelector('img')!.dispatchEvent(new window.Event('error') as unknown as Event); });
    expect(host.textContent).toBe('Item icon');
    expect(host.querySelector('canvas')).toBeNull();
  }
});
