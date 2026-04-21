// NIST SP 800-53 Rev 5:
// IA-2 (Identification and Authentication - Organizational Users)
// IA-5 (Authenticator Management)
// IA-8 (Identification and Authentication - Non-Organizational Users)

import { Express } from 'express';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcryptjs';
import { prisma } from '../services/db';
import { logger } from '../services/logger';
import { audit } from '../services/audit';
import { setupOIDC } from './oidc';

export function setupAuth(app: Express): void {
  app.use(passport.initialize());

  // Local strategy - username/password
  passport.use(
    new LocalStrategy(
      { usernameField: 'email', passwordField: 'password', passReqToCallback: true },
      async (req, email, password, done) => {
        try {
          const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase().trim() },
          });

          const ip = req.headers['x-forwarded-for']?.toString() || req.ip || '';

          // Constant-time check to prevent timing attacks (NIST IA-5)
          const dummyHash = '$2b$12$invalidhashfortimingprotection000000000000000000000';

          if (!user || !user.passwordHash) {
            await bcrypt.compare(password, dummyHash);
            await audit({ action: 'USER_LOGIN_FAILED', metadata: { email }, ipAddress: ip });
            return done(null, false, { message: 'Invalid credentials' });
          }

          // Account lockout check (NIST AC-7)
          if (user.lockedUntil && user.lockedUntil > new Date()) {
            await audit({
              userId: user.id,
              action: 'USER_LOGIN_FAILED',
              metadata: { reason: 'account_locked' },
              ipAddress: ip,
            });
            return done(null, false, { message: 'Account locked. Please try again later.' });
          }

          const valid = await bcrypt.compare(password, user.passwordHash);

          if (!valid) {
            const newFailedAttempts = user.failedAttempts + 1;
            const locked = newFailedAttempts >= 5;

            await prisma.user.update({
              where: { id: user.id },
              data: {
                failedAttempts: newFailedAttempts,
                lockedUntil: locked ? new Date(Date.now() + 30 * 60 * 1000) : null, // 30 min lockout
              },
            });

            if (locked) {
              await audit({
                userId: user.id,
                action: 'USER_LOCKED',
                metadata: { reason: 'max_failed_attempts' },
                ipAddress: ip,
              });
            } else {
              await audit({
                userId: user.id,
                action: 'USER_LOGIN_FAILED',
                metadata: { failedAttempts: newFailedAttempts },
                ipAddress: ip,
              });
            }

            return done(null, false, { message: 'Invalid credentials' });
          }

          // Password validated. Token issuance and final login audit happen in the
          // route so MFA-required users do not receive a completed login before MFA.
          await prisma.user.update({
            where: { id: user.id },
            data: { failedAttempts: 0, lockedUntil: null },
          });

          return done(null, user);
        } catch (err) {
          logger.error('Auth error', { error: err });
          return done(err);
        }
      }
    )
  );

  // OIDC/SSO setup (Microsoft Entra ID, Okta, etc.)
  setupOIDC(app);
}
