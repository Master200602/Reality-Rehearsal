@echo off
title Reality Rehearsal Launcher
set NODE_DIR=C:\Users\DELL\Downloads\node-v20.11.1-win-x64\node-v20.11.1-win-x64
set PATH=%NODE_DIR%;%PATH%

echo ========================================================
echo   Starting Reality Rehearsal Technical Simulator
echo ========================================================
echo.
echo Launching Backend server in a new window...
start "Reality Rehearsal - Backend" cmd /k "cd backend && echo Installing backend dependencies... && npm install && echo Starting backend server... && npm run dev"

echo Launching Frontend server in a new window...
start "Reality Rehearsal - Frontend" cmd /k "cd frontend && echo Installing frontend dependencies... && npm install && echo Starting frontend server... && npm run dev"

echo.
echo Both servers have been launched in separate terminal windows.
echo Frontend will run at: http://localhost:3000
echo Backend will run at:  http://localhost:5000
echo.
echo Keep this window open if you want to read instructions or press any key to close.
pause
