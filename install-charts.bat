@echo off
setlocal enabledelayedexpansion

REM Get the absolute path of the current script's directory
for %%I in ("%~dp0.") do set "BASEDIR=%%~fI"

echo Installing dependencies in: %BASEDIR%
echo.

cd /d "%BASEDIR%"

REM Remove existing node_modules if it exists
if exist node_modules (
    echo Removing old node_modules...
    rmdir /s /q node_modules 2>nul
    for /d %%x in (node_modules\*) do @if exist "%%x" rmdir /s /q "%%x" 2>nul
)

REM Remove package-lock.json
if exist package-lock.json (
    echo Removing package-lock.json...
    del /q package-lock.json 2>nul
)

echo.
echo Running: npm install
npm install

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo WARNING: npm install had errors (code %ERRORLEVEL%), but proceeding...
    echo Some packages may not have installed correctly.
)

echo.
echo Installation process complete!
echo.
echo Checking installed packages...
npm list --depth=0

pause