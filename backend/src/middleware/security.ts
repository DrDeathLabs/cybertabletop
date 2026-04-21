// NIST SP 800-53 Rev 5 Security Controls:
// SC-8 (Transmission Confidentiality and Integrity)
// SC-28 (Protection of Information at Rest - headers)
// SI-10 (Information Input Validation)
// SI-15 (Information Output Filtering)

import { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';

export function setupSecurity(app: Express): void {
  const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',');

  // Helmet - comprehensive HTTP security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // needed for Tailwind
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'", 'ws:', 'wss:'],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'none'"],
          frameSrc: ["'none'"],
          upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
        },
      },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      crossOriginEmbedderPolicy: false, // needed for Socket.io
    })
  );

  // CORS - NIST AC-17 (Remote Access)
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow no-origin (same-origin / curl in dev)
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          // Use false (not an Error) to avoid triggering Express error handler
          // which would cause a double-response (ERR_HTTP_HEADERS_SENT)
          callback(null, false);
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    })
  );

  // Remove X-Powered-By
  app.disable('x-powered-by');
}
