import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { LAB_SCENES } from '../src/lab/scenes';
import '../src/lab/pipeline/demo.css';
import { api } from '../src/api/client';
if (new URLSearchParams(location.search).has('runtime')) { api.mode = 'live'; api.tokenProvider = async () => 'synthetic-test-token'; }
const Demo = new URLSearchParams(location.search).has('head') ? lazy(() => import('../src/lab/pipeline/CachedHead').then(m=>({default:m.CachedHead}))) : lazy((LAB_SCENES.find(s => s.id === new URLSearchParams(location.search).get('scene')) ?? LAB_SCENES[0]).load);
createRoot(document.getElementById('root')!).render(<Suspense fallback={<p>Loading…</p>}><Demo /></Suspense>);

