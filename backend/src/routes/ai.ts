import { Router, Response } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { checkTextQuality } from '../services/ai/text-quality';

const router = Router();

// Stricter rate limit for AI text quality calls (more expensive than normal API)
const textQualityLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many quality check requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/ai/check-text — check grammar/context/publication readiness of user text
router.post('/check-text', requireAuth, textQualityLimit, async (req: AuthRequest, res: Response) => {
  const schema = z.object({
    text: z.string().min(1).max(5000),
    fieldType: z.enum(['rationale', 'hot-wash', 'onboarding']),
    contextHint: z.string().max(2000).optional(),
    scenarioType: z.string().max(50).optional(),
    playerRole: z.string().max(100).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const result = await checkTextQuality(parsed.data);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Text quality check failed' });
  }
});

export default router;
