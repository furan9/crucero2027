@echo off
rem Doble clic para regenerar los datos cifrados (pide el codigo por pantalla).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0publicar.ps1"
pause
