# Reload JS on the connected device without rebuilding native.
# Usage: npm run dev:reload
# Requires Metro already running on port 8081.

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

adb reverse tcp:8081 tcp:8081 2>$null

# Open dev menu then trigger reload via broadcast (works on most RN versions).
adb shell am broadcast -a "com.gathergo.app.RELOAD" 2>$null

# Fallback: shake dev menu shortcut + send reload key to Metro via HTTP
try {
  Invoke-RestMethod -Uri "http://localhost:8081/reload" -Method POST -TimeoutSec 3 | Out-Null
  Write-Host "Reload sent to Metro." -ForegroundColor Green
} catch {
  Write-Host "Could not POST to Metro. Press 'r' in the Metro terminal, or save a file for Fast Refresh." -ForegroundColor Yellow
}
