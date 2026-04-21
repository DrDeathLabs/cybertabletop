// NIST SP 800-53 Rev 5:
// SC-5 (Denial of Service Protection)
// SI-3 (Malicious Code Protection)
// AC-7 (Unsuccessful Logon Attempts)

import { Express } from 'express';
import rateLimit from 'express-rate-limit';

// Auth endpoints - strict (NIST AC-7)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' },
  skipSuccessfulRequests: false,
});

// General API - moderate
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

// Join session - prevent code brute-force
const joinLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many session join attempts.' },
});

export function setupRateLimit(app: Express): void {
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  app.use('/api/sessions/join', joinLimiter);
  app.use('/api/', apiLimiter);
}
