import { test, expect } from 'bun:test';
import { LiteSVM, FailedTransactionMetadata } from 'litesvm';
import {
  address, lamports, generateKeyPairSigner, createTransactionMessage, setTransactionMessageFeePayerSigner,
  appendTransactionMessageInstruction, signTransactionMessageWithSigners,
  type Instruction, type EncodedAccount,
} from '@solana/kit';
import { fileURLToPath } from 'node:url';
import { potClient, validatePotAccount, getPotDecoder, VILLAGE_POT_PROGRAM_ADDRESS } from '../src';

const client = potClient({ rpcUrl: 'http://127.0.0.1:8899' });
const binary = fileURLToPath(new URL('../.local/programs/target/deploy/village_pot.so', import.meta.url));
const ok = (result: unknown) => {
  if (result instanceof FailedTransactionMetadata) throw new Error(result.meta().logs().join('\n'));
};
async function fixture() {
  const svm = new LiteSVM();
  svm.addProgramFromFile(client.programAddress, binary);
  const [payer, creator, auditor, alice, bob] = await Promise.all(Array.from({ length: 5 }, () => generateKeyPairSigner()));
  for (const signer of [payer, creator, auditor, alice, bob]) ok(svm.airdrop(signer.address, lamports(1_000_000_000n)));
  const [pot] = await client.findPotPda(creator.address, 9n);
  const [vault] = await client.findVaultPda(pot);
  function time(t: bigint) { const clock = svm.getClock(); clock.unixTimestamp = t; svm.setClock(clock); }
  time(1000n);
  async function send(ix: Instruction) {
    svm.expireBlockhash();
    const message = appendTransactionMessageInstruction(ix, svm.setTransactionMessageLifetimeUsingLatestBlockhash(
      setTransactionMessageFeePayerSigner(payer, createTransactionMessage({ version: 0 })),
    ));
    return svm.sendTransaction(await signTransactionMessageWithSigners(message));
  }
  const raw = () => {
    const account = svm.getAccount(pot);
    if (!account.exists) throw new Error('Missing pot');
    return account;
  };
  const state = () => validatePotAccount(raw(), client.programAddress);
  const create = () => client.buildCreatePotIx({ creator, weekId: 9n, entryLamports: 10_000_001n,
    auditor: auditor.address, auditorFeeBps: 1000, deadline: 2000n, payoutMode: 1 }).then(send);
  const join = (participant: typeof alice) => client.buildJoinIx({ pot, participant }).then(send);
  return { svm, payer, creator, auditor, alice, bob, pot, vault, time, send, raw, state, create, join };
}

test('generated instructions: create → join ×2 → settle; decode state, payouts and rent', async () => {
  expect(client.programAddress).toBe(address('4m7xFhBQcWfa7u3kP8i78QaTYjkQXSxt5iUfj2689Ehu'));
  const f = await fixture(); ok(await f.create());
  expect((await f.state()).data.participants).toEqual([]);
  const rent = f.svm.getBalance(f.vault)!;
  ok(await f.join(f.alice)); ok(await f.join(f.bob));
  const state = (await f.state()).data;
  expect(state.participants).toEqual([f.alice.address, f.bob.address]);
  expect(state.weekId).toBe(9n); expect(state.entryLamports).toBe(10_000_001n);
  expect(state.status).toBe(0); expect(state.creator).toBe(f.creator.address);
  const before = [f.alice, f.bob, f.auditor].map(s => f.svm.getBalance(s.address)!);
  f.time(2000n);
  const settle = await client.buildSettleIx({ pot: f.pot, auditor: f.auditor, participants: [f.alice.address, f.bob.address], scores: [1n,1n] });
  ok(await f.send(settle));
  expect((await f.state()).data.status).toBe(1);
  expect(f.svm.getBalance(f.alice.address)! - before[0]).toBe(9_000_001n);
  expect(f.svm.getBalance(f.bob.address)! - before[1]).toBe(9_000_001n);
  expect(f.svm.getBalance(f.auditor.address)! - before[2]).toBe(2_000_000n);
  expect(f.svm.getBalance(f.vault)).toBe(rent);
  expect(await f.send(settle)).toBeInstanceOf(FailedTransactionMetadata);
});

