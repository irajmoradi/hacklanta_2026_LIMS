import {describe, expect, test} from 'bun:test';
import {change, historyOf, step} from './houseHistory';
describe('house edit history', () => {
  test('undo and redo compound snapshots without losing materials or colors', () => {
    const original = {style: 'cottage', colors: {wall:'#ffffff'}, materials: {wall:'wood'}};
    let h = historyOf(original);
    h = change(h, {...h.present, style:'modern'});
    h = change(h, {...h.present, colors:{wall:'#000000'}});
    expect(h.past).toHaveLength(2);
    expect(step(h).present.colors).toEqual(original.colors);
    expect(step(step(h)).present).toEqual(original);
    expect(step(step(h), true)).toEqual(h);
    expect(historyOf(h.present).past).toHaveLength(0);
  });
  test('new edits branch after undo; same-value picks do not add history', () => {
    const h = change(change(historyOf(0), 1), 2);
    const branch = change(step(h), 3);
    expect(branch.future).toEqual([]);
    expect(branch.past).toEqual([0,1]);
    expect(change(branch, 3)).toBe(branch);
    expect(step(historyOf(0))).toEqual(historyOf(0));
  });
});
