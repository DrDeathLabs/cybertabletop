// NIST SP 800-53 Rev 5:
// AU-2 (Event Logging)
// AU-3 (Content of Audit Records)
// AU-12 (Audit Record Generation)

import { Request, Response, NextFunction } from 'express';
import { logger } from '../services/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, url, ip } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;

    // Don't log health checks to avoid noise
    if (url === '/health') {
      next();
      return;
    }

    logger.info('HTTP request', {
      method,
      url,
      statusCode,
      duration,
      ip: req.headers['x-forwarded-for'] || ip,
      userAgent: req.headers['user-agent'],
      userId: (req as any).user?.id,
    });
  });

  next();
}