test('refund helper preserves stored participant order and terminal status', async () => {
  const f = await fixture(); ok(await f.create()); ok(await f.join(f.alice)); ok(await f.join(f.bob));
  const before = f.svm.getBalance(f.alice.address)!;
  const participants = (await f.state()).data.participants;
  f.time(261200n);
  const wrong = await client.buildRefundAllIx({ pot: f.pot, participants: [...participants].reverse() });
  expect(await f.send(wrong)).toBeInstanceOf(FailedTransactionMetadata);
  ok(await f.send(await client.buildRefundAllIx({ pot: f.pot, participants })));
  expect((await f.state()).data.status).toBe(2);
  expect(f.svm.getBalance(f.alice.address)! - before).toBe(10_000_001n);
});

test('generated join respects duplicate/auditor/deadline rules', async () => {
  const f = await fixture(); ok(await f.create());
  expect(await f.join(f.auditor)).toBeInstanceOf(FailedTransactionMetadata);
  ok(await f.join(f.alice));
  expect(await f.join(f.alice)).toBeInstanceOf(FailedTransactionMetadata);
  f.time(2000n);
  expect(await f.join(f.bob)).toBeInstanceOf(FailedTransactionMetadata);
});

test('validate owner, allocation, discriminator, bounded vector, PDA and state', async () => {
  const f = await fixture(); ok(await f.create()); const raw = f.raw();
  const bad = (patch: Partial<EncodedAccount>) => validatePotAccount({ ...raw, ...patch }, client.programAddress);
  await expect(bad({ programAddress: address('11111111111111111111111111111111') })).rejects.toThrow('owner');
  await expect(bad({ executable: true })).rejects.toThrow('owner');
  await expect(bad({ data: raw.data.slice(0, 360) })).rejects.toThrow('allocation');
  const mutate = (offset: number, value: number) => { const data = Uint8Array.from(raw.data); data[offset] = value; return data; };
  await expect(bad({ data: mutate(0, 0) })).rejects.toThrow('discriminator');
  await expect(bad({ data: mutate(98, 255) })).rejects.toThrow('participant count');
  await expect(bad({ data: mutate(102, 3) })).rejects.toThrow('state');
  await expect(bad({ address: f.vault })).rejects.toThrow('PDA');
  expect(getPotDecoder().decode(raw.data).creator).toBe(f.creator.address);
});

test('fetchPot uses RPC and rejects absent or wrong-owner accounts', async () => {
  const f = await fixture(); ok(await f.create()); const raw = f.raw();
  let value: unknown = { data: [Buffer.from(raw.data).toString('base64'), 'base64'], executable: false,
    lamports: Number(raw.lamports), owner: client.programAddress, rentEpoch: 0, space: 386 };
  const server = Bun.serve({ port: 0, hostname: '127.0.0.1', async fetch(req) {
    const json = await req.json() as { id: string; method: string };
    expect(json.method).toBe('getAccountInfo');
    return Response.json({ jsonrpc: '2.0', id: json.id, result: { context: { slot: 1 }, value } });
  } });
  try {
    const remote = potClient({ rpcUrl: server.url.toString() });
    expect((await remote.fetchPot(f.pot)).data.creator).toBe(f.creator.address);
    value = { ...(value as object), owner: '11111111111111111111111111111111' };
    await expect(remote.fetchPot(f.pot)).rejects.toThrow('owner');
    value = null;
    await expect(remote.fetchPot(f.pot)).rejects.toThrow();
  } finally { server.stop(true); }
});

test('configured program ID changes generated instructions and PDAs consistently', async () => {
  const f = await fixture();
  const custom = potClient({ rpcUrl: 'http://127.0.0.1:8899', programAddress: f.auditor.address });
  const [pot] = await custom.findPotPda(f.creator.address, 9n);
  expect(pot).not.toBe(f.pot);
  const ix = await custom.buildJoinIx({ pot, participant: f.alice });
  expect(ix.programAddress).toBe(f.auditor.address);
  expect(ix.accounts[2].address).toBe((await custom.findVaultPda(pot))[0]);
  expect(client.programAddress).toBe(VILLAGE_POT_PROGRAM_ADDRESS);
});
