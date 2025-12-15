# Build stage
FROM node:20-bullseye AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json vite.config.ts index.html ./
COPY src ./src
RUN npm run build
RUN npm prune --omit=dev

# Production stage with server middleware
FROM node:20-bullseye
RUN apt-get update \
  && apt-get install -y --no-install-recommends awscli bash ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY server.js ./server.js
COPY templates ./templates
EXPOSE 3000
CMD ["node", "server.js"]
