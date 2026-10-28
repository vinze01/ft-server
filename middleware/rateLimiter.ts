import rateLimit from 'express-rate-limit';

// General API limiter — generous ceiling to stop abuse/DoS without
// affecting normal usage. Applied to every /api route in server.ts.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});

// Strict limiter for unauthenticated auth endpoints — slows down
// credential brute-forcing and password-reset token guessing.
// Applied per-route in routes/index.ts.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' }
});
