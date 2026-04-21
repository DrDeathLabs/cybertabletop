// Augment Express.User so req.user is properly typed throughout the app
// This replaces the passport default empty User interface

import { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      role: UserRole;
      orgId: string | null;
      displayName: string;
    }
  }
}

export {};
