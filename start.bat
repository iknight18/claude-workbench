@echo off
title Claude Workbench
cd /d "%~dp0"

echo.
echo  ==========================================
echo   Claude Workbench
echo  ==========================================
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js is not installed or not in PATH.
    echo  Install it from https://nodejs.org
    pause
    exit /b 1
)

:: Install deps if node_modules is missing
if not exist "node_modules" (
    echo  [SETUP] Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo  [ERROR] npm install failed.
        pause
        exit /b 1
    )
    echo.
)

:: Build if no build output exists
if not exist "server\dist" (
    echo  [BUILD] Building project...
    call npm run build
    if %errorlevel% neq 0 (
        echo  [ERROR] Build failed.
        pause
        exit /b 1
    )
    echo.
)
if not exist "client\.next" (
    echo  [BUILD] Building project...
    call npm run build
    if %errorlevel% neq 0 (
        echo  [ERROR] Build failed.
        pause
        exit /b 1
    )
    echo.
)

echo  Starting production servers...
echo  Frontend: http://localhost:4200
echo  Backend:  http://localhost:4201
echo.
echo  Press Ctrl+C to stop.
echo.

npm run start
