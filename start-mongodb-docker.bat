@echo off
REM ================================================
REM Inicia MongoDB usando Docker
REM ================================================

echo.
echo ============================================================
echo   🐳 INICIANDO MONGODB CON DOCKER
echo ============================================================
echo.

REM Verificar si Docker está instalado
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker no está instalado o no está en el PATH
    echo.
    echo Por favor instala Docker Desktop desde:
    echo https://www.docker.com/products/docker-desktop/
    echo.
    pause
    exit /b 1
)

echo ✅ Docker detectado
echo.

REM Verificar si el contenedor ya existe
docker ps -a | findstr "lectolecto-mongodb" >nul 2>&1
if %errorlevel% equ 0 (
    echo 📦 Contenedor MongoDB ya existe, iniciándolo...
    docker start lectolecto-mongodb
) else (
    echo 📦 Creando nuevo contenedor MongoDB...
    docker run -d ^
        --name lectolecto-mongodb ^
        -p 27017:27017 ^
        -v lectolecto-mongodb-data:/data/db ^
        mongo:latest
)

echo.
echo ============================================================
echo   ✅ MONGODB INICIADO
echo ============================================================
echo.
echo 📡 MongoDB está disponible en: mongodb://localhost:27017
echo 📊 Base de datos: lectolecto
echo.
echo Comandos útiles:
echo   - Ver logs:    docker logs lectolecto-mongodb
echo   - Detener:     docker stop lectolecto-mongodb
echo   - Reiniciar:   docker restart lectolecto-mongodb
echo   - Conectar:    docker exec -it lectolecto-mongodb mongosh
echo.
pause
