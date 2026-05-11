param(
    [switch]$InstallFrontendDeps,
    [switch]$NoReload,
    [switch]$ExternalWindows
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$cleanupScript = Join-Path $PSScriptRoot "dev-cleanup.ps1"
$backendPython = Join-Path $repoRoot "apps\backend\.venv\Scripts\python.exe"
$frontendDir = Join-Path $repoRoot "apps\frontend"
$frontendNodeModules = Join-Path $frontendDir "node_modules"

if (!(Test-Path $backendPython)) {
    throw "No se encontro el interprete del backend en apps\backend\.venv\Scripts\python.exe"
}

if (!(Test-Path (Join-Path $frontendDir "package.json"))) {
    throw "No se encontro apps\frontend\package.json"
}

if ($InstallFrontendDeps -or !(Test-Path $frontendNodeModules)) {
    Write-Host "Instalando dependencias del frontend..." -ForegroundColor Cyan
    Push-Location $frontendDir
    try {
        npm install
    }
    finally {
        Pop-Location
    }
}

if (Test-Path $cleanupScript) {
    Write-Host "Cleaning zombie dev processes..." -ForegroundColor Cyan
    & $cleanupScript
}

$isIntegratedTerminal = $env:TERM_PROGRAM -eq "vscode" -or [bool]$env:VSCODE_PID

$backendArgs = @(
    "-u",
    "-m",
    "apps.backend.app.dev.server_runner",
    "--host",
    "127.0.0.1",
    "--port",
    "8012"
)
if ($NoReload) {
    $backendArgs += "--no-reload"
} else {
    $backendArgs += "--reload"
}
$backendReloadSuffix = if ($NoReload) { " --no-reload" } else { " --reload" }

$quotedBackendArgs = $backendArgs | ForEach-Object { "'" + ($_ -replace "'", "''") + "'" }
$backendCommand = "& { " +
    "`$env:PYTHONPATH = '" + ($repoRoot -replace "'", "''") + "'; " +
    "& '" + ($backendPython -replace "'", "''") + "' " + ($quotedBackendArgs -join " ") +
    " }"

$frontendCommand = "& { Set-Location '" + ($frontendDir -replace "'", "''") + "'; npm run dev }"

if ($isIntegratedTerminal -and !$ExternalWindows) {
    Write-Host "Cursor/VS Code detectado." -ForegroundColor Yellow
    Write-Host "Este script no puede abrir terminales integradas del editor directamente." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Usa la tarea:" -ForegroundColor Cyan
    Write-Host "  Dev: Start Project"
    Write-Host ""
    Write-Host "O ejecuta manualmente en dos terminales integradas:" -ForegroundColor Cyan
    Write-Host "Terminal 1 (backend):"
    Write-Host "  `$env:PYTHONPATH='$repoRoot'; `$env:PYTHONUNBUFFERED='1'; & '$backendPython' -u -m apps.backend.app.dev.server_runner --host 127.0.0.1 --port 8012$backendReloadSuffix"
    Write-Host ""
    Write-Host "Terminal 2 (frontend):"
    Write-Host "  Set-Location '$frontendDir'; npm run dev"
    Write-Host ""
    Write-Host "Si aun quieres ventanas externas, ejecuta: .\dev.ps1 -ExternalWindows"
    return
}

Write-Host "Abriendo backend en una nueva consola..." -ForegroundColor Green
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    $backendCommand
)

Write-Host "Abriendo frontend en una nueva consola..." -ForegroundColor Green
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    $frontendCommand
)

Write-Host ""
Write-Host "Proyecto iniciado." -ForegroundColor Green
Write-Host "Backend:  http://127.0.0.1:8012/"
Write-Host "Frontend: http://localhost:5174/"
Write-Host "Si el frontend muestra errores proxy al inicio, revisa los logs del backend y recarga la pagina cuando el API quede disponible."
