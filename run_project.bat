@echo off
title MockMirror Launcher
set NODE_DIR=C:\Users\DELL\Downloads\node-v20.11.1-win-x64\node-v20.11.1-win-x64
set PATH=%NODE_DIR%;%PATH%

echo ========================================================
echo   MockMirror - AI Interview Simulator
echo ========================================================
echo.

echo [1/3] Checking Node.js...
node -v >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js not found. Make sure node.exe is at:
    echo %NODE_DIR%
    pause
    exit /b 1
)
echo OK: Node.js found.
echo.

echo [2/3] Starting Backend (port 5000)...
echo       Logs will appear in the Backend window.
echo       If you see errors there - check backend\.env has your GEMINI_API_KEY
start "MockMirror - Backend" cmd /k "set PATH=%NODE_DIR%;%PATH% && cd backend && npm install --silent && echo. && echo Backend starting... && npm run dev"

echo Waiting 4 seconds for backend to start...
timeout /t 4 /nobreak >nul

echo [3/3] Starting Frontend (port 3000)...
start "MockMirror - Frontend" cmd /k "set PATH=%NODE_DIR%;%PATH% && cd frontend && npm install --silent && echo. && echo Frontend starting... && npm run dev"

echo.
echo ========================================================
echo   Both servers launched!
echo.
echo   App URL:        http://localhost:3000
echo   Backend API:    http://localhost:5000/api/health
echo   API Key Check:  http://localhost:5000/api/interview/verify-key
echo.
echo   If you see "Connection timed out" in the app:
echo   1. Open the Backend window and check for red errors
echo   2. Visit http://localhost:5000/api/interview/verify-key in browser
echo   3. Open backend\.env and make sure GEMINI_API_KEY is set
echo ========================================================
echo.
pause
