import {expect, test} from 'bun:test';
import {qualityWindow, lowQuality} from './quality';
test('low tier can be selected explicitly or by limited hardware', () => {
  expect(lowQuality(32, '?quality=low')).toBe(true);
  expect(lowQuality(4, '')).toBe(true);
  expect(lowQuality(32, '')).toBe(false);
});
test('warm-up and hidden tabs do not lower quality; sustained slow rendering does', () => {
  const quality = qualityWindow();
  for(let i=0;i<230;i++) expect(quality.sample(1/30)).toBe(false);
  for(let i=0;i<100;i++) expect(quality.sample(1, true)).toBe(false);
  for(let i=0;i<65;i++) quality.sample(1/30);
  expect(quality.reduced).toBe(false);
  for(let i=0;i<10;i++) quality.sample(1/30);
  expect(quality.reduced).toBe(true);
});
test('healthy rendering and an isolated stall keep full quality', () => {
  const quality = qualityWindow();
  for(let i=0;i<900;i++) quality.sample(1/60);
  quality.sample(.15);
  for(let i=0;i<180;i++) quality.sample(1/60);
  expect(quality.reduced).toBe(false);
});
