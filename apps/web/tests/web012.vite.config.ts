import { mergeConfig } from 'vite';
import { resolve } from 'node:path';
import base from '../vite.config';

// Test-only hooks replace all wallet/RPC operations; never included by the production config.
export default mergeConfig(base, {
  cacheDir: `node_modules/.vite-web012-${process.env.WEB012_VARIANT}`,
  resolve: { alias: process.env.WEB012_VARIANT === '5184' ? {} : {
    '@village/pot-client/react': resolve('src/components/pot/testing/MockWallet.tsx'),
    '@solana/kit-plugin-wallet/react': resolve('src/components/pot/testing/MockWallet.tsx'),
  } },
});
