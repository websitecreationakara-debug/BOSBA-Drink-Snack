@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "D:\Ecommerce\Bosba Premium Foods"
node scripts\restore-live.mjs %*
echo.
pause
