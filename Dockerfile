# SnapTag Dockerfile - Railway Production Build

FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache \
    exiftool \
    curl \
    vips-dev

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Copy client package files
COPY client/package*.json ./client/

# Install ALL dependencies (dev dependencies needed for React build)
RUN npm install

# Install client dependencies (including dev deps for build)
WORKDIR /app/client
RUN npm install

# Return to app directory and copy all source files
WORKDIR /app
COPY . .

# Verify client structure exists
RUN ls -la client/public/ && cat client/public/index.html

# Build client
WORKDIR /app/client
RUN npm run build

# Return to app directory
WORKDIR /app

# Create required directories
RUN mkdir -p server/data temp

# Remove dev dependencies to reduce image size
RUN npm prune --production && cd client && npm prune --production

# Expose port (Railway uses PORT env var)
EXPOSE ${PORT:-3001}

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3001}/api/health || exit 1

# Start server
CMD ["node", "server/server.js"] 