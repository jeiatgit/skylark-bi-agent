const express = require('express');
const router = express.Router();
const { runAgent } = require('../agent/agentLoop');

router.post('/', async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const startTime = Date.now();
    const result = await runAgent(message.trim(), history || []);
    const durationMs = Date.now() - startTime;

    res.json({
      success: true,
      reply: result.text,
      toolsUsed: result.toolsUsed,
      toolResults: result.toolResults,
      durationMs,
    });
  } catch (error) {
    console.error('[Chat Route Error]', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal Server Error while running BI Agent',
    });
  }
});

module.exports = router;
