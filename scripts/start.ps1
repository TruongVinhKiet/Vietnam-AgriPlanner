# AgriPlanner Development Server
# PowerShell script to start server and open Chrome

Set-Location "$PSScriptRoot/.."

$port = 8000
$url = "http://localhost:$port"

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "   AgriPlanner - Development Server" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""

# Check if port is in use
$portInUse = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "[WARNING] Port $port is already in use." -ForegroundColor Yellow
    Write-Host "Opening browser to existing server..." -ForegroundColor Yellow
    Start-Process "chrome" $url
    exit
}

Write-Host "[INFO] Starting server on $url" -ForegroundColor Cyan
Write-Host "[INFO] Opening Chrome browser..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the server." -ForegroundColor Gray
Write-Host "================================================" -ForegroundColor Gray
Write-Host ""

# Open Chrome after 2 second delay in background
$job = Start-Job -ScriptBlock {
    param($url)
    Start-Sleep -Seconds 2
    Start-Process "chrome" $url
} -ArgumentList $url

# Start Python HTTP server
try {
    python -m http.server $port
} catch {
    Write-Host ""
    Write-Host "[ERROR] Failed to start server. Make sure Python is installed." -ForegroundColor Red
    Write-Host "Download from: https://www.python.org/downloads/" -ForegroundColor Yellow
}

# Clean up job
Remove-Job $job -Force -ErrorAction SilentlyContinue
