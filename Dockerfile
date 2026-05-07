# ─── Stage 1: Build frontend ───────────────────────────────────
FROM oven/bun:1 AS frontend-build
WORKDIR /app

# Copy shared types first (dependency of client)
COPY shared/ ./shared/

# Install client dependencies
COPY client/package.json client/bun.lock* ./client/
WORKDIR /app/client
RUN bun install --frozen-lockfile

# Copy client source and build
COPY client/ ./
RUN bun run build

# ─── Stage 2: Production server ───────────────────────────────
FROM oven/bun:1
WORKDIR /app

# Install server dependencies
COPY server/package.json server/bun.lock* ./server/
WORKDIR /app/server
RUN bun install --frozen-lockfile --production

# Copy server source
WORKDIR /app
COPY server/ ./server/

# Copy shared types
COPY shared/ ./shared/

# Copy built frontend
COPY --from=frontend-build /app/client/dist ./client/dist

# Expose port
EXPOSE 3000

# Set production environment
ENV NODE_ENV=production

# Start the server
CMD ["bun", "run", "server/src/index.ts"]
