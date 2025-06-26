@echo off
echo ========================================
echo    Catena Backend Server Starter
echo ========================================
echo.

echo 📋 서버 정보:
echo    포트: 3001
echo    프론트엔드: http://localhost:5173
echo    백엔드: http://localhost:3001
echo.

echo 🔍 Node.js 버전 확인...
node --version
echo.

echo 📦 의존성 설치 확인...
if not exist "node_modules" (
    echo 📥 의존성 설치 중...
    npm install
    echo.
)

echo 🚀 Catena Backend Server 시작...
echo.
echo 💡 서버를 중지하려면 Ctrl+C 를 누르세요
echo.

node server.js

pause