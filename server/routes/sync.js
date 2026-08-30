const express = require('express');
const router = express.Router();
const { refreshCache, getCache } = require('../data/cache');

router.post('/', async (req, res) => {
  try {
    const startTime = Date.now();
    const cache = await refreshCache();
    const durationMs = Date.now() - startTime;

    res.json({
      success: true,
      message: 'Data synchronization completed successfully',
      source: cache.source,
      dealsCount: cache.deals.length,
      workOrdersCount: cache.workOrders.length,
      lastSync: cache.lastSync,
      durationMs,
    });
  } catch (error) {
    console.error('[Sync Route Error]', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to sync data',
    });
  }
});

router.get('/status', (req, res) => {
  const cache = getCache();
  res.json({
    success: true,
    source: cache.source,
    dealsCount: cache.deals.length,
    workOrdersCount: cache.workOrders.length,
    lastSync: cache.lastSync,
    dealWarningsCount: cache.dealWarnings.length,
    workOrderWarningsCount: cache.workOrderWarnings.length,
  });
});

module.exports = router;
