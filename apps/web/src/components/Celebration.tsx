import { sound } from '../sound/engine';
import { useEffect, useRef } from 'react';
import { useToast } from './Toast';
// The scene's celebrated IDs/goal bursts remain the VFX owner's integration point.
// Only the notification card and its local confetti live here.
export function Celebration({title,onDone,aboveDialog=false}: {title:string;onDone:()=>void;aboveDialog?:boolean}) {
  const {toast,dismiss} = useToast();
  const done = useRef(onDone);done.current=onDone;
  useEffect(() => {
    sound.play(aboveDialog ? 'building_unlock_tada' : 'crown_ceremony');
    const id = toast({title,kind:'success',variant:'moment',icon:/rebuilt|building/i.test(title) ? '\u{1f3e1}' : /level/i.test(title) ? '\u{1f331}' : '\u{1f451}',onDismiss:()=>done.current()});
    return () => dismiss(id, false);
  }, [title,aboveDialog,toast,dismiss]);
  return null;
}
