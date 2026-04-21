import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import http from 'http';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { setupSecurity } from './middleware/security';
import { setupRateLimit } from './middleware/rateLimit';
import { requestLogger } from './middleware/logger';
import { setupAuth } from './auth/setup';
import { setupRoutes } from './routes';
import { setupSocketIO } from './socket';
import { logger } from './services/logger';

// ── Startup environment validation (NIST CM-6, SI-2) ─────────────────────────
// Fail fast if required secrets are missing — prevents running with empty/default
// credentials that would silently break auth or database connectivity.
const REQUIRED_ENV_VARS = ['JWT_SECRET', 'DATABASE_URL', 'JWT_REFRESH_SECRET'] as const;
const missingVars = REQUIRED_ENV_VARS.filter((v) => !process.env[v]);
if (missingVars.length > 0) {
  console.error(
    `[STARTUP ERROR] Missing required environment variables: ${missingVars.join(', ')}\n` +
    'Copy .env.example to .env and set all required values before starting.'
  );
  process.exit(1);
}

if (process.env.JWT_SECRET!.length < 32) {
  console.error('[STARTUP ERROR] JWT_SECRET must be at least 32 characters long.');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production' && !process.env.MFA_ENCRYPTION_KEY) {
  console.error('[STARTUP ERROR] MFA_ENCRYPTION_KEY is required in production for encrypted TOTP MFA secrets.');
  process.exit(1);
}

const app = express();
const server = http.createServer(app);

// Trust proxy (for rate limiting behind nginx/load balancer)
app.set('trust proxy', 1);

// Security headers (NIST SC-8, SC-28)
setupSecurity(app);

// Rate limiting (NIST SC-5, SI-3)
setupRateLimit(app);

// Body parsing — finalize payload can be large with 120B model output (long narratives + feedback)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));
app.use(cookieParser());
app.use(compression());

// Request logging (NIST AU-2, AU-3)
app.use(requestLogger);

// Passport auth setup
setupAuth(app);

// API routes
setupRoutes(app);

// Socket.io for real-time session
setupSocketIO(server);

// Health check (unauthenticated, for container orchestration)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((_req, res) => {
  if (!res.headersSent) res.status(404).json({ error: 'Not found' });
});

// Global error handler — guard against SSE responses that already sent headers
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
});

const PORT = parseInt(process.env.PORT || '3001', 10);

server.listen(PORT, '0.0.0.0', () => {
  logger.info(`CyberTabletop backend running on port ${PORT}`);
});

export { app, server };
