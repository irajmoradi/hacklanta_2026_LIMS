import {
  AccountRole, address, assertAccountExists, createClient, decodeAccount,
  extendClient, fetchEncodedAccount, type Address, type EncodedAccount,
  type TransactionSigner,
} from '@solana/kit';
import { solanaRpcConnection } from '@solana/kit-plugin-rpc';
import {
  findPotPda, findVaultPda, getCreatePotInstructionAsync, getJoinInstructionAsync,
  getSettleInstructionAsync, getRefundAllInstructionAsync, getPotDecoder,
  POT_DISCRIMINATOR, VILLAGE_POT_PROGRAM_ADDRESS,
} from './generated';

export * from './generated';
export type PotClientConfig = { rpcUrl: string; programAddress?: string };
export type CreatePotInput = {
  creator: TransactionSigner; weekId: bigint; entryLamports: bigint;
  auditor: Address; auditorFeeBps: number; deadline: bigint; payoutMode?: number; rankedBps?: number[];
};

/** Validate untrusted RPC bytes before exposing decoded state. */
export async function validatePotAccount(account: EncodedAccount, programAddress: Address) {
  if (account.programAddress !== programAddress || account.executable) throw new Error('Invalid pot owner');
  if (account.data.length !== 386) throw new Error('Invalid pot allocation');
  if (!POT_DISCRIMINATOR.every((byte, i) => byte === account.data[i])) throw new Error('Invalid pot discriminator');
  // Bound the vector before the generated decoder allocates it.
  const count = new DataView(Uint8Array.from(account.data).buffer).getUint32(98, true);
  if (count > 8) throw new Error('Invalid participant count');
  const splitOffset = 106 + count * 32;
  if (new DataView(Uint8Array.from(account.data).buffer).getUint32(splitOffset, true) > 10) throw new Error('Invalid split count');
  const decoded = decodeAccount(account, getPotDecoder());
  const p = decoded.data;
  if (p.payoutMode > 2 || (p.payoutMode === 2 ? (!p.rankedBps.length || p.rankedBps.some(v => v <= 0) || p.rankedBps.reduce((a,b) => a+b, 0) !== 10000) : p.rankedBps.length !== 0) || p.status > 2 || p.auditorFeeBps > 2000 || p.entryLamports <= 0n ||
      p.entryLamports > (2n ** 64n - 1n) / 8n ||
      p.deadline > 2n ** 63n - 1n - 259200n ||
      new Set(p.participants).size !== p.participants.length || p.participants.includes(p.auditor)) {
    throw new Error('Invalid pot state');
  }
  const [pot, bump] = await findPotPda({ creator: p.creator, weekId: p.weekId }, { programAddress });
  const [vault, vaultBump] = await findVaultPda({ pot }, { programAddress });
  if (pot !== account.address || bump !== p.bump || vaultBump !== p.vaultBump ||
      p.auditor === vault || p.auditor === pot || p.auditor === '11111111111111111111111111111111') {
    throw new Error('Invalid pot PDA or auditor');
  }
  return decoded;
}

/** Read/build only. Program ID is public configuration, never a secret. */
export function potClient(config: PotClientConfig) {
  const programAddress = address(config.programAddress ?? VILLAGE_POT_PROGRAM_ADDRESS);
  const pdaConfig = { programAddress };
  return createClient().use(solanaRpcConnection({ rpcUrl: config.rpcUrl })).use(client => extendClient(client, {
    programAddress,
    rpcUrl: config.rpcUrl,
    findPotPda: (creator: Address, weekId: bigint) => findPotPda({ creator, weekId }, pdaConfig),
    findVaultPda: (pot: Address) => findVaultPda({ pot }, pdaConfig),
    async fetchPot(pot: Address) {
      const account = await fetchEncodedAccount(client.rpc, pot, { commitment: 'confirmed' });
      assertAccountExists(account);
      return validatePotAccount(account, programAddress);
    },
    buildCreatePotIx: (input: CreatePotInput) => getCreatePotInstructionAsync({ ...input, payoutMode: input.payoutMode ?? 0, rankedBps: input.rankedBps ?? [] }, pdaConfig),
    buildJoinIx: (input: { pot: Address; participant: TransactionSigner }) => getJoinInstructionAsync(input, pdaConfig),
    async buildSettleIx(input: { pot: Address; auditor: TransactionSigner; participants: Address[]; scores: bigint[] }) {
      if (!input.participants.length || input.participants.length > 8 || input.scores.length !== input.participants.length || new Set(input.participants).size !== input.participants.length) throw new Error('Invalid scores or participants');
      const ix = await getSettleInstructionAsync(input, pdaConfig);
      return { ...ix, accounts: [...ix.accounts, ...input.participants.map(address => ({ address, role: AccountRole.WRITABLE }))] };
    },
    async buildRefundAllIx(input: { pot: Address; participants: readonly Address[] }) {
      if (input.participants.length > 8 || new Set(input.participants).size !== input.participants.length) throw new Error('Invalid participants');
      const ix = await getRefundAllInstructionAsync(input, pdaConfig);
      return { ...ix, accounts: [...ix.accounts, ...input.participants.map(address => ({ address, role: AccountRole.WRITABLE }))] };
    },
  }));
}
export type PotClient = ReturnType<typeof potClient>;
