import {
  address, AccountRole, getSignatureFromTransaction, compileTransaction, getBase64EncodedWireTransaction, getCompiledTransactionMessageEncoder,
  compileTransactionMessage, getBase64Decoder, isTransactionModifyingSigner, isTransactionPartialSigner,
  setTransactionMessageLifetimeUsingBlockhash, setTransactionMessageComputeUnitLimit,
  setTransactionMessageLoadedAccountsDataSizeLimit, signTransactionWithSigners,
  estimateAndSetResourceLimitsFactory, type Address, type TransactionMessageBytesBase64,
} from '@solana/kit';
import { rpcTransactionPlanner } from '@solana/kit-plugin-rpc';
import { walletSigner } from '@solana/kit-plugin-wallet';
import { potClient, type PotClientConfig } from './index';

export function potWalletClient(config: PotClientConfig) {
  return potClient(config).use(walletSigner({ chain: 'solana:devnet', autoConnect: false }));
}
export type PotWalletClient = ReturnType<typeof potWalletClient>;

export function selectTransactionVersion(versions: ReadonlySet<'legacy' | 0 | 1>): 0 | 1 {
  if (versions.has(1)) return 1;
  if (versions.has(0)) return 0;
  throw new Error('Wallet must support transaction v1 or v0');
}

const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
async function assertDevnet(client: PotWalletClient) {
  // Custom devnet RPC URLs are supported; do not trust endpoint names.
  if (await client.rpc.getGenesisHash().send() !== DEVNET_GENESIS) throw new Error('Wallet signing is devnet only');
}

/** Prepare on one user action; display the review; sign on a separate approval action.
 * No sender/executor plugin is installed and no send RPC is called.
 */
