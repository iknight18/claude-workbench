# Stage 1: Build
FROM node:22-slim AS build
WORKDIR /app

# Install build dependencies for native modules (better-sqlite3, node-pty)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy workspace package files first for better caching
COPY package*.json turbo.json ./
COPY client/package*.json client/
COPY server/package*.json server/

RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Runtime
FROM node:22-slim

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y git procps && \
    rm -rf /var/lib/apt/lists/*

# Install Claude CLI
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app

# Copy root node_modules (workspaces hoist deps here, includes native modules)
COPY --from=build /app/node_modules node_modules

# Copy server build
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/server/package.json server/

# Copy client standalone build (includes its own node_modules)
COPY --from=build /app/client/.next/standalone ./standalone
COPY --from=build /app/client/.next/static ./standalone/client/.next/static
COPY --from=build /app/client/public ./standalone/client/public

# Copy entrypoint
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create default data directories
# /mnt/c/Users silences Claude CLI's WSL IDE lockfile detection (harmless ENOENT in Docker)
RUN mkdir -p /data/db /data/profiles /workspace /mnt/c/Users

ENV DATA_DIR=/data
ENV IS_SANDBOX=1
EXPOSE 4200 4201

ENTRYPOINT ["/entrypoint.sh"]
