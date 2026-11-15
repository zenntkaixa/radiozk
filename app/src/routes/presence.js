import { Router } from 'express';
import { createPresence } from '../presence.js';
import { isListenerId } from '../validate.js';
import { readLimiter, presenceLimiter, presenceListenerLimiter } from '../rateLimit.js';

const presence = createPresence();
const router = Router();
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.get('/', readLimiter(), (_req, res) => res.json({ listening: presence.count() }));

// A playing client sends this every 30 s. Per IP (the real cap, the id is client-chosen) and per listener id.
router.post('/', presenceLimiter(), (req, res, next) => {
  if (!isListenerId(req.get('x-listener-id'))) return res.status(400).json({ error: 'valid X-Listener-Id header required' });
  next();
}, presenceListenerLimiter(), (req, res) => {
  presence.beat(req.get('x-listener-id'));
  res.json({ listening: presence.count() });
});

export default router;