export async function prepareJoin(client: PotWalletClient, pot: Address) {
  const connection = client.wallet.getState().connected;
  const signer = connection?.signer;
  if (!connection || !signer) throw new Error('Connect a signing wallet first');
  if (!isTransactionModifyingSigner(signer) && !isTransactionPartialSigner(signer)) {
    throw new Error('Wallet must support sign-only transactions');
  }
  const version = selectTransactionVersion(connection.supportedTransactionVersions);
  await assertDevnet(client);
  const state = await client.fetchPot(pot);
  if (state.data.status !== 0) throw new Error('Pot is finalized');
  if (state.data.participants.includes(signer.address)) throw new Error('Already joined');
  if (state.data.auditor === signer.address) throw new Error('Auditor cannot join');
  if (state.data.participants.length >= 8) throw new Error('Pot is full');
  const [vault] = await client.findVaultPda(pot);
  const ix = await client.buildJoinIx({ pot, participant: signer });
  const planner = client.use(rpcTransactionPlanner({ version }));
  const lifetime = (await client.rpc.getLatestBlockhash({ commitment: 'confirmed' }).send()).value;
  let message = setTransactionMessageLifetimeUsingBlockhash(lifetime, await planner.planTransaction([ix]));
  // First simulation uses runtime maxima to measure resources; no wallet call.
  const probe = setTransactionMessageLoadedAccountsDataSizeLimit(64 * 1024 * 1024,
    setTransactionMessageComputeUnitLimit(1_400_000, message));
  const simulate = (m: typeof message) => client.rpc.simulateTransaction(
    getBase64EncodedWireTransaction(compileTransaction(m)),
    { encoding: 'base64', sigVerify: false, commitment: 'confirmed' },
  ).send();
  let simulation = await simulate(probe);
  if (simulation.value.err === null) {
    const units = simulation.value.unitsConsumed;
    const loaded = simulation.value.loadedAccountsDataSize;
    if (units == null || (version === 1 && loaded == null)) throw new Error('RPC omitted simulation resource estimates');
    const estimateAndSet = estimateAndSetResourceLimitsFactory(async () => ({
      computeUnitLimit: Math.min(1_400_000, Math.ceil(Number(units) * 1.1) + 300),
      loadedAccountsDataSizeLimit: Math.min(64 * 1024 * 1024, Number(loaded ?? 0) + 1024),
    }));
    message = await estimateAndSet(message);
    simulation = await simulate(message);
  }
  const transaction = compileTransaction(message);
  const reviewedMessageBytes = Uint8Array.from(transaction.messageBytes);
  const messageBase64 = getBase64Decoder().decode(getCompiledTransactionMessageEncoder().encode(compileTransactionMessage(message))) as TransactionMessageBytesBase64;
  const fee = (await client.rpc.getFeeForMessage(messageBase64, { commitment: 'confirmed' }).send()).value;
  if (client.wallet.getState().connected !== connection) throw new Error('Wallet changed; simulate again');
  const review = Object.freeze({
    cluster: 'devnet' as const, programAddress: client.programAddress, pot, vault,
    feePayer: signer.address, entryLamports: state.data.entryLamports, feeLamports: fee,
    version, deadline: state.data.deadline, lastValidBlockHeight: lifetime.lastValidBlockHeight,
    simulation,
  });
  // Capture success separately: mutating UI-visible RPC results cannot bypass the gate.
  const succeeded = simulation.value.err === null && fee !== null;
  let consumed = false;
  return {
    review,
    async sign(approval: { approved: true }) {
      if (approval?.approved !== true) throw new Error('Explicit approval is required');
      if (!succeeded) throw new Error('Successful simulation and fee estimate are required');
      if (consumed) throw new Error('Review already consumed; simulate again');
      consumed = true;
      await assertDevnet(client);
      if (client.wallet.getState().connected !== connection) throw new Error('Wallet changed; simulate again');
      if (await client.rpc.getBlockHeight({ commitment: 'confirmed' }).send() > lifetime.lastValidBlockHeight) {
        throw new Error('Blockhash expired; simulate again');
      }
      if (client.wallet.getState().connected !== connection) throw new Error('Wallet changed; simulate again');
      const signed = await signTransactionWithSigners([signer], transaction);
      if (signed.messageBytes.length !== reviewedMessageBytes.length ||
          !signed.messageBytes.every((byte, i) => byte === reviewedMessageBytes[i])) {
        throw new Error('Wallet modified the reviewed transaction; refusing result');
      }
      return signed;
    },
  };
}
export type PreparedJoin = Awaited<ReturnType<typeof prepareJoin>>;

