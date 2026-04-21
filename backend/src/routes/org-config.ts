import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { emptyOrgConfig, getOrgConfig } from '../services/org-config';

const router = Router();

// GET /api/org-config
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  if (!req.user!.orgId) {
    res.json(emptyOrgConfig());
    return;
  }

  const config = await getOrgConfig(req.user!.orgId);
  res.json(config);
});

export default router;
