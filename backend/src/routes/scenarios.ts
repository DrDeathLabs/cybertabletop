import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireFacilitator, AuthRequest } from '../middleware/auth';
import { prisma } from '../services/db';
import { audit } from '../services/audit';
import { LEGACY_LIBRARY_SCENARIO_IDS } from '../data/library-scenarios';

const router = Router();

// GET /api/scenarios - list all accessible scenarios
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const visibilityWhere =
    req.user!.role === 'SUPER_ADMIN'
      ? {}
      : {
          OR: [
            { isPublic: true },
            { isBuiltIn: true },
            { orgId: req.user!.orgId ?? undefined },
            { createdById: req.user!.id },
          ],
        };

  const where = {
    AND: [
      { NOT: { id: { in: [...LEGACY_LIBRARY_SCENARIO_IDS] } } },
      visibilityWhere,
    ],
  };

  const scenarios = await prisma.scenario.findMany({
    where,
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      difficulty: true,
      objectives: true,
      isPublic: true,
      isBuiltIn: true,
      createdAt: true,
      _count: { select: { injects: true } },
    },
    orderBy: [{ isBuiltIn: 'desc' }, { createdAt: 'desc' }],
  });

  res.json({ scenarios });
});

// GET /api/scenarios/:id - full scenario with injects
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const scenario = await prisma.scenario.findUnique({
    where: { id: req.params.id },
    include: {
      injects: {
        include: { options: true },
        orderBy: [{ phaseOrder: 'asc' }, { injectOrder: 'asc' }],
      },
    },
  });

  if (!scenario) {
    res.status(404).json({ error: 'Scenario not found' });
    return;
  }

  res.json({ scenario });
});

const InjectOptionSchema = z.object({
  text: z.string().min(5).max(500),
  scoreWeight: z.number().int().min(0).max(100),
  isOptimal: z.boolean(),
  scriptedFeedback: z.string().min(20).max(2000),
  feedbackTags: z.array(z.string()).optional().default([]),
  consequences: z.string().max(500).optional(),
});

const InjectSchema = z.object({
  phase: z.string().min(1).max(100),
  phaseOrder: z.number().int().min(0),
  injectOrder: z.number().int().min(0),
  title: z.string().min(3).max(200),
  narrative: z.string().min(20).max(3000),
  backgroundBrief: z.string().max(2000).optional(),
  roleVisibility: z.array(z.string()).optional().default([]),
  mitreAttackId: z.string().max(20).optional(),
  mitreAttackName: z.string().max(200).optional(),
  nistCsfFunction: z.enum(['IDENTIFY', 'PROTECT', 'DETECT', 'RESPOND', 'RECOVER']).optional(),
  timerSeconds: z.number().int().min(30).max(600).optional(),
  options: z.array(InjectOptionSchema).min(2).max(6),
});

const ScenarioSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(1000),
  type: z.enum(['RANSOMWARE', 'PHISHING', 'DATA_BREACH', 'INSIDER_THREAT', 'BEC', 'SUPPLY_CHAIN', 'DDOS', 'DDoS', 'APT', 'CUSTOM']),
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']),
  objectives: z.array(z.string()).min(1).max(10),
  isPublic: z.boolean().optional().default(false),
  injects: z.array(InjectSchema).min(1),
});

// POST /api/scenarios - create new scenario (facilitator+)
router.post('/', requireAuth, requireFacilitator, async (req: AuthRequest, res: Response) => {
  const parsed = ScenarioSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { injects, ...scenarioData } = parsed.data;

  const scenario = await prisma.scenario.create({
    data: {
      ...scenarioData,
      createdById: req.user!.id,
      orgId: req.user!.orgId,
      injects: {
        create: injects.map((inject) => ({
          ...inject,
          options: { create: inject.options },
        })),
      },
    },
    include: { injects: { include: { options: true } } },
  });

  await audit({
    userId: req.user!.id,
    action: 'SCENARIO_CREATED',
    resource: scenario.id,
    metadata: { title: scenario.title },
  });

  res.status(201).json({ scenario });
});

// PUT /api/scenarios/:id - update scenario
router.put('/:id', requireAuth, requireFacilitator, async (req: AuthRequest, res: Response) => {
  const existing = await prisma.scenario.findUnique({ where: { id: req.params.id } });

  if (!existing) {
    res.status(404).json({ error: 'Scenario not found' });
    return;
  }

  if (existing.isBuiltIn || existing.createdById !== req.user!.id) {
    res.status(403).json({ error: 'Cannot modify this scenario' });
    return;
  }

  const parsed = ScenarioSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { injects, ...scenarioData } = parsed.data;

  // Replace all injects
  await prisma.inject.deleteMany({ where: { scenarioId: req.params.id } });

  const scenario = await prisma.scenario.update({
    where: { id: req.params.id },
    data: {
      ...scenarioData,
      injects: {
        create: injects.map((inject) => ({
          ...inject,
          options: { create: inject.options },
        })),
      },
    },
    include: { injects: { include: { options: true } } },
  });

  await audit({
    userId: req.user!.id,
    action: 'SCENARIO_UPDATED',
    resource: scenario.id,
  });

  res.json({ scenario });
});

// DELETE /api/scenarios/:id
router.delete('/:id', requireAuth, requireFacilitator, async (req: AuthRequest, res: Response) => {
  const existing = await prisma.scenario.findUnique({ where: { id: req.params.id } });

  if (!existing) {
    res.status(404).json({ error: 'Scenario not found' });
    return;
  }

  const isAdmin = req.user!.role === 'SUPER_ADMIN' || req.user!.role === 'ORG_ADMIN';
  if (existing.isBuiltIn || (existing.createdById !== req.user!.id && !isAdmin)) {
    res.status(403).json({ error: 'Cannot delete this scenario' });
    return;
  }

  // Check for sessions that reference this scenario
  const sessionCount = await prisma.session.count({ where: { scenarioId: req.params.id } });
  if (sessionCount > 0) {
    res.status(409).json({
      error: `This scenario is used by ${sessionCount} tabletop session${sessionCount === 1 ? '' : 's'}. Delete those sessions first before deleting this scenario.`,
    });
    return;
  }

  try {
    await prisma.scenario.delete({ where: { id: req.params.id } });
  } catch (err: unknown) {
    // Prisma P2003: foreign key constraint (race condition guard)
    const code = (err as { code?: string }).code;
    if (code === 'P2003') {
      res.status(409).json({ error: 'Cannot delete this scenario because it is still referenced by one or more sessions.' });
      return;
    }
    throw err;
  }

  await audit({
    userId: req.user!.id,
    action: 'SCENARIO_DELETED',
    resource: req.params.id,
  });

  res.json({ ok: true });
});

export default router;