export type WalletIntent = {
  id: string; wallet: string; metadata: Record<string, unknown>;
  instructions: {program: string; accounts: {address: string; role: number}[]; data: string}[];
};
export async function prepareIntent(client: PotWalletClient, intent: WalletIntent) {
  const connection = client.wallet.getState().connected;
  const signer = connection?.signer;
  if (!connection || !signer) throw new Error('Connect a signing wallet first');
  if (!isTransactionModifyingSigner(signer) && !isTransactionPartialSigner(signer)) {
    throw new Error('Wallet must support sign-only transactions');
  }
  const version = selectTransactionVersion(connection.supportedTransactionVersions);
  await assertDevnet(client);
  if (intent.wallet !== signer.address) throw new Error('Reconnect the reviewed wallet');
  const instructions = intent.instructions.map(ix => ({
    programAddress: address(ix.program),
    accounts: ix.accounts.map(a => ({address: address(a.address), role: a.role as AccountRole,
      ...(a.address === signer.address && (a.role === 2 || a.role === 3) ? {signer} : {})})),
    data: Uint8Array.from(atob(ix.data), c => c.charCodeAt(0)),
  }));
  const planner = client.use(rpcTransactionPlanner({ version }));
  const lifetime = (await client.rpc.getLatestBlockhash({ commitment: 'confirmed' }).send()).value;
  let message = setTransactionMessageLifetimeUsingBlockhash(lifetime, await planner.planTransaction(instructions));
  // First simulation uses runtime maxima to measure resources; no wallet call.
  const probe = setTransactionMessageLoadedAccountsDataSizeLimit(64 * 1024 * 1024,
    setTransactionMessageComputeUnitLimit(1_400_000, message));
  const simulate = (m: typeof message) => client.rpc.simulateTransaction(
    getBase64EncodedWireTransaction(compileTransaction(m)),
    { encoding: 'base64', sigVerify: false, commitment: 'confirmed' },
  ).send();
  let simulation = await simulate(probe);
  if (simulation.value.err === null) {
    const units = simulation.value.unitsConsumed;
    const loaded = simulation.value.loadedAccountsDataSize;
    if (units == null || (version === 1 && loaded == null)) throw new Error('RPC omitted simulation resource estimates');
    const estimateAndSet = estimateAndSetResourceLimitsFactory(async () => ({
      computeUnitLimit: Math.min(1_400_000, Math.ceil(Number(units) * 1.1) + 300),
      loadedAccountsDataSizeLimit: Math.min(64 * 1024 * 1024, Number(loaded ?? 0) + 1024),
    }));
    message = await estimateAndSet(message);
    simulation = await simulate(message);
  }
  const transaction = compileTransaction(message);
  const reviewedMessageBytes = Uint8Array.from(transaction.messageBytes);
  const messageBase64 = getBase64Decoder().decode(getCompiledTransactionMessageEncoder().encode(compileTransactionMessage(message))) as TransactionMessageBytesBase64;
  const fee = (await client.rpc.getFeeForMessage(messageBase64, { commitment: 'confirmed' }).send()).value;
  if (client.wallet.getState().connected !== connection) throw new Error('Wallet changed; simulate again');
  const review = Object.freeze({
    cluster: 'devnet' as const, intentId: intent.id, metadata: intent.metadata,
    feePayer: signer.address, feeLamports: fee, instructions: intent.instructions,
    version, lastValidBlockHeight: lifetime.lastValidBlockHeight,
    simulation,
  });
  // Capture success separately: mutating UI-visible RPC results cannot bypass the gate.
  const succeeded = simulation.value.err === null && fee !== null;
  let consumed = false;
  return {
    review,
    async sign(approval: { approved: true }) {
      if (approval?.approved !== true) throw new Error('Explicit approval is required');
      if (!succeeded) throw new Error('Successful simulation and fee estimate are required');
      if (consumed) throw new Error('Review already consumed; simulate again');
      consumed = true;
      await assertDevnet(client);
      if (client.wallet.getState().connected !== connection) throw new Error('Wallet changed; simulate again');
      if (await client.rpc.getBlockHeight({ commitment: 'confirmed' }).send() > lifetime.lastValidBlockHeight) {
        throw new Error('Blockhash expired; simulate again');
      }
      if (client.wallet.getState().connected !== connection) throw new Error('Wallet changed; simulate again');
      const signed = await signTransactionWithSigners([signer], transaction);
      if (signed.messageBytes.length !== reviewedMessageBytes.length ||
          !signed.messageBytes.every((byte, i) => byte === reviewedMessageBytes[i])) {
        throw new Error('Wallet modified the reviewed transaction; refusing result');
      }
      return signed;
    },
  };
}
/** Called only by the explicit Sign & send button after a successful review. */
export async function sendIntent(client: PotWalletClient, prepared: Awaited<ReturnType<typeof prepareIntent>>, onSignature: (signature: string) => void) {
  const signed = await prepared.sign({ approved: true });
  const signature = getSignatureFromTransaction(signed);
  // Persist BEFORE broadcast: an RPC timeout must not invite another payment.
  onSignature(signature);
  await assertDevnet(client);
  await client.rpc.sendTransaction(getBase64EncodedWireTransaction(signed), {encoding:'base64', skipPreflight:false, preflightCommitment:'confirmed', maxRetries:3n}).send();
  for (let attempt=0; attempt<30; attempt++) {
    const status = (await client.rpc.getSignatureStatuses([signature], {searchTransactionHistory:true}).send()).value[0];
    if (status?.err) throw new Error('Transaction failed on devnet');
    if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') return signature;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Confirmation pending. Retry verification with this signature; do not pay again.');
}
