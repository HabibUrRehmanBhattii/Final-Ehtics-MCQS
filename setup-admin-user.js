/**
 * Admin User Setup Script
 * Run: node setup-admin-user.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ADMIN_FILE = path.join(__dirname, 'data', 'admin-users.json');

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

const admins = loadAdmins();
if (admins.length === 0) {
  console.log('Creating default admin user...');
  addAdmin('admin@example.com', 'change-me-immediately');
  console.log('Default credentials: admin@example.com / change-me-immediately');
  console.log('WARNING: Please change password immediately!');
} else {
  console.log(`Found ${admins.length} admin user(s)`);
}
