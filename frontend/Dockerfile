# CyberTabletop Frontend — Production Dockerfile
# Multi-stage: build Vite app, serve with Nginx

FROM node:20-alpine AS builder

ARG VITE_API_URL=/api
ARG VITE_WS_URL=/
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Production: lightweight Nginx ───────────────────────────────────────
FROM nginx:alpine-slim AS production

# Security: run as non-root (NIST AC-6)
RUN adduser -D -u 1001 appuser && \
    chown -R appuser:appuser /usr/share/nginx/html /var/cache/nginx && \
    touch /var/run/nginx.pid && chown appuser /var/run/nginx.pid

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf

USER appuser
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
