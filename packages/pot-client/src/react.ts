'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useClient } from '@solana/react';
import { useConnectedWallet } from '@solana/kit-plugin-wallet/react';
import type { Address } from '@solana/kit';
import type { PotClient } from './index';
import { prepareJoin, type PotWalletClient, type PreparedJoin } from './wallet';
export { potWalletClient } from './wallet';
export { ClientProvider } from '@solana/react';

export function usePot(pot: Address | null) {
  const client = useClient<PotClient>();
  const [state, setState] = useState<{
    data?: Awaited<ReturnType<PotClient['fetchPot']>>; error?: unknown; loading: boolean;
  }>({ loading: false });
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(v => v + 1), []);
  useEffect(() => {
    let active = true;
    setState({ loading: pot !== null });
    if (pot) void client.fetchPot(pot).then(
      data => { if (active) setState({ data, loading: false }); },
      error => { if (active) setState({ error, loading: false }); },
    );
    return () => { active = false; };
  }, [client, pot, revision]);
  return { ...state, refresh };
}

export function useJoinPot(pot: Address) {
  const client = useClient<PotWalletClient>();
  const connected = useConnectedWallet(client);
  const epoch = useRef(0);
  const busy = useRef(false);
  const prepared = useRef<{ value: PreparedJoin; client: PotWalletClient; pot: Address; connected: typeof connected } | null>(null);
  const [review, setReview] = useState<PreparedJoin['review'] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>();
  useEffect(() => {
    epoch.current++; prepared.current = null; setReview(null); setError(undefined);
    return () => { epoch.current++; prepared.current = null; };
  }, [client, pot, connected]);
  const simulate = useCallback(async () => {
    if (busy.current) throw new Error('Join action already pending');
    busy.current = true; setPending(true); setError(undefined); setReview(null); prepared.current = null;
    const generation = epoch.current;
    try {
      const next = await prepareJoin(client, pot);
      if (generation !== epoch.current) throw new Error('Wallet or pot changed; simulate again');
      prepared.current = { value: next, client, pot, connected }; setReview(next.review);
      return next.review;
    } catch (e) { setError(e); throw e; }
    finally { busy.current = false; setPending(false); }
  }, [client, pot, connected]);
  const sign = useCallback(async (approval: { approved: true }) => {
    if (busy.current) throw new Error('Join action already pending');
    const next = prepared.current;
    if (!next) throw new Error('Simulate and review first');
    if (next.client !== client || next.pot !== pot || next.connected !== connected) throw new Error('Context changed; simulate again');
    prepared.current = null; busy.current = true; setPending(true); setError(undefined);
    try { return await next.value.sign(approval); }
    catch (e) { setError(e); throw e; }
    finally { busy.current = false; setPending(false); }
  }, [client, pot, connected]);
  return { simulate, sign, review, pending, error };
}
