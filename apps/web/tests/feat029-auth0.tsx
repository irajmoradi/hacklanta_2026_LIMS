// Synthetic SDK used ONLY by feat029's Vite config. No tenant/network calls.
import { type ReactNode } from 'react';
export function Auth0Provider({children}: {children: ReactNode}) {return children;}
export function useAuth0() {
  const account = sessionStorage.getItem('test-auth-account');
  return {
    isLoading: false, isAuthenticated: Boolean(account), error: undefined,
    getAccessTokenSilently: async () => `synthetic-${account}`,
    loginWithRedirect: async () => {sessionStorage.setItem('test-auth-account', 'alice'); location.reload();},
    logout: async () => {sessionStorage.removeItem('test-auth-account'); location.reload();},
  };
}
