# Loyala AI worker — bundled + pnpm deploy for inngest runtime dep
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/worker ./apps/worker
COPY packages ./packages
RUN pnpm install --frozen-lockfile --filter worker...
RUN pnpm --filter worker build:bundle
RUN pnpm --filter worker deploy /deploy --prod

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /deploy ./
COPY --from=build /app/apps/worker/dist/server.mjs ./server.mjs
COPY --from=build /app/apps/worker/dist/server.mjs.map ./server.mjs.map
EXPOSE 3000
CMD ["node", "server.mjs"]
