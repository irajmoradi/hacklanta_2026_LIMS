import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { LiteSVM, FailedTransactionMetadata } from 'litesvm';
import { address, generateKeyPairSigner, getAddressEncoder, getProgramDerivedAddress,
  createTransactionMessage, setTransactionMessageFeePayerSigner,
  appendTransactionMessageInstruction, signTransactionMessageWithSigners } from '@solana/kit';

const idl = JSON.parse(readFileSync('target/idl/village_pot.json'));
const ID = address(idl.address), SYSTEM = address('11111111111111111111111111111111');
const enc = getAddressEncoder();
const u64 = n => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
const i64 = n => { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(n)); return b; };
const u16 = n => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const scoreVec = scores => { const n = Buffer.alloc(4); n.writeUInt32LE(scores.length); return Buffer.concat([n, ...scores.map(u64)]); };
const splitVec = split => { const n = Buffer.alloc(4); n.writeUInt32LE(split.length); return Buffer.concat([n, ...split.map(u16)]); };
const vec = keys => { const n = Buffer.alloc(4); n.writeUInt32LE(keys.length); return Buffer.concat([n, ...keys.map(k => enc.encode(k))]); };
const meta = (a, role = 1) => typeof a === 'string' ? { address: a, role } : { address: a.address, role, signer: a };
const ix = (name, accounts, data = []) => ({ programAddress: ID, accounts,
  data: Buffer.concat([createHash('sha256').update(`global:${name}`).digest().subarray(0, 8), ...data]) });
const ok = result => assert.ok(!(result instanceof FailedTransactionMetadata), result instanceof FailedTransactionMetadata ? result.meta().logs().join('\n') : '');
const fail = (result, code) => {
  assert.ok(result instanceof FailedTransactionMetadata, 'expected transaction failure');
  assert.match(result.meta().logs().join('\n'), new RegExp(code));
};

async function fixture({ entry = 10000001n, fee = 1000, deadline = 2000n, mode = 1, split = [] } = {}) {
  const svm = new LiteSVM();
  svm.addProgramFromFile(ID, 'target/deploy/village_pot.so');
  const people = await Promise.all(Array.from({ length: 12 }, () => generateKeyPairSigner()));
  for (const person of people) ok(svm.airdrop(person.address, 1000000000n));
  const [payer, creator, auditor, ...players] = people;
  const [pot] = await getProgramDerivedAddress({ programAddress: ID, seeds: [Buffer.from('pot'), enc.encode(creator.address), u64(1)] });
  const [vault] = await getProgramDerivedAddress({ programAddress: ID, seeds: [Buffer.from('vault'), enc.encode(pot)] });
  const time = value => { const clock = svm.getClock(); clock.unixTimestamp = value; svm.setClock(clock); };
  time(1000n);
  async function send(instruction) {
    svm.expireBlockhash();
    let msg = setTransactionMessageFeePayerSigner(payer, createTransactionMessage({ version: 0 }));
    msg = svm.setTransactionMessageLifetimeUsingLatestBlockhash(msg);
    msg = appendTransactionMessageInstruction(instruction, msg);
    return svm.sendTransaction(await signTransactionMessageWithSigners(msg));
  }
  const create = () => send(ix('create_pot', [meta(creator, 3), meta(pot), meta(vault), meta(SYSTEM, 0)],
    [u64(1), u64(entry), enc.encode(auditor.address), u16(fee), i64(deadline), Buffer.from([mode]), splitVec(split)]));
  const joined = [];
  const join = async (p, v = vault) => { const result = await send(ix('join', [meta(p, 3), meta(pot), meta(v), meta(SYSTEM, 0)])); if (!(result instanceof FailedTransactionMetadata)) joined.push(p); return result; };
  const settle = (winners, signer = auditor, recipients = joined) => send(ix('settle',
    [meta(signer, 3), meta(pot), meta(vault), ...recipients.map(p => meta(p.address ?? p))],
    [scoreVec(winners.length === 0 ? [] : joined.map(p => winners.some(w => (w.address ?? w) === p.address) ? 1n : 0n))]));
  const settleScores = scores => send(ix('settle', [meta(auditor, 3), meta(pot), meta(vault), ...joined.map(p => meta(p.address))], [scoreVec(scores)]));
  const refund = (recipients = players.slice(0, 2)) => send(ix('refund_all', [meta(pot), meta(vault), ...recipients.map(p => meta(p.address ?? p))]));
  const balance = a => svm.getBalance(a.address ?? a);
  const status = () => {
    const data = svm.getAccount(pot).data;
    const count = Buffer.from(data).readUInt32LE(98);
    return data[102 + count * 32];
  };
  return { svm, payer, creator, auditor, players, pot, vault, entry, create, join, settle, settleScores, refund, time, balance, status, send };
}

