# Stage 1 — builder: install ALL deps including devDeps for testing
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm test

# Stage 2 — runtime: only production deps, non-root user
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && \
    addgroup -S appgroup && \
    adduser -S appuser -G appgroup
COPY --from=builder /app/index.js .
USER appuser
EXPOSE 3000
CMD ["node", "index.js"]