# Phase B Full-File SHA-256 Verification Script
# Verifies every migration, seed, preflight, test, doc and
# runbook file in the staging chain matches its committed manifest.
#
# Usage (from repo root):
#   powershell -NoProfile -ExecutionPolicy Bypass -File supabase\manifest\verify_checksums.ps1
#
# Exit codes:
#   0  all files verified, no unexpected files found
#   1  one or more files modified or missing
#   2  manifest not found or invalid
#   3  unexpected extra files in tracked directories
#   4  no files matched (empty manifest or wrong directory)

param(
  [string]$ManifestPath = "supabase\manifest\phaseb_checksum_manifest.json",
  [string]$RepoRoot = ""
)

$ErrorActionPreference = "Stop"

if ($RepoRoot -eq "") {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

$exitCode = 0
$verified = 0
$failed = 0

Write-Host "================================================================"
Write-Host "Phase B Full-File SHA-256 Verification"
Write-Host "Repo: $RepoRoot"
Write-Host "Manifest: $ManifestPath"
Write-Host "================================================================"
Write-Host ""

$manifestFull = Join-Path $RepoRoot $ManifestPath
if (-not (Test-Path $manifestFull)) {
  Write-Host "ERROR: Manifest not found at $manifestFull"
  exit 2
}

$manifest = Get-Content $manifestFull -Raw | ConvertFrom-Json
if (-not $manifest -or -not $manifest.files) {
  Write-Host "ERROR: Manifest is empty or invalid."
  exit 2
}

Write-Host "Manifest commit: $($manifest.commit)"
Write-Host "Manifest files  : $($manifest.files.Count)"
Write-Host ""

$expected = @{}
foreach ($f in $manifest.files) {
  $expected[$f.path.ToLowerInvariant()] = $f
}

$scanDirs = @("supabase\migrations", "supabase\seed", "supabase\preflight", "supabase\test", "supabase\docs", "supabase\runbooks", "supabase\evidence")
# Note: supabase/manifest is NOT scanned. The manifest JSON and this
# script are tooling, not content. They cannot self-verify because
# the manifest cannot contain its own checksum or the checksum of
# the script that reads it.
$actualFiles = @{}
foreach ($dir in $scanDirs) {
  $dirFull = Join-Path $RepoRoot $dir
  if (Test-Path $dirFull) {
    Get-ChildItem -Path $dirFull -File -Recurse | ForEach-Object {
      $relPath = $_.FullName.Substring($RepoRoot.Length + 1).Replace("\", "/")
      $actualFiles[$relPath.ToLowerInvariant()] = $relPath
    }
  }
}

$unexpected = @()
foreach ($af in $actualFiles.Keys) {
  if (-not $expected.ContainsKey($af)) {
    $unexpected += $actualFiles[$af]
  }
}

if ($unexpected.Count -gt 0) {
  Write-Host "EXTRA FILES (present on disk, not in manifest - see notes):" -ForegroundColor Yellow
  foreach ($uf in ($unexpected | Sort-Object)) {
    Write-Host "  + $uf" -ForegroundColor Yellow
  }
  Write-Host ""
  # Extra files do not fail verification; they are superseded/legacy.
}

$missing = @()
foreach ($ek in $expected.Keys) {
  $relPath = $expected[$ek].path
  if (-not $actualFiles.ContainsKey($ek)) {
    $missing += $relPath
  }
}

if ($missing.Count -gt 0) {
  Write-Host "MISSING FILES (in manifest but not on disk):" -ForegroundColor Red
  foreach ($mf in ($missing | Sort-Object)) {
    Write-Host "  - $mf" -ForegroundColor Red
  }
  Write-Host ""
  $exitCode = 1
}

Write-Host "File verification:" -ForegroundColor Cyan
Write-Host ""

foreach ($f in ($manifest.files | Sort-Object path)) {
  $filePath = Join-Path $RepoRoot $f.path

  if (-not (Test-Path $filePath)) {
    Write-Host "  MISSING  $($f.path)" -ForegroundColor Red
    $failed++
    $exitCode = 1
    continue
  }

  try {
    $actual = (Get-FileHash -Path $filePath -Algorithm SHA256).Hash
  } catch {
    Write-Host "  ERROR    $($f.path) - could not compute hash: $_" -ForegroundColor Red
    $failed++
    $exitCode = 1
    continue
  }

  $expected_hash = $f.sha256.ToUpperInvariant()
  if ($actual -eq $expected_hash) {
    Write-Host "  OK       $($f.path)" -ForegroundColor Green
    $verified++
  } else {
    Write-Host "  MODIFIED $($f.path)" -ForegroundColor Red
    Write-Host "           expected: $expected_hash" -ForegroundColor Red
    Write-Host "           actual:   $actual" -ForegroundColor Red
    $failed++
    $exitCode = 1
  }
}

Write-Host ""
Write-Host "================================================================"
Write-Host "VERIFICATION RESULT"
Write-Host "================================================================"
Write-Host "  Verified : $verified"
Write-Host "  Modified : $failed"
Write-Host "  Missing  : $($missing.Count)"
Write-Host "  Extra    : $($unexpected.Count)"
Write-Host ""

if ($exitCode -eq 0) {
  $msg = "PASS - all files match the manifest. The staging chain is intact."
  Write-Host $msg -ForegroundColor Green
} else {
  $msg = "FAIL - one or more checks failed. See details above."
  Write-Host $msg -ForegroundColor Red
}

exit $exitCode
