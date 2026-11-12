@echo off
rem Runs backend and frontend automated tests.
setlocal
cd /d "%~dp0"
pushd backend
".venv\Scripts\python.exe" -m pytest -q
popd
pushd frontend
call npm run typecheck
call npm run lint
call npm test
popd
pause
