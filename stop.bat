@echo off
echo ========================================
echo   Stopping QQ Bot and Claude Code
echo ========================================
echo.

echo [1/2] Stopping QQ Bot process...
wmic process where "name='node.exe' and commandline like '%%src%%index%%'" delete >nul 2>&1
if %errorlevel% equ 0 (
    echo    QQ Bot stopped.
) else (
    echo    QQ Bot was not running.
)

echo.

echo [2/2] Cleaning up Claude Code orphan processes...
wmic process where "name='claude.exe' and commandline like '%%-p%%'" delete >nul 2>&1
if %errorlevel% equ 0 (
    echo    Claude Code orphans cleaned.
) else (
    echo    No Claude Code orphans found.
)

echo.
echo ========================================
echo   Done
echo ========================================
pause
