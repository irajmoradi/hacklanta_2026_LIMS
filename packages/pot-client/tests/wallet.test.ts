import { test, expect } from 'bun:test';
import { lamports } from '@solana/kit';
import { prepareIntent, sendIntent, prepareJoin, selectTransactionVersion } from '../src/wallet';
import { walletFixture as fixture } from './helpers/wallet-fixture';

test('version choice prefers v1, falls back to v0, rejects legacy-only', () => {
  expect(selectTransactionVersion(new Set([0, 1]))).toBe(1);
  expect(selectTransactionVersion(new Set([0]))).toBe(0);
  expect(() => selectTransactionVersion(new Set(['legacy']))).toThrow();
});

for (const version of [0, 1] as const) test(`v${version}: simulate, expose review, approve signature; never send`, async () => {
  const f = await fixture([version]);
  try {
    const prepared = await prepareJoin(f.client, f.pot);
    expect(f.signedCount()).toBe(0);
    expect(prepared.review.version).toBe(version);
    expect(prepared.review.entryLamports).toBe(100n);
    expect(prepared.review.feeLamports).toBe(lamports(5000n));
    expect(prepared.review.simulation.value.logs).toEqual(['Program success']);
    expect(f.messages.length).toBe(2);
    expect(f.messages.every(m => m.version === version)).toBe(true);
    const signed = await prepared.sign({ approved: true });
    expect(f.signedCount()).toBe(1);
    expect(Object.values(signed.signatures).some(s => s !== null)).toBe(true);
    expect(f.calls).not.toContain('sendTransaction');
    await expect(prepared.sign({ approved: true })).rejects.toThrow('consumed');
  } finally { f.stop(); }
});

test('failed simulation is surfaced and cannot request a signature even if UI mutates the result', async () => {
  const f = await fixture();
  try {
    f.failSimulation();
    const prepared = await prepareJoin(f.client, f.pot);
    expect(prepared.review.simulation.value.err).not.toBeNull();
    expect(prepared.review.simulation.value.logs).toEqual(['Program failed: JoiningClosed']);
    // Deliberately mutate external data to check the captured gate.
    (prepared.review.simulation.value as { err: unknown }).err = null;
    await expect(prepared.sign({ approved: true })).rejects.toThrow('Successful simulation');
    expect(f.signedCount()).toBe(0);
  } finally { f.stop(); }
});

for (const condition of ['omitFee', 'expire', 'disconnect', 'disconnectDuringHeight'] as const) {
  test(`${condition} prevents wallet signing`, async () => {
    const f = await fixture();
    try {
      if (condition === 'omitFee') f.omitFee();
      const prepared = await prepareJoin(f.client, f.pot);
      if (condition !== 'omitFee') f[condition]();
      await expect(prepared.sign({ approved: true })).rejects.toThrow();
      expect(f.signedCount()).toBe(0);
    } finally { f.stop(); }
  });
}

test('requires explicit approval and rejects non-devnet RPC before simulation', async () => {
  const f = await fixture();
  try {
    const prepared = await prepareJoin(f.client, f.pot);
    await expect(prepared.sign({ approved: false } as never)).rejects.toThrow('approval');
    f.wrongCluster();
    await expect(prepareJoin(f.client, f.pot)).rejects.toThrow('devnet only');
    expect(f.signedCount()).toBe(0);
  } finally { f.stop(); }
});

test('sign-and-send-only wallets are rejected without any RPC or wallet invocation', async () => {
  const f = await fixture();
  try {
    f.sendingOnly();
    await expect(prepareJoin(f.client, f.pot)).rejects.toThrow('sign-only');
    expect(f.calls).toEqual([]);
    expect(f.signedCount()).toBe(0);
  } finally { f.stop(); }
});

test('a wallet cannot replace the reviewed message, even through in-place mutation', async () => {
  const f = await fixture();
  try {
    f.modifyingWallet();
    const prepared = await prepareJoin(f.client, f.pot);
    await expect(prepared.sign({ approved: true })).rejects.toThrow('modified');
    expect(f.calls).not.toContain('sendTransaction');
  } finally { f.stop(); }
});

for(const version of [0,1] as const)test(`intent v${version}: simulation precedes signing and receipt persisted before broadcast`,async()=>{
 const f=await fixture([version]);try{
  const wallet=f.client.wallet.getState().connected!.signer!.address;
  const intent={id:'synthetic-intent',wallet,metadata:{xp:100,lamports:'10000000'},instructions:[{program:'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',accounts:[{address:wallet,role:2}],data:btoa('synthetic-intent')}]};
  const prepared=await prepareIntent(f.client,intent);
  expect(f.calls).not.toContain('sendTransaction');expect(f.signedCount()).toBe(0);
  f.allowSend();let saved='';
  const signature=await sendIntent(f.client,prepared,value=>{expect(f.calls).not.toContain('sendTransaction');saved=value;});
  expect(saved).toBe(signature);expect(f.calls).toContain('getSignatureStatuses');expect(f.signedCount()).toBe(1);
  await expect(sendIntent(f.client,prepared,()=>{})).rejects.toThrow('consumed');
 }finally{f.stop();}
});
test('intent failure cannot sign or send',async()=>{
 const f=await fixture();try{
  f.failSimulation();const wallet=f.client.wallet.getState().connected!.signer!.address;
  const prepared=await prepareIntent(f.client,{id:'fail',wallet,metadata:{},instructions:[{program:'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',accounts:[{address:wallet,role:2}],data:btoa('fail')}]});
  await expect(sendIntent(f.client,prepared,()=>{})).rejects.toThrow('Successful simulation');
  expect(f.signedCount()).toBe(0);expect(f.calls).not.toContain('sendTransaction');
 }finally{f.stop();}
});
