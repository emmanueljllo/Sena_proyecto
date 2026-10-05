@echo off
title Subir Cambios a GitHub - Confort Market
echo ========================================================
echo   Subiendo cambios de Confort Market BCP a GitHub...
echo ========================================================
echo.
git push origin main
echo.
if %ERRORLEVEL% EQU 0 (
    echo ========================================================
    echo   EXITO: Todos los cambios fueron subidos a GitHub.
    echo ========================================================
) else (
    echo ========================================================
    echo   Hubo un detalle con la autenticacion. Revisa arriba.
    echo ========================================================
)
echo.
pause
