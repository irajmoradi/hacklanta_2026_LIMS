import type { BrowserContext, WebSocketRoute } from '@playwright/test';
import { makeFixtures } from '../src/api/fixtures';
import type { Item } from '../src/scene/interior';

// In-process transport only: no API, database, real photos, or generated assets.
export async function mockFeat019(contexts: BrowserContext | BrowserContext[]) {
  const owner = '13370000-0000-4000-8000-000000000001';
  const vid = '13370000-0000-4000-8000-000000000000';
  const photo = 'fe190000-0000-4000-8000-000000000001';
  const triangle = Buffer.from(new Float32Array([-.4,0,0, .4,0,0, 0,.8,0]).buffer).toString('base64');
  const {village} = makeFixtures();
  village.id = vid;
  village.owner_user_id = owner;
  village.villagers.forEach((p, i) => {
    p.user_id = `13370000-0000-4000-8000-00000000000${i+1}`;
    p.house_level = 4;
  });
  // Keep the Node test transport independent of Vite's JSON module loader.
  const starterPositions: [string, number, number][] = [
    ['sofa', -2, -2], ['coffee_table', -2, 0], ['bed', 2, -2],
    ['plant_fern', 3, 2], ['rug_round', -2, 0],
  ];
  const home = starterPositions.map(([kind, x, z]) => ({item_id:kind, kind, x, z, rot:0, stashed:false, seq:0}));
  const rooms = new Map<string, Item[]>([[owner, home], [vid, []]]);
  const clients = new Set<{ws: WebSocketRoute; room: string; user: string}>();
  let seq = 0;
  const snapshot = (room: string, user: string) => ({
    items: rooms.get(room) ?? [], seq, can_edit: room === vid || room === user,
    can_remove_any: user === owner, floors: room === vid ? 2 : 3, owned: [],
    custom_items: user === owner ? [{id:photo, glb_url:`/api/assets/items/${photo}/object.glb`, preview:'/mock-photo.svg', display_name:'Fixture owner'}] : [],
  });
  for (const context of Array.isArray(contexts) ? contexts : [contexts]) {
  await context.route('**/mock-photo.svg', route => route.fulfill({contentType:'image/svg+xml', body:'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#809485"/></svg>'}));
  await context.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/object.glb')) {
      await route.fulfill({contentType:'model/gltf+json', json:{asset:{version:'2.0'}, scene:0, scenes:[{nodes:[0]}], nodes:[{name:'Synthetic photo object', mesh:0}],
        meshes:[{primitives:[{attributes:{POSITION:0}}]}], buffers:[{uri:`data:application/octet-stream;base64,${triangle}`, byteLength:36}],
        bufferViews:[{buffer:0, byteLength:36}], accessors:[{bufferView:0, componentType:5126, count:3, type:'VEC3', min:[-.4,0,0], max:[.4,.8,0]}]}});
    } else if (url.pathname === `/api/villages/${vid}`) {
      await route.fulfill({json:village});
    } else if (url.pathname.startsWith('/api/houses/')) {
      await route.fulfill({json:snapshot(url.pathname.split('/')[3], route.request().headers()['x-demo-user'])});
    } else {
      await route.fulfill({json:[]});
    }
  });
  await context.routeWebSocket('**/api/houses/*/live?*', ws => {
    const room = new URL(ws.url()).pathname.split('/')[3];
    let client: {ws: WebSocketRoute; room: string; user: string};
    ws.onMessage(raw => {
      const data = JSON.parse(String(raw));
      if (data['X-Demo-User']) {
        client = {ws, room, user:data['X-Demo-User']};
        clients.add(client);
        ws.send(JSON.stringify({type:'snapshot', client_id:client.user, ...snapshot(room,client.user)}));
      } else if (data.type === 'movement') {
        // Match the current API: optional y is stripped during validation.
        const {y, ...position} = data;
        for (const peer of clients) if (peer.room === room) peer.ws.send(JSON.stringify({...position,user_id:client.user,name:client.user===owner?'Iraj':'Lance'}));
      } else if (data.action) {
        const prior = rooms.get(room)!.find(i => i.item_id === data.item_id);
        const item: Item = {...prior, item_id:data.item_id, kind:data.kind, x:data.x, z:data.z, rot:data.rot, floor:data.floor, stashed:data.action === 'stash_item', seq:++seq,
          creator:prior?.creator ?? client.user, ...(data.kind === photo ? {model_url:`/api/assets/items/${photo}/object.glb`} : {})};
        rooms.set(room, [...rooms.get(room)!.filter(i=>i.item_id !== item.item_id), item]);
        for (const peer of clients) if (peer.room === room) peer.ws.send(JSON.stringify({type:'delta', item, seq, client_id:client.user, user_id:client.user, client_seq:data.client_seq}));
      }
    });
    ws.onClose(()=>clients.delete(client));
  });
  }
}
