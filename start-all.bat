@echo off
REM ================================================
REM Script de inicio rápido para LectoLectoIA
REM Ejecuta los 3 servicios en ventanas separadas
REM ================================================

echo.
echo ============================================================
echo   🚀 INICIANDO LECTOLECTOAI
echo ============================================================
echo.
echo Este script abrirá 3 ventanas de terminal:
echo   1. Backend (Node.js) - Puerto 4000
echo   2. Frontend (Angular) - Puerto 4200
echo   3. Python Service - Puerto 5000
echo.
echo ⚠️  IMPORTANTE: Asegúrate de tener MongoDB ejecutándose
echo.
pause

REM Iniciar Backend
start "LectoLecto - Backend" cmd /k "cd /d %~dp0backend && npm run dev"

REM Esperar 3 segundos
timeout /t 3 /nobreak >nul

REM Iniciar Frontend
start "LectoLecto - Frontend" cmd /k "cd /d %~dp0frontend && ng serve --open"

REM Esperar 3 segundos
timeout /t 3 /nobreak >nul

REM Iniciar Python Service
start "LectoLecto - Python" cmd /k "cd /d %~dp0py-svc && venv\Scripts\activate && python app.py"

echo.
echo ============================================================
echo   ✅ SERVICIOS INICIADOS
echo ============================================================
echo.
echo 📡 URLs:
echo   - Frontend:  http://localhost:4200
echo   - Backend:   http://localhost:4000/health
echo   - Python:    http://localhost:5000/health
echo.
echo Presiona cualquier tecla para cerrar esta ventana...
pause >nul
