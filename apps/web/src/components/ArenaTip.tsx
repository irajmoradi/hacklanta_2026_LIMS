import { useId, useState } from 'react';

/** Focus, hover, or tap to read supporting details without filling the card. */
export function ArenaTip({ text, label = 'More information' }: { text: string; label?: string }) {
  const id = useId();
  const [dismissed, setDismissed] = useState(false);
  return <span className="arena-tip" data-dismissed={dismissed} onMouseEnter={() => setDismissed(false)}><button type="button" aria-label={label} aria-describedby={id} onFocus={() => setDismissed(false)} onClick={() => setDismissed(false)} onKeyDown={e => {if (e.key === 'Escape') {e.stopPropagation(); setDismissed(true);}}}>?</button><span id={id} role="tooltip">{text}</span></span>;
}
