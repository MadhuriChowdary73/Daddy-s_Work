# Use Node.js LTS
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package manifests
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Expose server port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Start server (auto-seeds database on startup if unseeded)
CMD ["node", "server.js"]
