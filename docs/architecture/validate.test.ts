import { test, expect } from 'bun:test';

test('README commands, Mermaid renders and web checks on isolated runner resources', () => {
  const result = Bun.spawnSync(['python', '../../docs/architecture/isolated_validation.py'], {
    cwd: process.cwd(), stdout: 'inherit', stderr: 'inherit',
  });
  expect(result.exitCode).toBe(0);
}, 900000);
