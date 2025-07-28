# SnapTag Dockerfile

FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache \
    exiftool \
    curl \
    vips-dev

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/ ./server/

# Install dependencies
RUN npm install --production

# Install client dependencies
WORKDIR /app/client
RUN npm install --production

# Build client
RUN npm run build

# Return to app directory
WORKDIR /app

# Create data and temp directories
RUN mkdir -p data temp

# Copy extension (for reference/documentation)
COPY extension/ ./extension/

# Copy Docker and config files
COPY docker-compose.yml README.md ./

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

# Start server
CMD ["npm", "start"] 