import { test, expect } from 'bun:test';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { generateKeyPairSigner } from '@solana/kit';
import { ClientProvider, useJoinPot, usePot } from '../src/react';
import { walletFixture } from './helpers/wallet-fixture';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test('React provider hooks fetch state, surface simulation, and sign only on explicit action', async () => {
  const f = await walletFixture([0]);
  let join!: ReturnType<typeof useJoinPot>;
  let pot!: ReturnType<typeof usePot>;
  function Harness() { join = useJoinPot(f.pot); pot = usePot(f.pot); return null; }
  let renderer!: ReactTestRenderer;
  try {
    await act(async () => { renderer = create(createElement(ClientProvider, { client: f.client }, createElement(Harness))); });
    // Wait for the local HTTP fetch without arbitrary sleeps.
    await act(async () => { await f.client.fetchPot(f.pot); });
    expect(pot.data?.data.entryLamports).toBe(100n);
    expect(pot.error).toBeUndefined();
    await expect(join.sign({ approved: true })).rejects.toThrow('Simulate');
    await act(async () => { await join.simulate(); });
    expect(join.review?.version).toBe(0);
    expect(join.review?.simulation.value.err).toBeNull();
    expect(f.signedCount()).toBe(0);
    await act(async () => { await join.sign({ approved: true }); });
    expect(f.signedCount()).toBe(1);
    expect(join.pending).toBe(false);
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    f.stop();
  }
});

test('changing the pot clears the previous simulation and prevents stale approval', async () => {
  const f = await walletFixture();
  let join!: ReturnType<typeof useJoinPot>;
  function Harness({ address }: { address: typeof f.pot }) { join = useJoinPot(address); return null; }
  const tree = (address: typeof f.pot) => createElement(ClientProvider, { client: f.client }, createElement(Harness, { address }));
  let renderer!: ReactTestRenderer;
  try {
    await act(async () => { renderer = create(tree(f.pot)); });
    await act(async () => { await join.simulate(); });
    const other = await generateKeyPairSigner();
    await act(async () => renderer.update(tree(other.address)));
    expect(join.review).toBeNull();
    await expect(join.sign({ approved: true })).rejects.toThrow('Simulate');
    expect(f.signedCount()).toBe(0);
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    f.stop();
  }
});
