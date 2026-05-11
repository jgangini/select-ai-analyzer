param(
    [switch]$InstallDeps
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot "apps\backend"
$backendPython = Join-Path $repoRoot "apps\backend\.venv\Scripts\python.exe"
$backendRequirements = Join-Path $backendDir "requirements-dev.txt"
$frontendDir = Join-Path $repoRoot "apps\frontend"
$frontendNodeModules = Join-Path $frontendDir "node_modules"

if (!(Test-Path $backendPython)) {
    if (!$InstallDeps) {
        throw "No se encontro el interprete del backend en apps\backend\.venv\Scripts\python.exe. Ejecuta .\scripts\check-project.ps1 -InstallDeps para preparar el entorno."
    }

    Write-Host "Creando entorno virtual del backend..." -ForegroundColor Cyan
    py -3 -m venv (Join-Path $backendDir ".venv")
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo crear el entorno virtual del backend."
    }
}

if ($InstallDeps) {
    Write-Host "Instalando dependencias del backend..." -ForegroundColor Cyan
    & $backendPython -m pip install -r $backendRequirements
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudieron instalar las dependencias del backend."
    }
}

if ($InstallDeps -or !(Test-Path $frontendNodeModules)) {
    Write-Host "Instalando dependencias del frontend..." -ForegroundColor Cyan
    Push-Location $frontendDir
    try {
        npm install
        if ($LASTEXITCODE -ne 0) {
            throw "No se pudieron instalar las dependencias del frontend."
        }
    }
    finally {
        Pop-Location
    }
}

Write-Host "Validando sintaxis del backend..." -ForegroundColor Cyan
Push-Location $repoRoot
try {
    & $backendPython -m compileall -q apps\backend\app
    if ($LASTEXITCODE -ne 0) {
        throw "La compilacion de sintaxis del backend fallo."
    }
}
finally {
    Pop-Location
}

Write-Host "Ejecutando pruebas unitarias backend..." -ForegroundColor Cyan
Push-Location $repoRoot
try {
    & $backendPython -m pytest
    if ($LASTEXITCODE -ne 0) {
        throw "Las pruebas unitarias backend fallaron."
    }
}
finally {
    Pop-Location
}

Write-Host "Validando import del backend..." -ForegroundColor Cyan
& $backendPython -c "from apps.backend.app.main import app; print(app.title)"
if ($LASTEXITCODE -ne 0) {
    throw "El import del backend fallo."
}

Write-Host "Ejecutando pruebas unitarias frontend..." -ForegroundColor Cyan
Push-Location $frontendDir
try {
    npm run test:run
    if ($LASTEXITCODE -ne 0) {
        throw "Las pruebas unitarias frontend fallaron."
    }
}
finally {
    Pop-Location
}

Write-Host "Compilando frontend..." -ForegroundColor Cyan
Push-Location $frontendDir
try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "La compilacion frontend fallo."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "Validacion completada." -ForegroundColor Green
