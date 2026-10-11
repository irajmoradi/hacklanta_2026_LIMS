import { createRoot } from 'react-dom/client';
import { api } from '../src/api/client';
import ShopInterior from '../src/scene/ShopInterior';
import { ColosseumScene } from '../src/scene/ColosseumScene';

/** Mount real venue components with fixture data; no writes or on-chain actions. */
export async function mountVenues() {
  const village = await api.village('11111111-1111-4111-8111-111111111111');
  const shop = await api.shop(village.id);
  const person = village.villagers.find(p=>p.display_name==='Iraj')!;
  const host = document.createElement('div');
  host.style.cssText='position:fixed;inset:0;z-index:20000;background:#edf0f3;display:flex';
  document.body.append(host);
  createRoot(host).render(<>
    <div id="fit-mannequins" style={{width:640,height:600}}><ShopInterior active section="general" purchase={0} items={shop.items.filter(i=>i.id==='hat_cap')}/></div>
    <div id="fit-arena" style={{width:640,height:600}}><ColosseumScene village={{...village,villagers:[person]}} rows={[{user_id:person.user_id,rank:1,points:1,percent:100}]} open={false} selected={person.user_id} onSelect={()=>{}}/></div>
  </>);
}
