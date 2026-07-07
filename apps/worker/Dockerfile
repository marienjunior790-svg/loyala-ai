# Loyala AI worker — bundled for production (Railway)
FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/worker ./apps/worker
COPY packages ./packages
RUN pnpm install --frozen-lockfile --filter worker...
RUN pnpm --filter worker build:bundle

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/worker/dist/server.mjs ./server.mjs
COPY --from=build /app/apps/worker/dist/server.mjs.map ./server.mjs.map
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "server.mjs"]
