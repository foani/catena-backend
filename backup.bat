@echo off
echo ========================================
echo    Catena Backend Database Backup
echo ========================================
echo.

set BACKUP_DIR=backups
set DATE_TIME=%date:~0,4%-%date:~5,2%-%date:~8,2%_%time:~0,2%-%time:~3,2%-%time:~6,2%
set BACKUP_FOLDER=%BACKUP_DIR%\backup_%DATE_TIME%

echo 📅 백업 시간: %DATE_TIME%
echo 📁 백업 폴더: %BACKUP_FOLDER%
echo.

if not exist "%BACKUP_DIR%" (
    echo 📁 백업 디렉토리 생성...
    mkdir "%BACKUP_DIR%"
)

if not exist "%BACKUP_FOLDER%" (
    echo 📁 백업 폴더 생성...
    mkdir "%BACKUP_FOLDER%"
)

echo 💾 데이터베이스 파일 백업 중...

if exist "database.json" (
    copy "database.json" "%BACKUP_FOLDER%\database.json" >nul
    echo ✅ database.json 백업 완료
) else (
    echo ⚠️  database.json 파일이 존재하지 않습니다
)

if exist "rankings.json" (
    copy "rankings.json" "%BACKUP_FOLDER%\rankings.json" >nul
    echo ✅ rankings.json 백업 완료
) else (
    echo ⚠️  rankings.json 파일이 존재하지 않습니다
)

if exist "logs\server.log" (
    copy "logs\server.log" "%BACKUP_FOLDER%\server.log" >nul
    echo ✅ server.log 백업 완료
) else (
    echo ⚠️  server.log 파일이 존재하지 않습니다
)

echo.
echo 🎉 백업 완료!
echo 📁 백업 위치: %BACKUP_FOLDER%
echo.

pause