import { intersectsAvatar, type ScreenRect } from './avatarFocusGeometry';
import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {labelOffset, type LabelRect as Rect} from './labelPlacement';


/** Keep badges clear of neighboring house plates without changing the HUD's hit-test order. */
export function LabelSpacing() {
  const {gl} = useThree();
  const elapsed = useRef(0), offsets = useRef(new WeakMap<HTMLElement, number>());
  useFrame((_, dt) => {
    elapsed.current += dt;
    if (elapsed.current < .15) return;
    elapsed.current = 0;
    const scene = gl.domElement.closest('.scene');
    if (!scene) return;
    const bounds = scene.getBoundingClientRect();
    const labels=Array.from(scene.querySelectorAll<HTMLElement>('.scene-label, .house-nameplate, .villager-label'));
    const sign = (el: HTMLElement) => el.matches('button.scene-label:not(.villager-label):not(.house-nameplate)');
    const dense=labels.filter(label => label.classList.contains('villager-label')).length>10;
    const priority=(el:HTMLElement)=>el.dataset.player==='true' || el.dataset.walkFocus==='true' || el.classList.contains('selected');
    labels.sort((a,b)=>Number(sign(b))-Number(sign(a)) || Number(priority(b))-Number(priority(a)));
    const occupied: Rect[] = Array.from(document.querySelectorAll<HTMLElement>(
      '.topbar, .topbar-utilities, .welcome, .social-entry-stack, .action-dock, .neighbors-strip, .profile-panel, .dashboard:not(.is-collapsed), .dashboard-ribbon, .scene-controls, .camera-hint, .emote-wheel, .player-hint'))
      .filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden')
      .map(el => el.getBoundingClientRect());
    const owner = scene.querySelector<HTMLElement>('.villager-label[data-walk-focus="true"]');
    const measured: ScreenRect | null = owner?.dataset.avatarBounds ? JSON.parse(owner.dataset.avatarBounds) : null;
    const avatar = measured ? {left:measured.left+bounds.left, right:measured.right+bounds.left, top:measured.top+bounds.top, bottom:measured.bottom+bounds.top} : null;
    // Measure once before changing visibility or translations. Preserve the
    // crowd priority and walking-avatar exclusions from SCALE-001/WEB-045.
    const measuredLabels = labels.filter(label => label.parentElement?.style.display !== 'none')
      .map(label => ({label, rect:label.getBoundingClientRect(), previous:offsets.current.get(label) ?? 0}));
    const updates: (() => void)[] = [];
    for (const {label, rect, previous} of measuredLabels) {
      const base = {left:rect.left,right:rect.right,top:rect.top-previous,bottom:rect.bottom-previous};
      // A wider profile and two-line activity badges can fill the space above a
      // house. Search below as well, and never push a hit target into the header.
      const found=labelOffset(base,bounds,occupied,sign(label) ? 40 : dense ? 8 : 20);
      if(found===null) {updates.push(() => {label.style.visibility='hidden';});continue;}
      const offset=found;
      const placed = {...base, top:base.top+offset, bottom:base.bottom+offset};
      occupied.push(placed);
      updates.push(() => {
        label.style.visibility='';
        // Translated labels must not leave an invisible wrapper hit target behind.
        if (label.parentElement) label.parentElement.style.pointerEvents = 'none';
        label.style.pointerEvents = label.matches('button, a, [role=button]') ? 'auto' : 'none';
        label.dataset.avatarOverlap = String(label !== owner && !sign(label) && !!avatar && intersectsAvatar(placed, avatar));
        if (offset !== previous) { label.style.translate = `0 ${offset}px`; offsets.current.set(label, offset); }
      });
    }
    updates.forEach(update => update());
  });
  return null;
}
