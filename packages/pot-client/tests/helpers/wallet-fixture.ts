import { expect } from 'bun:test';
import {
  getSignatureFromTransaction, extendClient, generateKeyPairSigner, getTransactionDecoder, lamports,
  getCompiledTransactionMessageDecoder, type TransactionPartialSigner,
  assertIsTransactionWithBlockhashLifetime, assertIsTransactionWithinSizeLimit,
} from '@solana/kit';
import type { WalletState } from '@solana/kit-plugin-wallet';
import { getPotEncoder } from '../../src';
import { potWalletClient, prepareJoin, selectTransactionVersion } from '../../src/wallet';

export async function walletFixture(versions: ('legacy' | 0 | 1)[] = [0, 1]) {
  const keypair = await generateKeyPairSigner();
  const creator = await generateKeyPairSigner();
  const auditor = await generateKeyPairSigner();
  let signedCount = 0;
  const signer: TransactionPartialSigner = {
    address: keypair.address,
    async signTransactions(txs, config) { signedCount++; return keypair.signTransactions(txs, config); },
  };
  let connection = { signer, supportedTransactionVersions: new Set(versions),
    account: { address: signer.address }, wallet: {} } as unknown as NonNullable<WalletState['connected']> | null;
  const calls: string[] = [];
  const messages: ReturnType<ReturnType<typeof getCompiledTransactionMessageDecoder>['decode']>[] = [];
  let allowSend = false;
  let simulationError: unknown = null;
  let fee: number | null = 5000;
  let height = 10;
  let genesis = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
  let onHeight: (() => void) | undefined;
  let data = new Uint8Array();
  const server = Bun.serve({ port: 0, hostname: '127.0.0.1', async fetch(req) {
    const body = await req.json() as { id: number; method: string; params: unknown[] };
    calls.push(body.method);
    let result: unknown;
    switch (body.method) {
      case 'getGenesisHash': result = genesis; break;
      case 'getAccountInfo': result = { context: { slot: 1 }, value: {
        data: [Buffer.from(data).toString('base64'), 'base64'], executable: false, lamports: 1_000_000,
        owner: client.programAddress, rentEpoch: 0, space: 386,
      } }; break;
      case 'getLatestBlockhash': result = { context: { slot: 1 }, value: {
        blockhash: '11111111111111111111111111111111', lastValidBlockHeight: 100,
      } }; break;
      case 'simulateTransaction': {
        expect(signedCount).toBe(0);
        expect(body.params[1]).toMatchObject({ sigVerify: false, encoding: 'base64' });
        const tx = getTransactionDecoder().decode(Buffer.from(body.params[0] as string, 'base64'));
        expect(Object.values(tx.signatures).every(s => s === null)).toBe(true);
        messages.push(getCompiledTransactionMessageDecoder().decode(tx.messageBytes));
        result = { context: { slot: 1 }, value: { err: simulationError,
          logs: simulationError ? ['Program failed: JoiningClosed'] : ['Program success'],
          unitsConsumed: 20_000, loadedAccountsDataSize: 4096, returnData: null } }; break;
      }
      case 'sendTransaction': { if(!allowSend)throw new Error('Forbidden send'); result=getSignatureFromTransaction(getTransactionDecoder().decode(Buffer.from(body.params[0] as string,'base64')));break; }
      case 'getSignatureStatuses': result={context:{slot:1},value:[{slot:1,confirmations:1,err:null,confirmationStatus:'confirmed'}]};break;
      case 'getFeeForMessage': result = { context: { slot: 1 }, value: fee }; break;
      case 'getBlockHeight': onHeight?.(); result = height; break;
      default: throw new Error(`Forbidden RPC: ${body.method}`);
    }
    return Response.json({ jsonrpc: '2.0', id: body.id, result });
  } });
  const client = potWalletClient({ rpcUrl: server.url.toString() }).use(c => extendClient(c, {
    payer: signer, identity: signer,
    wallet: { ...c.wallet, getState: () => ({ connected: connection, status: connection ? 'connected' : 'disconnected', wallets: [], reconnectingTo: null } as WalletState) },
  }));
  const [pot, bump] = await client.findPotPda(creator.address, 1n);
  const [, vaultBump] = await client.findVaultPda(pot);
  data = new Uint8Array(386);
  data.set(getPotEncoder().encode({ creator: creator.address, weekId: 1n, entryLamports: 100n,
    auditor: auditor.address, auditorFeeBps: 1000, deadline: 2000n, participants: [], status: 0, bump, vaultBump, payoutMode: 0, rankedBps: [] }));
  return { client, pot, allowSend:()=>{allowSend=true;}, messages, calls, signedCount: () => signedCount, stop: () => server.stop(true),
    failSimulation: () => { simulationError = { InstructionError: [0, { Custom: 6006 }] }; },
    omitFee: () => { fee = null; }, expire: () => { height = 101; },
    wrongCluster: () => { genesis = 'mainnet'; }, disconnect: () => { connection = null; },
    disconnectDuringHeight: () => { onHeight = () => { connection = null; }; },
    sendingOnly: () => { connection = { ...connection!, signer: {
      address: signer.address, signAndSendTransactions: async () => { throw new Error('Must never send'); },
    } }; },
    modifyingWallet: () => { connection = { ...connection!, signer: {
      address: signer.address,
      async modifyAndSignTransactions(txs) {
        signedCount++;
        return Promise.all(txs.map(async tx => {
          assertIsTransactionWithBlockhashLifetime(tx);
          assertIsTransactionWithinSizeLimit(tx);
          // Deliberately mutate the supplied bytes in place: test the retained snapshot.
          const bytes = tx.messageBytes as unknown as Uint8Array;
          bytes[bytes.length - 1] ^= 1;
          const [signatures] = await keypair.signTransactions([tx]);
          return { ...tx, signatures };
        }));
      },
    } }; },
  };
}
