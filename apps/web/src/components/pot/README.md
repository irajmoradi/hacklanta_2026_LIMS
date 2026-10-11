# Devnet wallet panel

This component mounts a separate React 19 root inside the React 18 village. The
pot client and Wallet Standard React bindings require React 19; the existing R3F
village remains on React 18. Only a DOM element and strings cross that boundary.
The web app's `postinstall` automatically installs this package with npm using
its committed lockfile. Node.js 20.18+ and npm must be available alongside Bun.

From the repository root:

```powershell
Push-Location apps/web
bun install --frozen-lockfile
bun run build
Pop-Location
```

The hook uses `npm ci --install-links` to copy the local pot package and resolve its dependencies
against this React 19 installation. No source is copied into tracked files.
After a pot-client source change, repeat `bun install` in `apps/web` to refresh that local copy.
The lockfile pins the browser dependencies. Bun's local-package copy failed with
EPERM on this Windows machine; the documented npm install was verified cleanly.

The UI loads the wallet code only after **Join pot with wallet** is selected,
with `VITE_SOLANA_PROGRAM_ID` set and a competition's `pot_address` supplied.
The public RPC is fixed to `https://api.devnet.solana.com`; the SDK checks devnet
genesis and validates the pot, wallet, simulation, fees, review expiry and bytes.
Simulation and signature approval are separate actions. The SDK signs only;
neither this panel nor the SDK broadcasts or marks a competition joined.
Missing deployment/pot metadata has an explicit waiting state.

`testing/MockWallet.tsx` is used only by the WEB-012 Vite test configuration.
Production imports `@village/pot-client/react` directly. Each browser-test variant
has its own dependency cache so mocked and real modules cannot overwrite each
other's optimized dependencies.
