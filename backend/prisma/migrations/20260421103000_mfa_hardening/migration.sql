-- Add encrypted TOTP MFA metadata and hashed recovery codes.
ALTER TABLE "User"
  ADD COLUMN "mfaVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "mfaRecoveryCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
