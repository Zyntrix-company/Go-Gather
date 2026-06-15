# Full Android dev start: clear Metro port, adb reverse, Metro (reset cache), install app.
# Usage: npm run dev:reset

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "==> Checking adb device..." -ForegroundColor Cyan
adb devices

Write-Host "==> Freeing Metro port 8081..." -ForegroundColor Cyan
npx kill-port 8081 2>$null

Write-Host "==> adb reverse (wireless/USB dev server)..." -ForegroundColor Cyan
adb reverse tcp:8081 tcp:8081

Write-Host "==> Starting Metro with --reset-cache in a new window..." -ForegroundColor Cyan
$metroCmd = "Set-Location '$PWD'; npx react-native start --reset-cache"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $metroCmd

Write-Host "==> Waiting for Metro to boot (12s)..." -ForegroundColor Cyan
Start-Sleep -Seconds 12

Write-Host "==> Building and installing app (--no-packager)..." -ForegroundColor Cyan
npx react-native run-android --no-packager

Write-Host ""
Write-Host "Done. Keep the Metro window open." -ForegroundColor Green
Write-Host "  Hot reload: save a file (Fast Refresh) or press 'r' in the Metro window." -ForegroundColor Green
Write-Host "  Full JS reset: npm run dev:reset" -ForegroundColor Green
Write-Host "  Quick reload only: npm run dev:reload" -ForegroundColor Green
