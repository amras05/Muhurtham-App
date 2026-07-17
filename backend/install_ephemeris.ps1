# Installs the real Swiss Ephemeris (.se1) data files that PyJHora needs but
# does NOT ship in its PyPI package (a known limitation since v3.6.6 — see
# https://github.com/naturalstupid/PyJHora#readme). Without them, PyJHora
# silently falls back to a lower-precision approximation for most
# calculations, and some functions (e.g. the Souramana/solar calendar type)
# fail outright with a missing-file error.
#
# Run this once from PowerShell, with your venv activated:
#   .\install_ephemeris.ps1
#
# Requires git to be installed (https://git-scm.com/download/win).

$ErrorActionPreference = "Stop"

$epheDir = python -c "import jhora, os; print(os.path.join(os.path.dirname(jhora.__file__), 'data', 'ephe'))"
if (-not $epheDir) {
    Write-Error "Could not locate the installed jhora package. Is your venv activated?"
    exit 1
}

Write-Host "PyJHora ephemeris folder: $epheDir"

$existingCount = (Get-ChildItem -Path $epheDir -Filter "*.se1" -ErrorAction SilentlyContinue).Count
if ($existingCount -ge 90) {
    Write-Host "Found $existingCount .se1 files already — looks like this is already installed. Nothing to do."
    exit 0
}

Write-Host "Found only $existingCount .se1 files (expected ~100) — downloading the real data (~104MB)..."

$tmpDir = Join-Path $env:TEMP ([System.Guid]::NewGuid().ToString())
git clone --depth 1 https://github.com/naturalstupid/PyJHora.git $tmpDir

Copy-Item -Path (Join-Path $tmpDir "src\jhora\data\ephe\*.se1") -Destination $epheDir -Force

Remove-Item -Recurse -Force $tmpDir

$newCount = (Get-ChildItem -Path $epheDir -Filter "*.se1").Count
Write-Host "Done. $newCount .se1 files now installed in $epheDir"
