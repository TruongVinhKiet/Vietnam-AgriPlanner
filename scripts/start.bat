@echo off
cd ..
title AgriPlanner Dev Server
echo ================================================
echo   AgriPlanner - Development Server
echo ================================================
echo.

:: Check if Python is installed
python --version >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Python not found. Please install Python first.
    echo Download from: https://www.python.org/downloads/
    pause
    exit /b 1
)

:: Set the port
set PORT=8000

echo [INFO] Starting server on http://localhost:%PORT%
echo [INFO] Opening Chrome browser...
echo.
echo Press Ctrl+C to stop the server.
echo ================================================

:: Open Chrome browser after a short delay
start "" cmd /c "timeout /t 2 /nobreak >nul && start chrome http://localhost:%PORT%"

:: Start Python HTTP server
python -m http.server %PORT%
