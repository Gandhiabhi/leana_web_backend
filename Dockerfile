# ───────────────────────────── Builder ─────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies (cached layer)
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# Build application
COPY . .
RUN npx prisma generate
RUN npm run build

# Remove dev dependencies to slim the runtime image
RUN npm prune --omit=dev

# ───────────────────────────── Runtime ─────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Run as non-root user
RUN addgroup -S nodejs && adduser -S nestjs -G nodejs

COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json

USER nestjs
EXPOSE 4000

# Apply pending migrations then start
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
