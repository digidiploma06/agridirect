@echo off
rem One-time setup: Python packages for the backend, npm packages for the frontend.
setlocal
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python was not found. Install Python 3.10 or newer from https://www.python.org/downloads/
  echo         and tick "Add python.exe to PATH" in the installer. Then run setup.bat again.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Install Node.js 20 or newer from https://nodejs.org/ then run setup.bat again.
  pause
  exit /b 1
)

echo.
echo === 1/2 Backend: creating virtual environment and installing packages ===
pushd backend
if not exist ".venv\Scripts\python.exe" python -m venv .venv
if errorlevel 1 goto :fail
".venv\Scripts\python.exe" -m pip install --upgrade pip
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 goto :fail
popd

echo.
echo === 2/2 Frontend: installing packages ===
pushd frontend
call npm install
if errorlevel 1 goto :fail
popd

echo.
echo Setup finished. Now double-click start.bat
pause
exit /b 0

:fail
echo.
echo [ERROR] Setup did not finish. Read the message above, fix it, and run setup.bat again.
pause
exit /b 1