test('happy path: fees, equal split, dust, rent, terminal state and no double settle', async () => {
  const f = await fixture(); ok(await f.create());
  const rent = f.balance(f.vault);
  for (const p of f.players.slice(0, 3)) ok(await f.join(p));
  const winners = f.players.slice(0, 2), before = winners.map(f.balance), auditorBefore = f.balance(f.auditor);
  f.time(2000n); ok(await f.settle(winners));
  assert.equal(f.balance(f.auditor) - auditorBefore, 3000000n);
  assert.equal(f.balance(winners[0]) - before[0], 13500002n);
  assert.equal(f.balance(winners[1]) - before[1], 13500001n);
  assert.equal(f.balance(f.vault), rent); assert.equal(f.status(), 1);
  fail(await f.settle(winners), 'AlreadyFinalized');
  f.time(261200n); fail(await f.refund(f.players.slice(0, 3)), 'AlreadyFinalized');
});

test('auditor excluded, duplicate entry rejected, exactly eight slots', async () => {
  const f = await fixture(); ok(await f.create());
  fail(await f.join(f.auditor), 'AuditorCannotJoin');
  ok(await f.join(f.players[0])); fail(await f.join(f.players[0]), 'DuplicateParticipant');
  for (const p of f.players.slice(1, 8)) ok(await f.join(p));
  fail(await f.join(f.players[8]), 'PotFull');
  assert.equal(f.balance(f.vault), f.svm.minimumBalanceForRentExemption(8n) + 8n * f.entry);
});

test('authority, deadline and winners are enforced with atomic rejection', async () => {
  const f = await fixture(); ok(await f.create()); ok(await f.join(f.players[0])); ok(await f.join(f.players[1]));
  fail(await f.settle([f.players[0]]), 'TooEarly');
  f.time(2000n);
  fail(await f.join(f.players[2]), 'JoiningClosed');
  fail(await f.settle([f.players[0]], f.creator), 'UnauthorizedAuditor');
  for (const winners of [[], [f.players[2]]]) fail(await f.settle(winners), 'InvalidWinners');
  fail(await f.settleScores([1n]), 'InvalidWinners');
  const before = f.balance(f.vault);
  fail(await f.settle([f.players[0]], f.auditor, [f.players[1]]), 'InvalidRecipients');
  fail(await f.settle([f.players[0]], f.auditor, []), 'InvalidRecipients');
  assert.equal(f.balance(f.vault), before); assert.equal(f.status(), 0);
  ok(await f.settle([f.players[0]]));
});

test('permissionless full refund at exactly 72 hours; no late settlement or replay', async () => {
  const f = await fixture(); ok(await f.create());
  for (const p of f.players.slice(0, 2)) ok(await f.join(p));
  const before = f.players.slice(0, 2).map(f.balance), auditorBefore = f.balance(f.auditor);
  f.time(261199n); fail(await f.refund(), 'TooEarly');
  f.time(261200n); fail(await f.settle([f.players[0]]), 'SettlementExpired');
  fail(await f.refund([f.players[1], f.players[0]]), 'InvalidRecipients');
  fail(await f.refund([f.players[0], f.players[0]]), 'InvalidRecipients');
  ok(await f.refund());
  for (let i = 0; i < 2; i++) assert.equal(f.balance(f.players[i]) - before[i], f.entry);
  assert.equal(f.balance(f.auditor), auditorBefore); assert.equal(f.status(), 2);
  assert.equal(f.balance(f.vault), f.svm.minimumBalanceForRentExemption(8n));
  fail(await f.refund(), 'AlreadyFinalized'); fail(await f.join(f.players[2]), 'AlreadyFinalized');
});

