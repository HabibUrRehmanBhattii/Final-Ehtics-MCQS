@echo off
REM Admin Panel Setup Script (Windows)
REM Run this to set up the admin content manager

echo.
echo Setting up Admin Content Manager...
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if npm is installed
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npm is not installed
    echo Please install npm
    pause
    exit /b 1
)

echo OK: Node.js and npm found
echo.

REM Install dependencies
echo Installing dependencies...
call npm install express multer jsonschema dotenv cors helmet

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo OK: Dependencies installed successfully
echo.

REM Create .env file if not exists
if not exist .env (
    echo Creating .env file...
    (
        echo # Admin Panel Configuration
        echo ADMIN_TOKEN=change-me-in-production
        echo NODE_ENV=development
        echo API_PORT=3000
        echo DATA_DIR=./data
        echo.
        echo # Database (optional)
        echo # DB_HOST=localhost
        echo # DB_PORT=5432
        echo # DB_NAME=mcq_admin
        echo # DB_USER=admin
        echo # DB_PASS=password
    ) > .env
    echo OK: .env file created (UPDATE ADMIN_TOKEN!)
) else (
    echo WARNING: .env file already exists
)

echo.

REM Create admin user setup script
echo Creating admin user setup script...
(
    echo /**
    echo  * Admin User Setup Script
    echo  * Run: node setup-admin-user.js
    echo  */
    echo.
    echo const fs = require('fs');
    echo const path = require('path');
    echo.
    echo // Simple in-memory admin store (replace with DB in production^)
    echo const ADMIN_FILE = path.join(__dirname, 'data', 'admin-users.json'^);
    echo.
    echo function loadAdmins(^) {
    echo     if (fs.existsSync(ADMIN_FILE^)^) {
    echo         return JSON.parse(fs.readFileSync(ADMIN_FILE, 'utf-8'^)^);
    echo     }
    echo     return [];
    echo }
    echo.
    echo function saveAdmins(admins^) {
    echo     const dir = path.dirname(ADMIN_FILE^);
    echo     if (!fs.existsSync(dir^)^) {
    echo         fs.mkdirSync(dir, { recursive: true }^);
    echo     }
    echo     fs.writeFileSync(ADMIN_FILE, JSON.stringify(admins, null, 2^)^);
    echo }
    echo.
    echo function addAdmin(email, password^) {
    echo     const admins = loadAdmins(^);
    echo.
    echo     if (admins.find(a =^> a.email === email^)^) {
    echo         console.log('Admin user already exists'^);
    echo         return false;
    echo     }
    echo.
    echo     // In production, use bcrypt for hashing
    echo     const crypto = require('crypto'^);
    echo     const hash = crypto.createHash('sha256'^).update(password^).digest('hex'^);
    echo.
    echo     admins.push({
    echo         email,
    echo         passwordHash: hash,
    echo         createdAt: new Date(^).toISOString(^),
    echo         role: 'admin'
    echo     }^);
    echo.
    echo     saveAdmins(admins^);
    echo     console.log('Admin user created: ' + email^);
    echo     return true;
    echo }
    echo.
    echo // Create default admin if none exists
    echo const admins = loadAdmins(^);
    echo if (admins.length === 0^) {
    echo     console.log('Creating default admin user...'^);
    echo     addAdmin('admin@example.com', 'change-me-immediately'^);
    echo     console.log('Default credentials: admin@example.com / change-me-immediately'^);
    echo     console.log('WARNING: Please change password immediately!'^);
    echo } else {
    echo     console.log('Found ' + admins.length + ' admin user(s)'^);
    echo }
) > setup-admin-user.js

echo OK: Admin user setup script created
echo.

echo.
echo SETUP COMPLETE!
echo.
echo Next steps:
echo 1. Update ADMIN_TOKEN in .env file
echo 2. Integrate admin-routes.js into your Express server
echo 3. Start your server: npm start
echo 4. Access admin panel at: http://localhost:3000/admin-content-manager.html
echo.
echo Documentation: ADMIN_CONTENT_MANAGER_GUIDE.md
echo.
pause
