@echo off
title IGRIS Dashboard
cd /d "%~dp0igris-dashboard"

rem Si ya esta funcionando, solo abre el navegador.
powershell -NoProfile -Command "try { Invoke-WebRequest http://localhost:5173 -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
if not errorlevel 1 goto abrir

where node >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js. Instalalo desde https://nodejs.org y vuelve a abrir este archivo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Instalando dependencias por primera vez, espera un momento...
  call npm install --no-audit --no-fund
)

echo Iniciando IGRIS Dashboard...
rem El servidor corre en una ventana minimizada aparte: puedes cerrar esta.
start "IGRIS servidor (no cerrar)" /min cmd /c "npx vite --port 5173 --strictPort"

rem Espera hasta 60 s a que el servidor responda.
powershell -NoProfile -Command "for ($i=0; $i -lt 60; $i++) { try { Invoke-WebRequest http://localhost:5173 -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { Start-Sleep 1 } }; exit 1"
if errorlevel 1 (
  echo El servidor no respondio. Revisa la ventana "IGRIS servidor" para ver el error.
  pause
  exit /b 1
)

:abrir
start "" http://localhost:5173
exit /b 0
