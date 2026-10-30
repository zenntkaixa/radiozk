import { rateLimit } from 'express-rate-limit';

// Per-IP limits on the ratings endpoints, in memory (one API process; counters reset when it restarts).
// Defaults suit a human: the page reads the ratings once per track and a listener votes a few times a minute.
//   RATE_LIMIT_READ        GETs per window per IP        (default 120)
//   RATE_LIMIT_WRITE       POSTs per window per IP       (default 20)
//   RATE_LIMIT_WINDOW_MS   window length                 (default 60000)
//   TRUST_PROXY            which peers may set X-Forwarded-For: an Express `trust proxy` value (default
//                          'loopback, uniquelocal', i.e. nginx on this host or on the Docker network). Anything
//                          else connecting directly cannot choose its own address. 'false' trusts nobody.
const int = (value, fallback) => (Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : fallback);

export function trustProxySetting(value = process.env.TRUST_PROXY) {
  if (value === undefined || value === '') return 'loopback, uniquelocal';
  if (value === 'false') return false;
  return /^\d+$/.test(value) ? Number(value) : value;
}

function limiter(limit) {
  return rateLimit({
    windowMs: int(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
    limit,
    standardHeaders: 'draft-7', // RateLimit-* headers; Retry-After is sent with the 429
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: 'too many requests' }),
  });
}

export const readLimiter = () => limiter(int(process.env.RATE_LIMIT_READ, 120));
export const writeLimiter = () => limiter(int(process.env.RATE_LIMIT_WRITE, 20));
