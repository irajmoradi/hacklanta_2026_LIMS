import { useState, type ReactNode } from 'react';

declare global { interface Window { walletTest?: { failed?: boolean; noFee?: boolean; signed: number; simulations: number } } }
export function ClientProvider({ children }: { children: ReactNode }) { return children; }
export function potWalletClient() { return {}; }
export function useWallets() { return [{ name: 'Mock wallet' }]; }
export function useConnectedWallet() { return {}; }
export function useConnect() { return { status: 'idle', dispatchAsync: async () => {} }; }
export function useJoinPot() {
  const [review, setReview] = useState<unknown>(null);
  return { review, pending: false, error: null,
    simulate: async () => {
      const state = window.walletTest!; state.simulations++;
      setReview({ cluster: 'devnet', programAddress: 'test-program', pot: 'test-pot', vault: 'test-vault', feePayer: 'mock-payer', entryLamports: 10000000n, feeLamports: state.noFee ? null : 5000n, version: 0, deadline: 1900000000n, simulation: { value: { err: state.failed ? 'InsufficientFunds' : null, logs: ['Mock simulation only'], unitsConsumed: 4000 } } });
    },
    sign: async ({ approved }: { approved: true }) => { if (!approved || !review) throw new Error('Review required'); window.walletTest!.signed++; },
  };
}
