import { createRoot } from 'react-dom/client';
import { WardrobePreview } from '../src/components/Wardrobe';
import { api } from '../src/api/client';

/** Mount the production Wardrobe preview beside the current profile for fit parity QA. */
export async function mountWardrobe() {
  const village = await api.village('11111111-1111-4111-8111-111111111111');
  const person = village.villagers.find(person => person.display_name === 'Iraj')!;
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;inset:10px auto auto 10px;width:420px;height:500px;z-index:10000;background:#edf0f3';
  document.body.append(host);
  createRoot(host).render(<WardrobePreview person={person} />);
}
