const express = require('express');
const router = express.Router();
const { getKPIs } = require('../data/analytics');

router.get('/', (req, res) => {
  try {
    const kpis = getKPIs();
    res.json({
      success: true,
      data: kpis,
    });
  } catch (error) {
    console.error('[KPIs Route Error]', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to compute executive KPIs',
    });
  }
});

module.exports = router;
