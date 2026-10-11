import { useEffect, useState } from 'react';

/** Announce the complete line once; the animated copy is decorative. */
export function MayorSceneSpeech({ text }: { text: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setCount(text.length); return; }
    setCount(0);
    const start = performance.now();
    const timer = setInterval(() => {
      const next = Math.min(text.length, Math.ceil((performance.now() - start) / 12));
      setCount(next);
      if (next === text.length) clearInterval(timer);
    }, 32);
    return () => clearInterval(timer);
  }, [text]);
  return <div className="scene-speech" role="group" aria-label={text}><span aria-hidden="true">{text.slice(0, count)}<i className="speech-caret"/></span><span className="sr-only" role="status">{text}</span></div>;
}
