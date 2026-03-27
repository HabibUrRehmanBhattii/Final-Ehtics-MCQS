/**
 * Admin User Setup Script
 * Run: node setup-admin-user.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ADMIN_FILE = path.join(__dirname, '.secrets', 'admin-users.local.json');

function loadAdmins() {
  if (fs.existsSync(ADMIN_FILE)) {
    return JSON.parse(fs.readFileSync(ADMIN_FILE, 'utf-8'));
  }
  return [];
}

function saveAdmins(admins) {
  const dir = path.dirname(ADMIN_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(ADMIN_FILE, JSON.stringify(admins, null, 2));
}

function addAdmin(email, password) {
  const admins = loadAdmins();

  if (admins.find((a) => a.email === email)) {
    console.log('Admin user already exists');
    return false;
  }

  // In production, replace with bcrypt.
  const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

  admins.push({
    email,
    passwordHash,
    createdAt: new Date().toISOString(),
    role: 'admin'
  });

  saveAdmins(admins);
  console.log(`Admin user created: ${email}`);
  return true;
}

const emailArg = String(process.argv[2] || '').trim().toLowerCase();
const passwordArg = String(process.argv[3] || '');

if (emailArg && passwordArg) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailArg)) {
    console.error('Invalid email format.');
    process.exitCode = 1;
  } else {
    addAdmin(emailArg, passwordArg);
  }
} else {
  const admins = loadAdmins();
  console.log(`Local admin file: ${ADMIN_FILE}`);
  console.log(`Found ${admins.length} local admin user(s).`);
  console.log('Usage: node setup-admin-user.js <email> <strong-password>');
  console.log('Security note: production admin access should use Worker env vars + D1 users, not public /data files.');
}
