# ── lumora-website Dockerfile ────────────────────────────────────────
# Public marketing + booking site. Connects to the SAME database as the
# PMS but NEVER runs migrations — the PMS owns the schema.
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
# postinstall runs `prisma generate`; DATABASE_URL not required for that
RUN npm ci

FROM base AS build
# NEXT_PUBLIC_* are inlined at build time — supply them as build args.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_CLINIC_NAME
ARG NEXT_PUBLIC_CLINIC_PHONE
ARG NEXT_PUBLIC_CLINIC_EMAIL
ARG NEXT_PUBLIC_CLINIC_ADDRESS
ARG NEXT_PUBLIC_CLINIC_WHATSAPP
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_CLINIC_NAME=$NEXT_PUBLIC_CLINIC_NAME \
    NEXT_PUBLIC_CLINIC_PHONE=$NEXT_PUBLIC_CLINIC_PHONE \
    NEXT_PUBLIC_CLINIC_EMAIL=$NEXT_PUBLIC_CLINIC_EMAIL \
    NEXT_PUBLIC_CLINIC_ADDRESS=$NEXT_PUBLIC_CLINIC_ADDRESS \
    NEXT_PUBLIC_CLINIC_WHATSAPP=$NEXT_PUBLIC_CLINIC_WHATSAPP
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.js ./next.config.js
EXPOSE 3001
# start script already pins port 3001 (next start -p 3001)
CMD ["npm", "run", "start"]
