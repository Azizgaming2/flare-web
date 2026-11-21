@echo off
cd /d D:\flare-slm
git add -A
git diff --cached --quiet && (echo Deyisiklik yoxdur & pause & exit /b)
for /f "tokens=*" %%t in ('powershell -NoProfile -Command "Get-Date -Format \"yyyy-MM-dd HH:mm\""') do set STAMP=%%t
git commit -m "Update %STAMP%"
git pull --rebase --autostash
git push
echo.
echo Bitdi
pause
