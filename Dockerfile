# ---- Builder Stage ----
FROM node:24-alpine AS builder

WORKDIR /webserver

# Install build tools needed by native deps (e.g. bcrypt, better-sqlite3)
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json server.ts ./
COPY app/ ./app/
RUN npm run build

# ---- Runtime Stage ----
FROM node:24-alpine

WORKDIR /webserver

COPY package.json package-lock.json* ./
RUN npm ci && npm install -g nodemon && npm cache clean --force

# Copy compiled JS from builder
COPY --from=builder /webserver/dist ./dist
COPY tsconfig.json ./

ENV NODE_DOCKER_HOST=0.0.0.0 \
    NODE_DOCKER_PORT=8080

EXPOSE 8080

CMD ["node", "dist/server.js"]
