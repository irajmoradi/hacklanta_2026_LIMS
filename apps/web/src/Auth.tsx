import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { useEffect, useState } from 'react';
import App from './App';
import { api } from './api/client';
import { errorText } from './components/shared';

const { VITE_AUTH0_DOMAIN: domain, VITE_AUTH0_CLIENT_ID: clientId, VITE_AUTH0_AUDIENCE: audience } = import.meta.env;
export const authConfigured = Boolean(domain && clientId && audience && import.meta.env.VITE_AUTH0_ENABLED !== '0' && import.meta.env.VITE_MOCK !== '1');
export function AuthRoot() {
  if (!authConfigured) return <App />;
  return <Auth0Provider domain={domain} clientId={clientId} cacheLocation="memory" authorizationParams={{ redirect_uri: location.origin, audience }}><AuthenticatedApp /></Auth0Provider>;
}
function AuthenticatedApp() {
  const { isLoading, isAuthenticated, error, loginWithRedirect, logout, getAccessTokenSilently } = useAuth0();
  const [ready, setReady] = useState(false), [failure, setFailure] = useState('');
  useEffect(() => {
    if (!isAuthenticated) { setReady(false); return; }
    api.tokenProvider = async () => { const token = await getAccessTokenSilently({ authorizationParams: { audience } }); if (!token) throw new Error('Sign in again to renew your session.'); return token; };
    setReady(true);
    return () => { api.tokenProvider = undefined; };
  }, [isAuthenticated, getAccessTokenSilently]);
  if (isLoading) return <main className="boot-screen"><h1>Opening the garden gate…</h1></main>;
  if (!isAuthenticated && import.meta.env.VITE_DEMO_AUTH === '1') return <><App key="demo" onSignIn={() => void loginWithRedirect().catch(e => setFailure(errorText(e)))} />{(error || failure) && <div role="alert" className="toast">{error?.message || failure}</div>}</>;
  if (!isAuthenticated || !ready) return <main className="boot-screen"><h1>Your people. Your village.</h1><p>Sign in to find your friends.</p>{(error || failure) && <p role="alert">{error?.message || failure}</p>}<button className="button primary" onClick={() => void loginWithRedirect().catch(e => setFailure(errorText(e)))}>Sign in</button></main>;
  return <App key="account" onSignOut={() => void logout({ logoutParams: { returnTo: location.origin } })} />;
}
