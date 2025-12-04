# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY tsconfig*.json vite.config.ts index.html ./
COPY src ./src
RUN npm run build

# Production stage with server middleware
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY server.js ./server.js
COPY templates ./templates
EXPOSE 3000
CMD ["node", "server.js"]
