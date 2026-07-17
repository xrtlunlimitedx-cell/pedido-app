@echo off
REM ============================================================
REM   Pedido-APP  -  Levantar servidor local para testing
REM   Stack: Node.js + Express  |  DB local: SQLite (pedidos.db)
REM ============================================================
chcp 65001 >nul
title Pedido-APP - Servidor Local
cd /d "%~dp0"

echo.
echo ============================================================
echo   PEDIDO-APP  -  Arranque en modo LOCAL (SQLite)
echo ============================================================
echo.

REM ------------------------------------------------------------
REM 1) Verificar que Node.js este instalado
REM ------------------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] No se encontro Node.js instalado en esta PC.
    echo.
    echo Instalalo desde: https://nodejs.org/  ^(version LTS^)
    echo Despues vuelve a ejecutar este .bat.
    echo.
    pause
    exit /b 1
)

for /f "delims=" %%v in ('node --version') do set "NODE_VER=%%v"
echo [OK] Node.js detectado: %NODE_VER%

for /f "delims=" %%v in ('npm --version') do set "NPM_VER=%%v"
echo [OK] npm detectado: %NPM_VER%

REM ------------------------------------------------------------
REM 2) CRITICO: borrar DATABASE_URL para forzar modo SQLite local
REM    Si esta variable queda definida, la app intenta conectarse
REM    a PostgreSQL (Render) y falla en local.
REM ------------------------------------------------------------
set "DATABASE_URL="
echo [OK] DATABASE_URL unset -^> modo local SQLite forzado

REM ------------------------------------------------------------
REM 3) Puerto (editable). Por defecto 3000.
REM ------------------------------------------------------------
if not defined PORT set "PORT=3000"
echo [OK] Puerto: %PORT%

REM ------------------------------------------------------------
REM 3b) VERIFICAR QUE EL PUERTO NO ESTE OCUPADO
REM     Si un server viejo quedo colgado, node server.js fallaria
REM     silenciosamente (EADDRINUSE) y usarias la version vieja.
REM ------------------------------------------------------------
netstat -ano | findstr "LISTENING" | findstr ":%PORT% " >nul 2>nul
if %errorlevel%==0 (
    echo.
    echo [ALERTA] El puerto %PORT% ya esta en uso por otro proceso.
    echo          Esto suele ser un servidor viejo que quedo colgado.
    echo.
    netstat -ano | findstr "LISTENING" | findstr ":%PORT% "
    echo.
    echo          Intentando liberar el puerto automaticamente...
    for /f "tokens=5" %%p in ('netstat -ano ^| findstr "LISTENING" ^| findstr ":%PORT% "') do (
        taskkill /F /PID %%p >nul 2>nul
    )
    timeout /t 2 /nobreak >nul
    netstat -ano | findstr "LISTENING" | findstr ":%PORT% " >nul 2>nul
    if %errorlevel%==0 (
        echo.
        echo [ERROR] No se pudo liberar el puerto %PORT%.
        echo         Reinicia la PC para matar el proceso colgado y vuelve a probar.
        echo.
        pause
        exit /b 1
    )
    echo [OK] Puerto %PORT% liberado.
)

REM ------------------------------------------------------------
REM 4) Instalar dependencias si falta node_modules
REM ------------------------------------------------------------
if not exist "node_modules" (
    echo.
    echo [INFO] Primera ejecucion: instalando dependencias...
    echo        ^(esto puede tardar 1-2 minutos la primera vez^)
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] Fallo la instalacion de dependencias.
        pause
        exit /b 1
    )
    echo.
    echo [OK] Dependencias instaladas correctamente.
)

REM ------------------------------------------------------------
REM 5) Arrancar el servidor y abrir el navegador
REM ------------------------------------------------------------
echo.
echo ============================================================
echo   Servidor listo en:  http://localhost:%PORT%
echo.
echo   Usuarios de prueba:
echo     admin     / admin123       ^(rol Administrador^)
echo     vendedor  / vendedor123    ^(rol Vendedor^)
echo.
echo   Base de datos: pedidos.db  ^(SQLite, en esta carpeta^)
echo.
echo   Para detener:  Ctrl + C
echo ============================================================
echo.

REM Abrir navegador tras 2 segundos (en segundo plano)
start "" /b cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:%PORT%"

REM Levantar el servidor
node server.js

REM Si node termina (p.ej. por Ctrl+C)
echo.
echo [INFO] El servidor se detuvo.
pause
