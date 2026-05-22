FROM node:22-bookworm-slim AS frontend-deps
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci

FROM node:22-bookworm-slim AS frontend-build
WORKDIR /app/frontend
COPY --from=frontend-deps /app/frontend/node_modules ./node_modules
COPY frontend ./
RUN npm run build

FROM node:22-bookworm-slim AS backend-deps
WORKDIR /app/backend
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY backend/package*.json ./
COPY backend/prisma ./prisma
RUN npm ci

FROM node:22-bookworm-slim AS backend-build
WORKDIR /app/backend
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=backend-deps /app/backend/node_modules ./node_modules
COPY backend ./
RUN npm run prisma:generate && npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app/backend
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=backend-build /app/backend/package*.json ./
COPY --from=backend-build /app/backend/node_modules ./node_modules
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=backend-build /app/backend/prisma ./prisma
COPY --from=frontend-build /app/frontend/dist ../frontend/dist
RUN mkdir -p uploads
EXPOSE 4000
CMD ["node", "dist/server.js"]
