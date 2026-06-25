# ---- BookVibe Backend (Express 5 + Socket.io) ----
# Debian slim is used (not alpine) because bcrypt ships glibc prebuilt
# binaries; alpine/musl would force a slow native compile.
FROM node:20-slim

WORKDIR /app

# Install production dependencies first for better layer caching.
# Only package*.json change → this layer is reused on code-only edits.
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY . .

ENV NODE_ENV=production
# PORT is overridden by docker-compose; 3000 is the in-container default.
ENV PORT=3000

EXPOSE 3000

# Container-level health check (Node 20 has global fetch).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Drop root privileges (the built-in 'node' user).
USER node

CMD ["node", "index.js"]