test('creation validates fee, entry math and deadline; fee endpoints accepted', async () => {
  for (const [options, error] of [[{ fee: 2001 }, 'FeeTooHigh'], [{ entry: 0n }, 'InvalidEntry'],
    [{ entry: 2n ** 64n - 1n }, 'Overflow'], [{ deadline: 1000n }, 'InvalidDeadline'],
    [{ deadline: 2n ** 63n - 1n }, 'Overflow']]) {
    const f = await fixture(options); fail(await f.create(), error); assert.equal(f.svm.getAccount(f.pot).exists, false);
  }
  for (const fee of [0, 2000]) { const f = await fixture({ fee }); ok(await f.create()); }
});

test('wrong vault rejected; empty pot can refund; pot cannot be recreated', async () => {
  const f = await fixture(); ok(await f.create());
  assert.ok(await f.join(f.players[0], f.pot) instanceof FailedTransactionMetadata);
  f.time(261200n); ok(await f.refund([])); assert.equal(f.status(), 2);
  assert.ok(await f.create() instanceof FailedTransactionMetadata);
});

test('readonly or excess recipients and an unsigned auditor are rejected', async () => {
  const f = await fixture(); ok(await f.create()); ok(await f.join(f.players[0])); f.time(2000n);
  const data = [scoreVec([1n])];
  fail(await f.send(ix('settle', [meta(f.auditor, 3), meta(f.pot), meta(f.vault), meta(f.players[0].address, 0)], data)), 'InvalidRecipients');
  fail(await f.settle([f.players[0]], f.auditor, [f.players[0], f.players[1]]), 'InvalidRecipients');
  fail(await f.send(ix('settle', [meta(f.auditor.address), meta(f.pot), meta(f.vault), meta(f.players[0].address)], data)), 'AccountNotSigner');
  assert.equal(f.status(), 0); ok(await f.settle([f.players[0]]));
});

test('donations do not inflate prizes; fee endpoints pay the exact amount', async () => {
  for (const fee of [0, 2000]) {
    const f = await fixture({ fee }); ok(await f.create()); ok(await f.join(f.players[0]));
    const transferTag = Buffer.alloc(4); transferTag.writeUInt32LE(2);
    ok(await f.send({ programAddress: SYSTEM,
      accounts: [meta(f.creator, 3), meta(f.vault)], data: Buffer.concat([transferTag, u64(12345)]) }));
    const before = f.balance(f.players[0]), auditorBefore = f.balance(f.auditor);
    f.time(2000n); ok(await f.settle([f.players[0]]));
    const expectedFee = f.entry * BigInt(fee) / 10000n;
    assert.equal(f.balance(f.auditor) - auditorBefore, expectedFee);
    assert.equal(f.balance(f.players[0]) - before, f.entry - expectedFee);
    assert.equal(f.balance(f.vault), f.svm.minimumBalanceForRentExemption(8n) + 12345n);
  }
});

for (const [mode, split, scores, expected] of [
  [0, [], [5n,5n,1n], [21n,0n,0n]],
  [1, [], [2n,1n,0n], [14n,7n,0n]],
  [1, [], [1n,1n,1n], [7n,7n,7n]],
  [2, [6000,3000,1000], [5n,5n,1n], [13n,6n,2n]],
  [2, [6000,3000,1000], [0n,5n,1n], [0n,14n,7n]],
]) test(`payout mode ${mode}: ties, missing places, conservation ${scores}`, async () => {
  const f = await fixture({entry:7n,fee:0,mode,split}); ok(await f.create());
  for (const p of f.players.slice(0,3)) ok(await f.join(p));
  const before = f.players.slice(0,3).map(f.balance); f.time(2000n);
  ok(await f.settleScores(scores));
  assert.deepEqual(f.players.slice(0,3).map((p,i)=>f.balance(p)-before[i]), expected);
  assert.equal(f.balance(f.vault), f.svm.minimumBalanceForRentExemption(8n));
});
test('ranked split validation and zero scores', async () => {
  for (const [mode,split] of [[3,[]],[2,[]],[2,[9999]],[2,[10000,0]],[0,[10000]],[2,Array(11).fill(1000)]]) {
    const f = await fixture({mode,split}); fail(await f.create(), 'InvalidSplit');
  }
  const f = await fixture(); ok(await f.create()); ok(await f.join(f.players[0])); f.time(2000n);
  fail(await f.settleScores([0n]), 'InvalidWinners'); f.time(261200n); ok(await f.refund([f.players[0]]));
});
