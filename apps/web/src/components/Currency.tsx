import { Fragment, useId } from 'react';

export type Currency = 'coins' | 'SOL' | 'XP';
export function formatCurrency(amount: number, currency: Currency) {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: currency === 'SOL' ? 9 : 0 }).format(amount)} ${currency}`;
}

export function CurrencyIcon({ currency }: { currency: Currency }) {
  const gradient = useId();
  return <svg className="currency-icon" data-currency={currency} width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    {currency === 'coins' ? <>
      <ellipse cx="14" cy="12" rx="7" ry="10" fill="#a86512" />
      <path d="M11 2h3v20h-3" fill="#c78a20" />
      <ellipse cx="11" cy="12" rx="7" ry="10" fill="#f6cc50" stroke="#b87b16" />
      <ellipse cx="11" cy="12" rx="4.8" ry="7.7" fill="#edb736" stroke="#ffe88a" />
      <path d="M12.6 7.5c-4-1-4.3 3.3-.8 4.3 3.5 1 .9 5-2 3.5M11 5.5v13" fill="none" stroke="#fff0a5" strokeWidth="1.2" />
    </> : currency === 'XP' ? <>
      <path d="M12 1 2 11l10 12 10-12Z" fill="#168c55" />
      <path d="m12 1-10 10 10 3Z" fill="#8aefaa" />
      <path d="m12 1 10 10-10 3Z" fill="#35c97b" />
      <path d="m2 11 10 12V14Z" fill="#20975c" />
      <path d="m22 11-10 12V14Z" fill="#0b6742" />
    </> : <>
      <defs><linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#9945ff" /><stop offset="1" stopColor="#14f195" /></linearGradient></defs>
      <path d="m6 3-4 4h16l4-4ZM2 10l4 4h16l-4-4Zm4 7-4 4h16l4-4Z" fill={`url(#${gradient})`} />
    </>}
  </svg>;
}

export function CurrencyAmount({ amount, currency, signed = false }: { amount: number; currency: Currency; signed?: boolean }) {
  return <span className="currency-amount"><CurrencyIcon currency={currency} />{signed && amount > 0 ? '+' : ''}{formatCurrency(amount, currency)}{currency === 'SOL' && <> <small className="devnet-tag">devnet · test</small></>}</span>;
}

export function Reward({ amount }: { amount: number }) {
  return <span className="currency-reward"><CurrencyAmount amount={amount} currency="XP" signed /> <CurrencyAmount amount={amount} currency="coins" signed /></span>;
}

/** Add the same icons to descriptive amounts without changing surrounding copy. */
export function CurrencyText({ text }: { text: string }) {
  return <>{text.split(/([+−-]?[\d,]+(?:\.\d+)?(?:–[\d,]+)? (?:XP|coins|SOL))/g).map((part, i) => {
    const currency = / (XP|coins|SOL)$/.exec(part)?.[1] as Currency | undefined;
    return <Fragment key={i}>{currency ? <span className="currency-amount"><CurrencyIcon currency={currency} />{part}{currency === 'SOL' && <> <small className="devnet-tag">devnet · test</small></>}</span> : part}</Fragment>;
  })}</>;
}
