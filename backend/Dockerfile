# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Base — shared by dev and prod
# ---------------------------------------------------------------------------
FROM node:24-alpine AS base
WORKDIR /app
# Prisma's engines need openssl; bcrypt may need to build from source.
RUN apk add --no-cache openssl libc6-compat

# ---------------------------------------------------------------------------
# deps — install node_modules (cached on package.json changes only)
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# The `postinstall` script runs `prisma generate`, which loads prisma.config.ts
# and requires DATABASE_URL to be set. The value is not connected to at build
# time — only parsed — so a placeholder is enough here. The real URL is
# injected at runtime by docker-compose.
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
RUN npm ci

# ---------------------------------------------------------------------------
# dev — hot reload via `nest start --watch`, source bind-mounted by compose
# ---------------------------------------------------------------------------
FROM base AS dev
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 4003
CMD ["npm", "run", "start:dev"]

# ---------------------------------------------------------------------------
# build — compile TypeScript to dist/
# ---------------------------------------------------------------------------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
# Bust cache when seed/boot path changes
ENV DOCTRACKER_SEED_REV=3
RUN npx prisma generate && npm run build

# ---------------------------------------------------------------------------
# prod — slim runtime image
# ---------------------------------------------------------------------------
FROM base AS prod
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
# Seed runs after listen from dist/main.js (see src/main.ts) so /health is not blocked.
# Bump to bust Railway layer cache when seed/boot path changes.
ENV DOCTRACKER_SEED_REV=3
COPY package.json prisma.config.ts ./
EXPOSE 4003
CMD ["node", "dist/main.js"]
