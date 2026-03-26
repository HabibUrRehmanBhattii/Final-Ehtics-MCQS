#!/bin/bash

# Admin Panel Setup Script
# Run this to set up the admin content manager

echo "🚀 Setting up Admin Content Manager..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    echo "Please install npm"
    exit 1
fi

echo "✓ Node.js and npm found"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install express multer jsonschema dotenv cors helmet

if [ $? -eq 0 ]; then
    echo "✓ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo ""

# Create .env file if not exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
# Admin Panel Configuration
ADMIN_TOKEN=change-me-in-production
NODE_ENV=development
API_PORT=3000
DATA_DIR=./data

# Database (optional)
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=mcq_admin
# DB_USER=admin
# DB_PASS=password
EOF
    echo "✓ .env file created (UPDATE ADMIN_TOKEN!)"
else
    echo "⚠ .env file already exists"
fi

echo ""

# Create admin user setup script
echo "👤 Creating admin user setup script..."
cat > setup-admin-user.js << 'EOF'
/**
 * Admin User Setup Script
 * Run: node setup-admin-user.js
 */

const fs = require('fs');
const path = require('path');

// Simple in-memory admin store (replace with DB in production)
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
    
    if (admins.find(a => a.email === email)) {
        console.log('❌ Admin user already exists');
        return false;
    }
    
    // In production, use bcrypt for hashing
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    
    admins.push({
        email,
        passwordHash: hash,
        createdAt: new Date().toISOString(),
        role: 'admin'
    });
    
    saveAdmins(admins);
    console.log(`✓ Admin user created: ${email}`);
    return true;
}

// Create default admin if none exists
const admins = loadAdmins();
if (admins.length === 0) {
    console.log('Creating default admin user...');
    addAdmin('admin@example.com', 'change-me-immediately');
    console.log('Default credentials: admin@example.com / change-me-immediately');
    console.log('⚠️  Please change password immediately!');
} else {
    console.log(`✓ ${admins.length} admin user(s) found`);
}
EOF

echo "✓ Admin user setup script created"
echo ""

# Create Express server integration guide
echo "📖 Creating integration guide..."
cat > ADMIN_INTEGRATION.md << 'EOF'
# Admin Panel Integration Steps

## 1. Update Your Express Server

Add this to your main server file (e.g., `server.js`):

```javascript
const express = require('express');
const adminRoutes = require('./src/admin-routes');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Admin API Routes
app.use('/api/admin', (req, res, next) => {
    // Authentication middleware
    const token = req.headers.authorization?.split(' ')[1];
    if (!token || token !== process.env.ADMIN_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}, adminRoutes);

// Start server
const PORT = process.env.API_PORT || 3000;
app.listen(PORT, () => {
    console.log(`✓ Server running on http://localhost:${PORT}`);
    console.log(`✓ Admin panel: http://localhost:${PORT}/admin-content-manager.html`);
});
```

## 2. Configure Environment

Update your `.env` file:

```
ADMIN_TOKEN=your-secure-token-here
NODE_ENV=production
API_PORT=3000
DATA_DIR=./data
```

Generate a secure token:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 3. Test the Setup

```bash
# Start server
npm start

# In another terminal, test API
curl http://localhost:3000/api/admin/stats \
  -H "Authorization: Bearer your-token-here"
```

## 4. Access Admin Panel

- Navigate to: `http://localhost:3000/admin-content-manager.html`
- Login with your admin token
- Start managing content

## 5. Production Deployment

For production:
1. Use bcrypt for password hashing
2. Implement proper JWT tokens with expiration
3. Add rate limiting to prevent abuse
4. Enable HTTPS/TLS
5. Use environment-specific tokens
6. Implement audit logging
7. Set up automated backups
EOF

echo "✓ Integration guide created: ADMIN_INTEGRATION.md"
echo ""

# Summary
echo "✅ Setup Complete!"
echo ""
echo "Next steps:"
echo "1. Update ADMIN_TOKEN in .env file"
echo "2. Integrate admin-routes.js into your Express server"
echo "3. Start your server: npm start"
echo "4. Access admin panel at: http://localhost:3000/admin-content-manager.html"
echo ""
echo "📖 Documentation: ADMIN_CONTENT_MANAGER_GUIDE.md"
echo "🔗 Integration: ADMIN_INTEGRATION.md"
echo ""
