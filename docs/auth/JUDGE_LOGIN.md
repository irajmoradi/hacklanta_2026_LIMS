# Two-laptop sign-in demo (FEAT-029)

The team drives this demo; judges watch. Each teammate uses their own Auth0
Universal Login account. Nobody generates, shares, or posts account passwords.
Sign-up uses the tenant's enabled database or social connection.

## Operator preparation

Apply the release's normal API migrations (`python -m uv run python -m scripts.migrate` from
`apps/api`). Migration 059 is additive and idempotent and is folded into the
baseline schema. 058 is the separate repair-task migration; this release runs through 059.

Use an authorized operator terminal with `VILLAGE_ENV_FILE` pointing to the
existing secret env file. The CLI reads it at runtime, never copies it. For example:

```bash
cd apps/api
python -m uv run python -m scripts.claim_codes --village 13370000-0000-4000-8000-000000000000 --seat 13370000-0000-4000-8000-000000000001
```

Resolve the other teammates' actual seat IDs from the village roster; do not
guess the name-to-ID order. Issue a separate code for each of Iraj, Lance,
Stefanny, and Mario. The CLI prints the complete code once, after commit. Give
it privately to that teammate; do not put it in tickets, screenshots, logs, or
this guide. Codes expire after 72 hours. Reissuing revokes earlier codes for
that seat. Claimed seats cannot receive another code.

This branch does not issue production codes or change production accounts.
No code is needed after the first successful claim. The account-to-seat link
preserves the seat's UUID, avatar, house, membership, progress, and possessions.
Accounts already in a village cannot claim another seat. There is deliberately
no automatic merge or reassignment workflow.

## Rehearsal and judging

Sign in is hidden in the shipped build by default. Complete the owner-approved
configuration/rebuild below before this rehearsal; use a scratch village for tests.

1. Laptop A: open the site, choose **Sign in** (also available inside the first
   Play as picker), and sign up/sign in as Iraj. Enter Iraj's whole claim code
   on **Claim your villager**. Check the profile name and house.
2. Laptop B: use Mario's own account and Mario's code. Check that this is Mario's
   seat. Separate browser profiles also work for rehearsal; two tabs in one
   profile are not two independent Auth0 sessions.
3. In the same village, walk toward each other. Each laptop should see the
   other's movement and emote. Connections have independent keys; opening and
   closing a second tab must not disconnect the first.
4. Enter the Hall on both laptops. Place or move a decoration on A and watch it
   update on B. The creator must be A's actual seat. Repeat a move on B.
5. Reload both. Each account returns to its own seat, and Hall decoration and
   village progress remain persisted. Movement presence is transient; an avatar
   need not resume an exact mid-walk coordinate after reconnecting.
6. Open Settings and **Sign out** on one laptop. Play as remains available.
   Leave the other laptop signed in to demonstrate both modes at once.

Use a scratch/test village for rehearsal debug actions. Never use resets,
disasters, or Mayor debug events on the shared live village. Generated assets
and the GPU are not required. An account without a team code can choose
**No code? Create or join a village** and use normal onboarding.

## Production configuration (operator action; not deployed by this task)

Keep these server values:

```dotenv
DEMO_AUTH=1
AUTH0_DOMAIN=dev-p5wloya5y7fhknys.us.auth0.com
AUTH0_AUDIENCE=https://api.village.local
```

Build the browser with these public values (no client secret belongs in the SPA):

```dotenv
VITE_MOCK=0
VITE_DEMO_AUTH=1
VITE_AUTH0_ENABLED=1
VITE_AUTH0_DOMAIN=dev-p5wloya5y7fhknys.us.auth0.com
VITE_AUTH0_CLIENT_ID=r6wfPGrs5a9pFJ3ukDuDuB06jzkZdACO
VITE_AUTH0_AUDIENCE=https://api.village.local
```

In Auth0's existing **Village Web** SPA, append these without removing local
development entries:

- Allowed Callback URLs: `https://thefriendshipvillage.vodka`
- Allowed Logout URLs: `https://thefriendshipvillage.vodka`
- Allowed Web Origins: `https://thefriendshipvillage.vodka`
- Allowed Origins (CORS), if configured: `https://thefriendshipvillage.vodka`

Keep **Village API**'s identifier `https://api.village.local` and RS256 signing.
Enable the intended database sign-up or social connection for Village Web.
The SDK owns token renewal and keeps tokens in memory; application code never
stores bearer tokens in localStorage. Reload uses the Auth0 session for silent
authentication. Verify these tenant settings before the live rehearsal; the
automated tests intentionally make no real tenant calls.

`ops/deploy/prod-deploy.py` reads only the three public Auth0 values from the
existing runtime env file and forwards the public enable flag from the process
environment (default `0`). It still builds with demo mode enabled. Follow the
normal reviewed deployment process; this task did not run it.

To hide Sign in again, set **process environment** `VITE_AUTH0_ENABLED=0` before
the normal deployment/build. This is a build-time flag, so rebuild the web app.
Keep `VITE_DEMO_AUTH=1` and server `DEMO_AUTH=1`; do not erase account links or
claim tables. Restore `VITE_AUTH0_ENABLED=1` and rebuild to show Sign in again.
Raw Vite enables configured Auth0 when the flag is unset and mock mode is off;
set the flag explicitly outside production tooling. Hiding the button does not revoke Auth0 sessions or disable the server's bearer
validation. Never set DEMO_AUTH=0 for this requested combined demo experience.

## Verification

From `apps/api`, run through the remote runner:

```bash
../../ops/remote_run.sh python -m uv run pytest -q tests/test_feat029.py tests/test_providers_auth.py tests/test_realtime.py tests/test_feat019.py
```

From `apps/web`:

```bash
../../ops/remote_run.sh bun test src/api/auth.test.ts
../../ops/remote_run.sh bun run test
../../ops/remote_run.sh bun run build
../../ops/remote_run.sh bunx playwright test --config tests/feat029.config.ts
```

The browser config aliases Auth0 to a synthetic SDK only in the test build and
mocks all API traffic. It never contacts the tenant or live demo. Screenshots
are under `apps/web/tests/screenshots/feat029-*.png`. API tests use synthetic
RS256 tokens, real scratch PostgreSQL, and actual HTTP/WebSocket handlers.
