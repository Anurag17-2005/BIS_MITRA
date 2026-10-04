# Local browser stack: clone :4000, admin API :5050, admin UI :5001, user portal :5002
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

foreach ($p in 4000, 5050, 5001, 5002) {
  Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}
Start-Sleep -Seconds 2

if (-not (Test-Path "$root\bis-clone\data\bis-clone.db")) {
  Copy-Item "$root\bis-clone\data\bis-clone.seed.db" "$root\bis-clone\data\bis-clone.db" -Force
}

Write-Host "Starting clone API on http://localhost:4000 ..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\bis-clone'; `$env:PORT=4000; npm run start -w api"

Start-Sleep -Seconds 3

Write-Host "Starting admin API on http://localhost:5050 ..."
$envFile = "$root\bis-mitra-admin\.env"
$adminCmd = @"
cd '$root\bis-mitra-admin\api'
if (Test-Path '$envFile') { Get-Content '$envFile' | ForEach-Object { if (`$_ -match '^\s*([^#=]+)=(.*)$') { Set-Item -Path ""env:`$(`$matches[1].Trim())"" -Value `$matches[2].Trim() } } }
`$env:PORT='5050'; `$env:CLONE_API='http://127.0.0.1:4000'; `$env:LLM_PROVIDER='groq'; `$env:DISABLE_ADMIN_AUTH='1'
node server.js
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $adminCmd

Start-Sleep -Seconds 4

Write-Host "Starting admin UI on http://localhost:5001 ..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\bis-mitra-admin'; npm run dev:frontend"

Write-Host "Starting user portal on http://localhost:5002 ..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\bis-mitra-user'; npm run dev"

Start-Sleep -Seconds 6

Write-Host "Publishing proof-actions-sandbox for agent chat..."
Push-Location "$root\bis-mitra-admin"
$env:ADMIN_API = "http://127.0.0.1:5050"
node -e "import { publishCluster, portalConfig } from './api/tests/helpers/cluster-api.mjs'; await publishCluster('proof-actions-sandbox', true); console.log(await portalConfig());"
Pop-Location

Write-Host ""
Write-Host "Open in browser:"
Write-Host "  User portal (chat):  http://localhost:5002"
Write-Host "  Admin maintainer:    http://localhost:5001"
Write-Host "  Admin API health:    http://localhost:5050/api/health"
Write-Host ""
Write-Host "Tip: In admin, Clusters opens the list (no cluster selected until you click one)."
Write-Host "     Agent preview uses the published cluster (Proof Actions Sandbox)."
