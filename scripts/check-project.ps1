$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendPython = Join-Path $repoRoot "apps\backend\.venv\Scripts\python.exe"
$frontendDir = Join-Path $repoRoot "apps\frontend"

if (!(Test-Path $backendPython)) {
    throw "No se encontro el interprete del backend en apps\backend\.venv\Scripts\python.exe"
}

Write-Host "Validando import del backend..." -ForegroundColor Cyan
& $backendPython -c "from apps.backend.app.main import app; print(app.title)"

Write-Host "Compilando frontend..." -ForegroundColor Cyan
Push-Location $frontendDir
try {
    npm run build
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "Validacion completada." -ForegroundColor Green
