import {expect, test} from 'bun:test';
import {locationFraming} from './locationFraming';

test('close-ups magnify a lot on desktop and mobile while reserving the people card', () => {
  for (const width of [390, 1280]) {
    const {zoom, right, up} = locationFraming(width, 844);
    const oldZoom = Math.min(width / (width < 600 ? 13 : 19), 844 / 14);
    expect(zoom / oldZoom).toBeGreaterThan(1.6);
    expect(width / zoom).toBeLessThan(width < 600 ? 8 : 13);
    expect(width < 600 ? up < 0 && right === 0 : right > 0 && up === 0).toBe(true);
  }
  expect(locationFraming(3840, 2160).zoom).toBeLessThanOrEqual(140);
});
