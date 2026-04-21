import { Express } from 'express';
import authRoutes from './auth';
import userRoutes from './users';
import scenarioRoutes from './scenarios';
import sessionRoutes from './sessions';
import adminRoutes from './admin';
import aiRoutes from './ai';
import orgConfigRoutes from './org-config';

export function setupRoutes(app: Express): void {
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/scenarios', scenarioRoutes);
  app.use('/api/sessions', sessionRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/org-config', orgConfigRoutes);
}
