require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const adminRoutes = require('./src/admin-routes');

const app = express();
const port = Number(process.env.API_PORT || 3000);

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static SPA assets
app.use(express.static(__dirname));

// Admin content-manager API
app.use('/api/admin', adminRoutes);

// Simple health check
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'admin-content-manager',
    timestamp: new Date().toISOString()
  });
});

// Keep root aligned with SPA
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Admin server running at http://localhost:${port}`);
  console.log(`Admin panel: http://localhost:${port}/admin-content-manager.html`);
});
