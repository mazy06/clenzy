# Runtime CopilotKit (Node) — image PROD.
# Build : routeur AG-UI mince devant le backend Java Clenzy (POST /api/agui/run).
# Diffère de Dockerfile.dev : install déterministe (npm ci sur le lockfile),
# pas de rebuild à chaud, NODE_ENV=production.
FROM node:20-alpine
WORKDIR /app

# Couche deps (cache tant que package.json / package-lock.json ne changent pas).
# `npm ci` exige package-lock.json (présent) → install reproductible.
# Résilient aux hoquets réseau (ECONNRESET) : retries internes npm + 3 tentatives
# avec backoff. La dernière tentative détermine le code de sortie.
COPY package.json package-lock.json ./
RUN npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && (npm ci --omit=dev || (sleep 10 && npm ci --omit=dev) || (sleep 20 && npm ci --omit=dev))

# Source (server.mjs uniquement utile ; .dockerignore exclut node_modules local).
COPY . .

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Healthcheck léger : le serveur expose GET /health (cf. server.mjs).
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.mjs"]
