$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
if (Test-Path infra/.env.prod) { throw 'Run validation in a checkout without infra/.env.prod to avoid using production credentials.' }
$env:POSTGRES_PASSWORD = 'infra-local-disposable'
$env:HTTP_PORT = '18080'
$env:HTTPS_PORT = '18443'
$env:BIND_ADDRESS = '127.0.0.1'
$env:DOMAIN = ':80'
$env:DEMO_AUTH = '0'
$env:VITE_MOCK = '1'
$env:IMESSAGE_ENABLED = '0'
$env:GPU_WORKER_URL = 'http://127.0.0.1:8100/health'
$env:COMPOSE_PROJECT_NAME = 'village-infra001-test'
$composeArgs = @('-p', 'village-infra001-test', '-f', 'infra/compose.prod.yml')
function Compose {
    & docker compose @composeArgs @args
    if ($LASTEXITCODE -ne 0) { throw "docker compose command failed with exit $LASTEXITCODE" }
}
try {
    Compose config --quiet
    Compose up -d --build --wait --wait-timeout 240
    $health = Invoke-RestMethod http://127.0.0.1:18080/api/health
    if (-not $health.ok -or $health.db -ne 'up' -or $health.gpu_worker -ne 'down') { throw 'Unexpected API health' }
    $page = Invoke-WebRequest -UseBasicParsing http://127.0.0.1:18080/
    if ($page.StatusCode -ne 200 -or $page.Content -notmatch '<div id="root">') { throw 'Static site failed' }
    $deep = Invoke-WebRequest -UseBasicParsing http://127.0.0.1:18080/village/demo
    if ($deep.Content -ne $page.Content) { throw 'SPA fallback failed' }
    $status = & curl.exe -s -o NUL -w '%{http_code}' http://127.0.0.1:18080/api/me
    if ($LASTEXITCODE -ne 0 -or $status -ne '401') { throw 'Production API must require authentication' }
    Compose exec -T web caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
    Compose exec -T -e DOMAIN=demo.example.com web caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
    "await import('spectrum-ts'); await import('@spectrum-ts/imessage'); console.log('Agent imports resolve')" | docker compose @composeArgs exec -T imessage bun run -
    if ($LASTEXITCODE -ne 0) { throw 'Agent import check failed' }
    & bash infra/seed-assets.sh infra/no-assets-present
    if ($LASTEXITCODE -ne 0) { throw 'Empty asset seed failed' }
    & bash infra/seed-assets.sh infra/test-assets
    if ($LASTEXITCODE -ne 0) { throw 'Asset copy failed' }
    $asset = & docker compose @composeArgs exec -T api cat /app/data/assets/avatars/synthetic.txt
    if ($LASTEXITCODE -ne 0 -or $asset -ne 'Synthetic infrastructure test asset; contains no person or generated media.') { throw 'Asset copy content mismatch' }
    # Exercise the existing API with demo auth only on loopback and synthetic fixtures.
    $env:DEMO_AUTH = '1'
    Compose up -d --wait --wait-timeout 120 api
    $headers = @{ 'X-Demo-User' = '13370000-0000-4000-8000-000000000001' }
    $me = Invoke-RestMethod http://127.0.0.1:18080/api/me -Headers $headers
    if ($me.villages.Count -lt 1) { throw 'Fixture seed unavailable' }
    $village = Invoke-RestMethod 'http://127.0.0.1:18080/api/villages/13370000-0000-4000-8000-000000000000' -Headers $headers
    if ($village.villagers.Count -ne 5) { throw 'Expected five fixture avatars' }
    Compose restart api
    Compose up -d --wait --wait-timeout 120 api
    $me = Invoke-RestMethod http://127.0.0.1:18080/api/me -Headers $headers
    if ($me.villages.Count -lt 1) { throw 'Database persistence failed after restart' }
    Write-Output 'PASS: build, health, GPU-offline fallback, static/SPA routing, auth, agent imports, seed and persistence.'
} finally {
    Compose down -v --remove-orphans
}
