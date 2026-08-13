@echo off
start "" "pocketbase.exe" serve
timeout /t 2 /nobreak >nul
start http://127.0.0.1:8090