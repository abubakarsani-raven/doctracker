# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------
FROM node:24-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# ---------------------------------------------------------------------------
# deps
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# dev — `next dev` with source bind-mounted by compose
# ---------------------------------------------------------------------------
FROM base AS dev
ENV NODE_ENV=development
# Poll the filesystem: inotify events do not reliably cross the macOS/Linux
# bind-mount boundary, so without this the dev server misses file changes.
ENV WATCHPACK_POLLING=true
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---------------------------------------------------------------------------
# build
# ---------------------------------------------------------------------------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* values are inlined at build time, so the API URL must be known
# here rather than injected at runtime.
ARG NEXT_PUBLIC_API_URL=http://localhost:4003
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

# ---------------------------------------------------------------------------
# prod
# ---------------------------------------------------------------------------
FROM base AS prod
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY package.json next.config.ts ./
EXPOSE 3000
CMD ["npm", "run", "start"]
