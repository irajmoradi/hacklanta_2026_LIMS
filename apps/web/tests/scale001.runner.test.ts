import {test, expect} from 'bun:test';
import {createServer} from 'vite';

// No fixed ports, shared test database, or live API. This isolated Bun test can
// use the runner's independent-web lane without colliding with other browsers.
test('SCALE-001 isolated browser benchmark', async () => {
  process.env.VILLAGE_ENV_FILE='/dev/null';
  process.env.VILLAGE_API_URL='http://127.0.0.1:1';
  process.env.VITE_MOCK='1';
  const stages=process.env.SCALE_STAGE ? [process.env.SCALE_STAGE] : ['before','after'];
  expect(stages.every(stage=>stage==='before' || stage==='after')).toBe(true);
  for (const stage of stages) {
    process.env.SCALE_LABEL=stage;
    const server=await createServer({configFile:'tests/scale001.vite.config.ts',
      server:{host:'127.0.0.1',port:0,strictPort:false}});
    try {
      await server.listen();
      const address=server.httpServer!.address();
      if(!address || typeof address==='string') throw new Error('Missing isolated browser port');
      const child=Bun.spawn(['bunx','playwright','test','--config','tests/scale001.config.ts','--max-failures=1'],{
        env:{...process.env,SCALE_URL:`http://127.0.0.1:${address.port}`,SCALE_LABEL:stage},
        stdout:'inherit',stderr:'inherit',
      });
      expect(await child.exited,`${stage} browser suite`).toBe(0);
    } finally {await server.close();}
  }
},600000);
