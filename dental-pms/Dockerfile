# ── dental-pms Dockerfile ────────────────────────────────────────────
# Multi-stage build. The PMS is the SOLE owner of the shared database
# schema: its entrypoint runs `prisma migrate deploy` on startup.
FROM node:20-alpine AS base
WORKDIR /app
# openssl + libc6-compat are required by Prisma's query engine on Alpine
RUN apk add --no-cache libc6-compat openssl

# ── deps: install all dependencies (dev deps needed to build) ─────────
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ── build: generate Prisma client + compile Next.js ──────────────────
FROM base AS build
# NEXT_PUBLIC_* values are inlined into the client bundle at build time,
# so they must be present here as build args — not only at runtime.
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_DEFAULT_CURRENCY
ARG NEXT_PUBLIC_USD_RATE
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_DEFAULT_CURRENCY=$NEXT_PUBLIC_DEFAULT_CURRENCY \
    NEXT_PUBLIC_USD_RATE=$NEXT_PUBLIC_USD_RATE
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ── runner: production image ─────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
# node_modules kept whole so the Prisma CLI is available for migrate deploy
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.js ./next.config.js
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
