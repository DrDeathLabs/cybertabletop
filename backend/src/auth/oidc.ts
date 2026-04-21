// NIST SP 800-53 Rev 5:
// IA-8 (Identification and Authentication - Non-Organizational Users)
// IA-12 (Identity Proofing)

import { Express, Request, Response } from 'express';
import { Issuer, generators, Client } from 'openid-client';
import { prisma } from '../services/db';
import { issueTokens } from './tokens';
import { audit } from '../services/audit';
import { logger } from '../services/logger';

let oidcClient: Client | null = null;

export async function initOIDC(): Promise<void> {
  const issuerUrl = process.env.OIDC_ISSUER_URL;
  if (!issuerUrl) {
    logger.info('OIDC not configured — SSO disabled');
    return;
  }

  try {
    const issuer = await Issuer.discover(issuerUrl);
    oidcClient = new issuer.Client({
      client_id: process.env.OIDC_CLIENT_ID!,
      client_secret: process.env.OIDC_CLIENT_SECRET!,
      redirect_uris: [process.env.OIDC_REDIRECT_URI!],
      response_types: ['code'],
    });
    logger.info('OIDC client configured', { issuer: issuerUrl });
  } catch (err) {
    logger.error('Failed to configure OIDC', { error: err });
  }
}

// In-memory state store (use Redis in production)
const stateStore = new Map<string, string>();

export function setupOIDC(app: Express): void {
  // Kick off OIDC flow
  app.get('/api/auth/sso', (_req: Request, res: Response) => {
    if (!oidcClient) {
      res.status(503).json({ error: 'SSO not configured' });
      return;
    }

    const state = generators.state();
    const nonce = generators.nonce();
    stateStore.set(state, nonce);

    // Clean up old states after 10 min
    setTimeout(() => stateStore.delete(state), 10 * 60 * 1000);

    const url = oidcClient.authorizationUrl({
      scope: 'openid email profile',
      state,
      nonce,
    });

    res.redirect(url);
  });

  // OIDC callback
  app.get('/api/auth/sso/callback', async (req: Request, res: Response) => {
    if (!oidcClient) {
      res.status(503).json({ error: 'SSO not configured' });
      return;
    }

    const { state } = req.query as Record<string, string>;
    const nonce = stateStore.get(state);

    if (!nonce) {
      res.status(400).json({ error: 'Invalid state parameter' });
      return;
    }

    stateStore.delete(state);

    try {
      const params = oidcClient.callbackParams(req);
      const tokenSet = await oidcClient.callback(process.env.OIDC_REDIRECT_URI!, params, {
        state,
        nonce,
      });

      const userinfo = await oidcClient.userinfo(tokenSet);
      const { sub, email, name } = userinfo as any;

      if (!email) {
        res.status(400).json({ error: 'Email not provided by SSO provider' });
        return;
      }

      // Find or create user
      let user = await prisma.user.findFirst({
        where: { OR: [{ ssoSubject: sub }, { email: email.toLowerCase() }] },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email: email.toLowerCase(),
            displayName: name || email,
            ssoProvider: 'oidc',
            ssoSubject: sub,
            role: 'PLAYER',
          },
        });
      } else if (!user.ssoSubject) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { ssoProvider: 'oidc', ssoSubject: sub },
        });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      await audit({
        userId: user.id,
        action: 'SSO_LOGIN',
        ipAddress: req.headers['x-forwarded-for']?.toString() || req.ip,
      });

      const { accessToken, refreshToken } = await issueTokens(user);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

      res
        .cookie('access_token', accessToken, cookieOptions())
        .cookie('refresh_token', refreshToken, { ...cookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 })
        .redirect(`${frontendUrl}/auth/callback?success=true`);
    } catch (err) {
      logger.error('OIDC callback error', { error: err });
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/auth/callback?error=sso_failed`);
    }
  });

  // Initialize OIDC client
  initOIDC();
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 15 * 60 * 1000, // 15 minutes for access token
  };
}
