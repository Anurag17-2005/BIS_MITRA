# Create/update Render web services from repo (requires GitHub repo on main with render.yaml pushed).
# Requires: $env:RENDER_API_KEY

$ErrorActionPreference = "Stop"
if (-not $env:RENDER_API_KEY) {
  Write-Error "Set RENDER_API_KEY first (Render → Account Settings → API Keys)."
}

$headers = @{
  Authorization = "Bearer $env:RENDER_API_KEY"
  Accept        = "application/json"
  "Content-Type" = "application/json"
}

$owners = Invoke-RestMethod -Uri "https://api.render.com/v1/owners" -Headers $headers
$ownerId = $owners[0].owner.id
Write-Host "Render owner: $ownerId"

$repo = "https://github.com/Anurag17-2005/BIS_MITRA"
$branch = "main"

function New-RenderWebService {
  param(
    [string]$Name,
    [string]$RootDir,
    [string]$Build,
    [string]$Start,
    [string]$Health = "/api/health"
  )
  $body = @{
    type     = "web_service"
    name     = $Name
    ownerId  = $ownerId
    repo     = $repo
    branch   = $branch
    rootDir  = $RootDir
    serviceDetails = @{
      env              = "node"
      plan             = "free"
      region           = "oregon"
      buildCommand     = $Build
      startCommand     = $Start
      healthCheckPath  = $Health
    }
  } | ConvertTo-Json -Depth 6

  try {
    $svc = Invoke-RestMethod -Method Post -Uri "https://api.render.com/v1/services" -Headers $headers -Body $body
    Write-Host "Created $($svc.service.name): $($svc.service.serviceDetails.url)" -ForegroundColor Green
    return $svc.service
  } catch {
    Write-Warning "Create $Name failed (may already exist): $($_.Exception.Message)"
    $list = Invoke-RestMethod -Uri "https://api.render.com/v1/services?limit=50" -Headers $headers
    return ($list | ForEach-Object { $_.service } | Where-Object { $_.name -eq $Name } | Select-Object -First 1)
  }
}

New-RenderWebService -Name "bis-mitra-clone-api" -RootDir "bis-clone" `
  -Build "npm ci && node scripts/seed.js" `
  -Start "npm run start -w api"

New-RenderWebService -Name "bis-mitra-admin-api" -RootDir "bis-mitra-admin" `
  -Build "cd ../bis-clone && npm ci && node scripts/seed.js && cd ../bis-mitra-admin && npm ci && OCR_ENABLED=0 npm run build:demo" `
  -Start "npm run start:api"

Write-Host "`nSet in Render dashboard: GROQ_API_KEY on admin service; then CLONE_API, MITRA_ADMIN_URL, CLONE_PUBLIC_URL, BIS_WEB, MANAK_APPLICATIONS_URL, STANDARDS_URL (see docs/DEPLOY.md)."
