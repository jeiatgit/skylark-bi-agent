require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const { getCache, refreshCache } = require('./data/cache');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Routes
const chatRoute = require('./routes/chat');
const kpisRoute = require('./routes/kpis');
const syncRoute = require('./routes/sync');

app.use('/api/chat', chatRoute);
app.use('/api/kpis', kpisRoute);
app.use('/api/sync', syncRoute);

// Health check
app.get('/api/health', (req, res) => {
  const cache = getCache();
  res.json({
    status: 'healthy',
    agent: 'Skylark BI Agent v1.0',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
    mondayApiConfigured: !!process.env.MONDAY_API_TOKEN,
    dealsBoardConfigured: !!process.env.DEALS_BOARD_ID,
    workOrdersBoardConfigured: !!process.env.WORK_ORDERS_BOARD_ID,
    dataSource: cache.source,
    dealsLoaded: cache.deals.length,
    workOrdersLoaded: cache.workOrders.length,
    lastSync: cache.lastSync,
  });
});

// Fallback to index.html for SPA using middleware
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, '../public/index.html'));
  }
  next();
});

// Initialize cache and start server
async function startServer() {
  try {
    console.log('🚀 Initializing Skylark BI Agent data store...');
    await refreshCache();
    app.listen(PORT, () => {
      console.log(`\n✨ Skylark BI Agent is running on http://localhost:${PORT}`);
      console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
