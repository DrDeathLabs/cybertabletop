# CyberTabletop Backend — Production Dockerfile
# Multi-stage build for minimal attack surface (NIST CM-7 Least Functionality)

FROM node:20-alpine AS builder

WORKDIR /app

# Install openssl — required by Prisma on Alpine
RUN apk add --no-cache openssl

# Install dependencies
COPY package*.json ./
RUN npm ci --include=dev

# Copy source and build
COPY . .
RUN npx prisma generate
RUN npm run build

# ── Production stage ─────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Security: run as non-root user (NIST AC-6 Least Privilege)
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Install openssl (Prisma) and curl (healthcheck)
RUN apk add --no-cache openssl curl

WORKDIR /app

# Install only production deps
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma

# Set ownership
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3001

# Apply migrations, then start the application.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
