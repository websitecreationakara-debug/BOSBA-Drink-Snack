@echo off
REM Wrapper invoked by the "Bosba-DailyBackupCheck" Windows Scheduled Task.
REM Sets PATH so node/npx resolve under the task's environment, then runs the
REM backup and appends all output (with a timestamp) to D:\Backups\bosba\backup.log.
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "D:\Ecommerce\Bosba Premium Foods"
if not exist "D:\Backups\bosba" mkdir "D:\Backups\bosba"
echo. >> "D:\Backups\bosba\backup.log"
echo ===== %DATE% %TIME% ===== >> "D:\Backups\bosba\backup.log"
call npm run backup:auto >> "D:\Backups\bosba\backup.log" 2>&1
