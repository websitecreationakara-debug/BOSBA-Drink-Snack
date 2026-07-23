# One-time setup: registers the Bosba D1 + source backup as a Windows
# Scheduled Task. Run this once (as the Demo user, no admin rights needed).
#
# Triggers daily at 3:00 AM, but backup.mjs --auto only actually backs up
# when the newest dump is >= 6.5 days old, so this runs roughly weekly in
# practice. Using a daily trigger (rather than a fixed weekly day) means a
# missed day self-heals the next day instead of waiting a full week.
#
# "Run only when user is logged on" - no password is stored, but the task
# is skipped for that day if the machine is off or logged out at trigger
# time (the next day's trigger will pick it back up).

$TaskName = "Bosba-DailyBackupCheck"
$ScriptPath = "D:\Ecommerce\Bosba Premium Foods\scripts\backup.cmd"

$Action = New-ScheduledTaskAction -Execute $ScriptPath

$Trigger = New-ScheduledTaskTrigger -Daily -At 3:00AM

$Settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -DontStopOnIdleEnd `
  -ExecutionTimeLimit (New-TimeSpan -Hours 1)

Register-ScheduledTask -TaskName $TaskName `
  -Action $Action `
  -Trigger $Trigger `
  -Settings $Settings `
  -Description "Daily check (weekly-cadence, self-healing) D1 database export + source snapshot for Bosba Premium Foods, saved to D:\Ecommerce\Bosba Premium Foods\backups" `
  -Force

Write-Output "Registered scheduled task '$TaskName' - checks daily at 3:00 AM, backs up roughly weekly."
