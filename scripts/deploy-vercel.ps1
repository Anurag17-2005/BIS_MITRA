# Deploy all Vercel frontends. Requires: $env:VERCEL_TOKEN
# Set VITE_* before first prod deploy, or redeploy after Render URLs exist (see docs/DEPLOY.md).

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent

if (-not $env:VERCEL_TOKEN) {
  Write-Error "Set VERCEL_TOKEN first (Vercel → Account → Tokens)."
}

$apps = @(
  @{ Name = "bis-mitra-user"; Path = "bis-mitra-user" },
  @{ Name = "bis-mitra-admin-ui"; Path = "bis-mitra-admin/frontend" },
  @{ Name = "bis-clone-bis"; Path = "bis-clone/apps/bis-web" },
  @{ Name = "bis-clone-manak"; Path = "bis-clone/apps/manak-web" },
  @{ Name = "bis-clone-standards"; Path = "bis-clone/apps/standards-web" }
)

foreach ($app in $apps) {
  $dir = Join-Path $Root $app.Path
  Write-Host "`n=== Vercel: $($app.Name) ($($app.Path)) ===" -ForegroundColor Cyan
  Push-Location $dir
  npx --yes vercel@41 deploy --prod --yes --token $env:VERCEL_TOKEN --name $app.Name
  Pop-Location
}

Write-Host "`nDone. Copy production URLs from Vercel dashboard and update Render + VITE_* env vars (docs/DEPLOY.md)." -ForegroundColor Green
