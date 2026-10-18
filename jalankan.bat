@echo off
title PPDB SD SALATIGA 03 - Server Localhost
color 0b
echo ===================================================
echo     MEMULAI SERVER PPDB SD SALATIGA 03
echo ===================================================
echo.
echo Akses Web:
echo - Halaman Utama : http://localhost:3000
echo - Dashboard Admin : http://localhost:3000/admin
echo.
echo Tekan Ctrl + C untuk mematikan server.
echo ===================================================
echo.
node server/server.js
pause
