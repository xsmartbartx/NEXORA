# syntax=docker/dockerfile:1
#
# One Dockerfile builds any of the 10 apps in this monorepo — pass which
# one via --build-arg APP_NAME=<workspace dir name under apps/>. See
# infrastructure/docker/README.md for the full build/run instructions and
# why this shape (npm workspaces + Next.js standalone output) works the
# way it does.
#
# Build context must be the repository root:
#   docker build -f infrastructure/docker/Dockerfile --build-arg APP_NAME=website -t nexora-website .

ARG NODE_VERSION=22-alpine

# ---- builder: install the whole workspace, build one app ----
FROM node:${NODE_VERSION} AS builder
WORKDIR /repo

# The whole workspace tree, not just one app — npm workspaces needs every
# package.json present to resolve the symlink graph (packages/* are real
# dependencies of apps/*, not just dev tooling). This trades some Docker
# layer-cache efficiency (any change anywhere invalidates the cache) for
# guaranteed-correct installs; revisit if build time becomes a problem.
COPY package.json package-lock.json ./
COPY apps ./apps
COPY packages ./packages
RUN npm ci

ARG APP_NAME
RUN test -n "$APP_NAME" || (echo "APP_NAME build-arg is required" && exit 1)
RUN npm run build --workspace apps/${APP_NAME}

# ---- runner: only the traced output, not the whole repo ----
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production

ARG APP_NAME
ARG APP_PORT=3000
ENV APP_NAME=${APP_NAME}
ENV PORT=${APP_PORT}
# Next.js standalone binds to localhost by default — wrong inside a
# container, where the request arrives from outside it.
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# `next.config.ts`'s `output: "standalone"` + `outputFileTracingRoot`
# (pointed at the monorepo root) traces exactly the node_modules this app
# needs into apps/<name>/.next/standalone, mirroring the monorepo's own
# path structure — hence copying into the same apps/<name>/... layout
# here rather than flattening it. Static assets and public/ are NOT part
# of that trace and must be copied separately (documented Next.js
# behaviour, not an oversight).
COPY --from=builder --chown=nextjs:nodejs /repo/apps/${APP_NAME}/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/${APP_NAME}/.next/static ./apps/${APP_NAME}/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/${APP_NAME}/public ./apps/${APP_NAME}/public

USER nextjs
EXPOSE ${APP_PORT}

CMD ["sh", "-c", "node apps/$APP_NAME/server.js"]
