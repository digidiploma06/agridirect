@echo off
rem Starts the API (port 8000) and the web app (port 3000) in two windows.
setlocal
cd /d "%~dp0"

if not exist "backend\.venv\Scripts\python.exe" (
  echo Run setup.bat first.
  pause
  exit /b 1
)

pushd backend
start "AgriDirect API - port 8000" cmd /k ".venv\Scripts\python.exe -m uvicorn app.main:app --port 8000"
popd

pushd frontend
start "AgriDirect Web - port 3000" cmd /k "npm run dev"
popd

echo.
echo Two windows opened: the API and the web app.
echo The first start takes about a minute (sample data + model training).
echo Opening http://localhost:3000 in 30 seconds ...
timeout /t 30 /nobreak >nul
start "" http://localhost:3000
