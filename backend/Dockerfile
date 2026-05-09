# ─── Stage 1: Install production dependencies ─────────────────────────────────
FROM node:18-alpine AS deps

WORKDIR /app

# Copy lock files first — maximises Docker layer cache reuse
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ─── Stage 2: Production image ────────────────────────────────────────────────
FROM node:18-alpine AS production

# dumb-init: proper PID 1 — forwards OS signals (SIGTERM) to Node for graceful shutdown
RUN apk add --no-cache dumb-init wget

# Run as non-root user (security best practice)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy production node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy only runtime files (no tests, no dev configs)
COPY package.json ./
COPY src/ ./src/
COPY migrations/ ./migrations/
COPY scripts/ ./scripts/

# Own all files as appuser before switching user
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

# Docker / ECS health check — polls /health every 30s
# Container is marked unhealthy after 3 consecutive failures
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/health | grep -q '"status":"ok"' || exit 1

# dumb-init as PID 1 ensures Node receives SIGTERM and shuts down gracefully
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
