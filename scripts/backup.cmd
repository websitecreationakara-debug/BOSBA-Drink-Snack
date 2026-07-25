@echo off
REM Wrapper invoked by the "BosbaDrinkSnack-DailyBackupCheck" Windows Scheduled Task.
REM Sets PATH so node/npx resolve under the task's environment, then runs the
REM backup and appends all output (with a timestamp) to D:\Backups\bosba-drink-snack\backup.log.
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "D:\Ecommerce\BOSBA Drink Snack"
if not exist "D:\Backups\bosba-drink-snack" mkdir "D:\Backups\bosba-drink-snack"
echo. >> "D:\Backups\bosba-drink-snack\backup.log"
echo ===== %DATE% %TIME% ===== >> "D:\Backups\bosba-drink-snack\backup.log"
call npm run backup:auto >> "D:\Backups\bosba-drink-snack\backup.log" 2>&1
