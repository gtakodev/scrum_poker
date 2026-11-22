FROM node:24-bookworm-slim AS dependencies
WORKDIR /app

RUN npm install --global pnpm@11.5.2

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY shared/ ./shared/

FROM dependencies AS frontend-build
COPY client/ ./client/
RUN pnpm build

FROM dependencies AS production
ENV NODE_ENV=production

COPY server/ ./server/
COPY --from=frontend-build /app/client/dist/ ./client/dist/

USER node
EXPOSE 3000
CMD ["pnpm", "--filter", "server", "start"]
