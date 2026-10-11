import { useEffect, useSyncExternalStore } from 'react';
import { connection } from '../api/retry';
import { ToastViewport, toast, dismissToast } from './Toast';
// Mounted once by main.tsx, including before the village has loaded.
export function Reconnecting() {
  const visible = useSyncExternalStore(connection.subscribe, connection.snapshot);
  useEffect(() => {
    // Only surface real outages: brief socket blips and quick retries reconnect silently.
    if (!visible) { dismissToast('connection'); return; }
    const timer = setTimeout(() => toast({id:'connection',kind:'info',title:'Reconnecting\u2026',detail:'Trying to reconnect to the village.',duration:0}), 2500);
    return () => clearTimeout(timer);
  }, [visible]);
  return <ToastViewport/>;
}
