# Production image for the single-process Next.js application.
#
# Build from the repository root:
#   docker compose build
# or directly:
#   docker build -t kirameku:local ./Kirameku

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1
RUN npm install --global pnpm@12.8.1
WORKDIR /app

# Toolchain for better-sqlite3 / sharp when no prebuilt binary exists for the
# target platform. This stage is not copied into the runtime image.
FROM base AS build-deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

FROM build-deps AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY . .
# Build-time placeholders only. The build database is discarded and the real
# AUTH_SECRET is injected by the runtime environment. Keep these inline so the
# placeholder is not persisted as image metadata.
RUN DATABASE_PATH=/tmp/kirameku-build.db \
    AUTH_SECRET=build-only-secret-0123456789abcdef0123456789abcdef \
    FRONTEND_ORIGIN=http://localhost:3000 \
    sh -c 'pnpm db:migrate && pnpm build && pnpm install --frozen-lockfile --prod && rm -rf .next/cache'

FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_PATH=/data/db/kirameku.db \
    UPLOAD_DIR=/data/uploads \
    BACKUP_DIR=/data/backups
WORKDIR /app

COPY --from=builder --chown=node:node /app ./
RUN chmod +x docker-entrypoint.sh \
  && chown node:node /app \
  && mkdir -p /data/db /data/uploads /data/backups \
  && chown -R node:node /data

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '3000') + '/api/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["pnpm", "start"]
