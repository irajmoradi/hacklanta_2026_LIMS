import {afterEach, expect, test} from 'bun:test';
import {Window} from 'happy-dom';
import React, {act, useRef, useState} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {useHouseLeaveGuard} from './HouseLeaveGuard';
const window = new Window();
Object.assign(window, {SyntaxError});
Object.assign(globalThis, {window, document:window.document, navigator:window.navigator, MouseEvent:window.MouseEvent, KeyboardEvent:window.KeyboardEvent, CustomEvent:window.CustomEvent, Event:window.Event, IS_REACT_ACT_ENVIRONMENT:true});
let root: Root | undefined;
afterEach(async () => {await act(async()=>root?.unmount()); root=undefined; document.body.replaceChildren();});
test('navigation waits for successful Save; Keep editing and failed saves preserve the draft', async () => {
  let navigated=0, saved=0, discarded=0, success=false;
  function Harness() {
    const scope = useRef<HTMLElement>(null);
    const guard = useHouseLeaveGuard({scope,dirty:true,save:async()=>{saved++; return success;},discard:()=>{discarded++;return true;},escape:()=>{navigated++;}});
    return <><section ref={scope}><button>Paint</button>{guard.prompt}</section><button onClick={()=>navigated++}>Leave</button><select defaultValue="home" onChange={()=>navigated++}><option value="home">Home</option><option value="away">Away</option></select></>;
  }
  const host=document.createElement('div'); document.body.append(host); root=createRoot(host);
  await act(async()=>root!.render(<Harness/>));
  const click = async (label:string) => {await act(async()=>{[...document.querySelectorAll('button')].find(b=>b.textContent===label)!.click();});};
  await click('Paint'); expect(document.querySelector('dialog')).toBeNull();
  await click('Leave'); expect(navigated).toBe(0); expect(document.querySelector('dialog')?.open).toBe(true);
  await click('Save'); expect(saved).toBe(1); expect(navigated).toBe(0); expect(document.querySelector('[role=alert]')).not.toBeNull();
  await click('Keep editing'); expect(document.querySelector('dialog')).toBeNull();
  await click('Leave'); success=true; await click('Save'); expect(navigated).toBe(1); expect(discarded).toBe(0);
  await act(async()=>{window.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));});
  await click('Discard'); expect(navigated).toBe(2); expect(discarded).toBe(1);
  const select=document.querySelector('select')!;
  await act(async()=>{select.focus(); select.value='away'; select.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(navigated).toBe(2); expect(select.value).toBe('home');
  await click('Save'); expect(navigated).toBe(3); expect(select.value).toBe('away');
});
test('Escape resolves both exterior drafts before closing the profile', async () => {
  let navigated=0;
  function Harness() {
    const a=useRef<HTMLElement>(null), b=useRef<HTMLElement>(null);
    const [first,setFirst]=useState(true), [second,setSecond]=useState(true);
    const close=()=>{navigated++;};
    const one=useHouseLeaveGuard({scope:a,dirty:first,save:()=>{setFirst(false);return true;},discard:()=>{setFirst(false);return true;},escape:close});
    const two=useHouseLeaveGuard({scope:b,dirty:second,save:()=>{setSecond(false);return true;},discard:()=>{setSecond(false);return true;},escape:close});
    return <><section ref={a}>{one.prompt}</section><section ref={b}>{two.prompt}</section></>;
  }
  const host=document.createElement('div'); document.body.append(host); root=createRoot(host);
  await act(async()=>root!.render(<Harness/>));
  await act(async()=>{window.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape'}));});
  const save=async()=>{await act(async()=>{[...document.querySelectorAll<HTMLButtonElement>('dialog button')].find(b=>b.textContent==='Save')!.click();});};
  await save(); expect(navigated).toBe(0); expect(document.querySelector('dialog')?.open).toBe(true);
  await save(); expect(navigated).toBe(1); expect(document.querySelector('dialog')).toBeNull();
});

test('pinned preview Escape discards locally while navigation still asks', async () => {
  let discarded = 0, closed = 0;
  function Harness() {
    const scope = useRef<HTMLElement>(null);
    const guard = useHouseLeaveGuard({scope, dirty:true, save:()=>true,
      discard:()=>{discarded++;return true;}, escape:()=>{discarded++;closed++;}, cancelOnEscape:true});
    return <><section ref={scope}>{guard.prompt}<button>Preview</button></section><button>Navigate</button></>;
  }
  const host=document.createElement('div');document.body.append(host);root=createRoot(host);
  await act(async()=>root!.render(<Harness/>));
  await act(async()=>{window.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape'}));});
  expect(discarded).toBe(1);expect(closed).toBe(1);expect(document.querySelector('dialog')).toBeNull();
  await act(async()=>{[...document.querySelectorAll('button')].find(b=>b.textContent==='Navigate')!.click();});
  expect(document.querySelector('dialog')?.open).toBe(true);expect(discarded).toBe(1);
});
