@echo off
REM EduTrack Quick Start Script for Windows

echo.
echo 🚀 EduTrack - Smart Classroom Management System
echo ===============================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo ✅ Node.js version: %NODE_VERSION%
echo.

echo 📦 Installing dependencies...
echo.

REM Install backend dependencies
echo 📥 Backend dependencies...
cd backend
call npm install --quiet
echo ✅ Backend ready
cd ..

REM Install frontend dependencies
echo.
echo 📥 Frontend dependencies...
cd frontend
call npm install --quiet
echo ✅ Frontend ready
cd ..

echo.
echo ✨ Setup complete!
echo.
echo 🎯 To start the app, run these in separate terminals:
echo.
echo    Terminal 1 (Backend^):
echo    $ cd backend ^& npm run dev
echo.
echo    Terminal 2 (Frontend^):
echo    $ cd frontend ^& npm run dev
echo.
echo 📍 Then open: http://localhost:5173
echo.
echo 💡 For detailed setup, see IMPLEMENTATION_GUIDE.md
echo.
pause
