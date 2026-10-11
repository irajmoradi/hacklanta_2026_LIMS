import { useState } from 'react';
import { PhotoItems } from './PhotoItems';
import { Dialog } from './shared';
export function MakeItReal({vid, refresh}: {vid: string; refresh: () => Promise<void>}) {
  const [open, setOpen] = useState(false);
  return <><button className="button secondary full" onClick={() => setOpen(true)}>Make it real</button>{open && <Dialog title="Make it real" eyebrow="BUILD FROM A PHOTO" onClose={() => setOpen(false)}><PhotoItems vid={vid} refresh={refresh}/></Dialog>}</>;
}
