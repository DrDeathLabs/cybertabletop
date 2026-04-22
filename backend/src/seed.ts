import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { logger } from './services/logger';
import { buildLibraryScenarioSeeds, LEGACY_LIBRARY_SCENARIO_IDS } from './data/library-scenarios';

const prisma = new PrismaClient();

async function ensureSystemUser() {
  const existing = await prisma.user.findUnique({ where: { id: 'system' } });
  if (existing) return existing;

  return prisma.user.create({
    data: {
      id: 'system',
      email: 'system@cybertabletop.internal',
      displayName: 'System',
      role: 'SUPER_ADMIN',
      passwordHash: await bcrypt.hash(`DISABLED_${Math.random()}`, 12),
    },
  });
}

async function upsertBuiltInScenario(seed: ReturnType<typeof buildLibraryScenarioSeeds>[number]) {
  const existing = await prisma.scenario.findUnique({
    where: { id: seed.id },
    select: { id: true },
  });

  const sharedData = {
    title: seed.title,
    description: seed.description,
    type: seed.type,
    difficulty: seed.difficulty,
    objectives: seed.objectives,
    mode: seed.mode,
    onboardingSchema: seed.onboardingSchema as object,
    isPublic: seed.isPublic,
    isBuiltIn: seed.isBuiltIn,
    createdById: seed.createdById,
  };

  if (existing) {
    const sessionCount = await prisma.session.count({ where: { scenarioId: seed.id } });
    if (sessionCount > 0) {
      await prisma.scenario.update({
        where: { id: seed.id },
        data: sharedData,
      });
      return;
    }

    await prisma.inject.deleteMany({ where: { scenarioId: seed.id } });
    await prisma.scenario.update({
      where: { id: seed.id },
      data: {
        ...sharedData,
        injects: {
          create: seed.injects.map((inject) => ({
            phase: inject.phase,
            phaseOrder: inject.phaseOrder,
            injectOrder: inject.injectOrder,
            title: inject.title,
            narrative: inject.narrative,
            backgroundBrief: inject.backgroundBrief,
            roleVisibility: inject.roleVisibility,
            mitreAttackId: inject.mitreAttackId,
            mitreAttackName: inject.mitreAttackName,
            nistCsfFunction: inject.nistCsfFunction,
            options: {
              create: inject.options.map((option) => ({
                text: option.text,
                scoreWeight: option.scoreWeight,
                isOptimal: option.isOptimal,
                scriptedFeedback: option.scriptedFeedback,
                feedbackTags: option.feedbackTags,
                consequences: option.consequences,
              })),
            },
          })),
        },
      },
    });
    return;
  }

  await prisma.scenario.create({
    data: {
      ...sharedData,
      id: seed.id,
      injects: {
        create: seed.injects.map((inject) => ({
          phase: inject.phase,
          phaseOrder: inject.phaseOrder,
          injectOrder: inject.injectOrder,
          title: inject.title,
          narrative: inject.narrative,
          backgroundBrief: inject.backgroundBrief,
          roleVisibility: inject.roleVisibility,
          mitreAttackId: inject.mitreAttackId,
          mitreAttackName: inject.mitreAttackName,
          nistCsfFunction: inject.nistCsfFunction,
          options: {
            create: inject.options.map((option) => ({
              text: option.text,
              scoreWeight: option.scoreWeight,
              isOptimal: option.isOptimal,
              scriptedFeedback: option.scriptedFeedback,
              feedbackTags: option.feedbackTags,
              consequences: option.consequences,
            })),
          },
        })),
      },
    },
  });
}

async function main() {
  logger.info('Seeding database...');

  await ensureSystemUser();
  const builtInScenarios = buildLibraryScenarioSeeds('system');

  for (const scenario of builtInScenarios) {
    await upsertBuiltInScenario(scenario);
  }

  logger.info('Library scenarios seeded', {
    count: builtInScenarios.length,
    titles: builtInScenarios.map((scenario) => scenario.title),
  });

  for (const legacyId of LEGACY_LIBRARY_SCENARIO_IDS) {
    const sessionCount = await prisma.session.count({ where: { scenarioId: legacyId } });
    if (sessionCount > 0) continue;
    await prisma.scenario.deleteMany({ where: { id: legacyId } });
  }

  logger.info('Database seeding complete');
}

main()
  .catch((error) => {
    logger.error('Seed failed', { error });
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
