# LMS API — staging/production image (monorepo root as build context)
# Build:  docker build -f apps/api/Dockerfile .
# Run:    docker run --env-file .env -p 3001:3001 lms-api

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
COPY apps/api/package.json apps/api/
COPY packages/types/package.json packages/types/
COPY packages/utils/package.json packages/utils/
COPY packages/config/package.json packages/config/
RUN pnpm install --frozen-lockfile

COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm db:generate \
  && pnpm --filter @lms/types build \
  && pnpm --filter @lms/utils build \
  && pnpm --filter @lms/api build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
COPY apps/api/package.json apps/api/
COPY packages/types/package.json packages/types/
COPY packages/utils/package.json packages/utils/
COPY packages/config/package.json packages/config/
RUN pnpm install --frozen-lockfile --prod \
  && pnpm add -w prisma@^6.8.2 @prisma/client@^6.8.2 \
  && pnpm exec prisma generate --schema=./prisma/schema.prisma

COPY --from=build /app/packages/types/dist ./packages/types/dist
COPY --from=build /app/packages/utils/dist ./packages/utils/dist
COPY --from=build /app/apps/api/dist ./apps/api/dist

COPY scripts/docker-start-api.sh ./scripts/docker-start-api.sh
RUN chmod +x ./scripts/docker-start-api.sh

EXPOSE 3001
CMD ["./scripts/docker-start-api.sh"]
