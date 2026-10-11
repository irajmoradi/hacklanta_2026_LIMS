import {expect, test} from 'bun:test';
import {fileURLToPath} from 'node:url';

// This suite visits the public deployment only: no Vite/API process, bound port,
// scratch DB, or shared local service. It is an independent web test on the runner.
test('QA-011 guarded public desktop browser traversal', async () => {
  const file = ({catalog:'catalog.cjs',toasts:'toasts.cjs',details:'details.cjs',followups:'followups.cjs'} as Record<string,string>)[process.env.QA_SUITE ?? ''] ?? 'audit.cjs';
  const child = Bun.spawn(['node', fileURLToPath(new URL(file, import.meta.url))], {
    stdout: 'inherit', stderr: 'inherit', env: process.env,
  });
  expect(await child.exited).toBe(0);
});
