# Regenera data/datos.enc con el código del grupo y, si quieres, lo sube a GitHub.
# El código se pide por pantalla (oculto) y no se guarda en ningún archivo.
param([switch]$SoloCifrar)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Leer-Oculto($mensaje) {
    $s = Read-Host $mensaje -AsSecureString
    return [System.Net.NetworkCredential]::new('', $s).Password
}

if (-not (Test-Path 'data-src')) { throw 'No encuentro la carpeta data-src.' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js no está instalado.' }

if (-not $env:CRUCERO_CODE) {
    $c1 = Leer-Oculto 'Código del grupo'
    $c2 = Leer-Oculto 'Repite el código'
    if (-not $c1 -or $c1 -ne $c2) { throw 'Los códigos no coinciden (o están vacíos). No se ha generado nada.' }
    $env:CRUCERO_CODE = $c1
}

try {
    node build.js
    if ($LASTEXITCODE -ne 0) { throw 'Falló node build.js.' }
} finally {
    Remove-Item Env:CRUCERO_CODE -ErrorAction SilentlyContinue
}

$f = Get-Item 'data\datos.enc'
Write-Host ("data\datos.enc generado: {0} KB, {1}" -f [math]::Round($f.Length / 1KB), $f.LastWriteTime) -ForegroundColor Green

if ($SoloCifrar) { return }

$resp = Read-Host '¿Subir los cambios a GitHub ahora? (s/n)'
if ($resp -match '^[sSyY]') {
    git add -A
    git commit -m "Actualizar datos"
    git push
    Write-Host 'Subido. En 1-2 minutos estará publicado.' -ForegroundColor Green
} else {
    Write-Host 'No se ha subido nada. Cuando quieras: git add -A; git commit -m "Actualizar datos"; git push'
}
