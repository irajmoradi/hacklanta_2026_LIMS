import { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { AuthRoot } from './Auth';
import { Reconnecting } from './components/Reconnecting';
import './styles.css';
const Lab = lazy(() => import('./lab/Lab'));
const isLab = window.location.pathname.replace(/\/$/, '') === '/lab';
ReactDOM.createRoot(document.getElementById('root')!).render(isLab
  ? <Suspense fallback={<p role="status">Opening Demo Lab...</p>}><Lab /></Suspense>
  : <><AuthRoot /><Reconnecting /></>);
