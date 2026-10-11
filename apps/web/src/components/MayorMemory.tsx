import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { MayorMemory as Memory } from '../api/gazette';
import type { Village } from '../api/types';
import { errorText } from './shared';

export function MayorMemory({ village }: { village: Village }) {
  const [memory, setMemory] = useState<Memory | null>(null), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true; setMemory(null); setError('');
    void api.mayorMemory(village.id).then(value => { if (active) setMemory(value); }).catch(e => { if (active) setError(errorText(e)); });
    return () => { active = false; };
  }, [village.id, attempt]);
  return <section className="mayor-memory" aria-label="Mayor's memory"><h3>Mayor's memory</h3><p>What the Mayor remembers across weeks.</p>
    {error ? <p role="alert">Memory is unavailable. {error} <button className="text-button" onClick={() => setAttempt(n => n + 1)}>Retry memory</button></p> : !memory ? <p role="status">Opening the memory book…</p> : !memory.entries.length ? <p>No memories yet. Shared moments will fill this book.</p> : memory.entries.map(entry => <article key={entry.id}><strong>{entry.user_id ? village.villagers.find(v => v.user_id === entry.user_id)?.display_name ?? 'Former neighbor' : 'Our village'}</strong><p>{entry.text}</p><time dateTime={entry.updated_at}>Updated {new Date(entry.updated_at).toLocaleString()}</time></article>)}
  </section>;
}
