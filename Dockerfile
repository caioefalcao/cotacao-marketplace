# ── Stage 1: Build React frontend ──────────────────────────────────
FROM node:22-slim AS frontend-build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Backend + Playwright Chromium ──────────────────────────
FROM node:22-bookworm AS production
WORKDIR /app

# Install backend deps (devDeps needed for TypeScript compile)
COPY backend/package*.json ./backend/
RUN cd backend && npm ci

# Build TypeScript
COPY backend/ ./backend/
RUN cd backend && npm run build

# Install Playwright Chromium with all OS-level dependencies
RUN cd backend && npx playwright install chromium --with-deps

# Remove devDependencies to slim the final image
RUN cd backend && npm prune --omit=dev

# Copy built frontend
COPY --from=frontend-build /frontend/dist ./frontend/dist

# Runtime data directories
RUN mkdir -p data screenshots

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "backend/dist/server.js"]
