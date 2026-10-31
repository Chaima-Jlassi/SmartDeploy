# Stage 1 — builder: install all deps and run tests
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm test

# Stage 2 — runtime: production deps only, non-root user
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && \
    addgroup -S -g 10001 appgroup && \
    adduser -S -u 10001 -G appgroup appuser
COPY --from=builder /app/index.js .
USER 10001:10001
EXPOSE 3000
CMD ["node", "index.js"]