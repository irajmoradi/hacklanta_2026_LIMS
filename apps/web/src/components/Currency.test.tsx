import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { CurrencyAmount, CurrencyText, Reward, formatCurrency } from './Currency';

test('currency formatting preserves one lamport and groups whole coins / XP', () => {
  expect(formatCurrency(0.000000001, 'SOL')).toBe('0.000000001 SOL');
  expect(formatCurrency(1200, 'coins')).toBe('1,200 coins');
  expect(formatCurrency(2500, 'XP')).toBe('2,500 XP');
});
test('amounts have decorative SVGs and readable labels; SOL is explicitly test currency', () => {
  for (const currency of ['coins', 'XP', 'SOL'] as const) {
    const html = renderToStaticMarkup(<CurrencyAmount amount={25} currency={currency} />);
    expect(html).toContain(`data-currency="${currency}"`);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain(`25 ${currency}`);
    if (currency === 'SOL') expect(html).toContain('devnet · test');
  }
  expect(renderToStaticMarkup(<Reward amount={25} />)).toContain('25 coins');
  const text = renderToStaticMarkup(<CurrencyText text="Shop · 30 coins, reward 20 XP" />);
  expect(text.match(/<svg /g)).toHaveLength(2);
});
