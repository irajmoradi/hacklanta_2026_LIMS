import { afterEach, expect, mock, test } from 'bun:test';
import { Window } from 'happy-dom';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
const win=new Window({url:'http://localhost/'});
Object.assign(win,{SyntaxError});
Object.assign(globalThis,{window:win,document:win.document,navigator:win.navigator,IS_REACT_ACT_ENVIRONMENT:true});
mock.module('../src/lab/pipeline/Turntable',()=>({COLORS:{skin:'#b7957f'},Turntable:()=> <div>3D fixture</div>}));
mock.module('../src/lab/pipeline/CachedHead',()=>({CachedHead:()=> <div>Head fixture</div>}));
mock.module('../src/components/PhotoCapture',()=>({PhotoCapture:()=> <div>Camera</div>}));
mock.module('../src/api/client',()=>({api:{mode:'mock',user:'fixture'}}));
const {default:Onboarding}=await import('../src/lab/onboarding/OnboardingDemo');
const {default:Pipeline}=await import('../src/lab/pipeline/PipelineDemo');
let root:Root;
afterEach(async()=>{await act(async()=>root?.unmount());document.body.replaceChildren();});
test('all tracks advance without any network calls',async()=>{
 const original=globalThis.fetch,calls:string[]=[];
 globalThis.fetch=mock(async(_url:unknown,init?:RequestInit)=>{calls.push(init?.method??'GET');throw Error('Network forbidden');}) as unknown as typeof fetch;
 const host=document.createElement('div');document.body.append(host);root=createRoot(host);
 const click=async(text:string)=>{const b=[...host.querySelectorAll('button')].find(b=>b.textContent===text)!;expect(b).toBeDefined();await act(async()=>b.click());};
 try {await act(async()=>root.render(<Onboarding/>));for(let i=1;i<7;i++){expect(host.querySelector('[aria-current="step"]')?.textContent).toStartWith(`${i}.`);await click('Next');}expect(host.textContent).toContain('First check-in complete');await click('Join a village');await click('Next');await click('Next');expect(host.textContent).toContain('Welcome to the neighborhood');await act(async()=>root.render(<Pipeline/>));for(let i=1;i<6;i++)await click('Next');await click('Object → mesh');for(let i=0;i<3;i++)await click('Next');expect(host.textContent).toContain('Ready for a friend');await click('Prev');expect(host.textContent).toContain('Inspect the generated geometry');expect(calls).toEqual([]);}finally{globalThis.fetch=original;}
});

test('public lab contains only object assets and a drawn placeholder', async () => {
 const { readdir } = await import('node:fs/promises');
 expect((await readdir(new URL('../public/lab/', import.meta.url))).sort()).toEqual(['README.md','mug-cutout.png','mug.glb','mug.jpg','placeholder.svg']);
});
