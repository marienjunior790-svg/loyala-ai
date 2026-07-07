# Loyala AI worker — production Docker image (monorepo root build)
FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter worker build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV WORKER_PORT=3000
COPY --from=build /app/apps/worker/dist ./apps/worker/dist
COPY --from=build /app/apps/worker/package.json ./apps/worker/package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
EXPOSE 3000
CMD ["node", "apps/worker/dist/index.js"]
