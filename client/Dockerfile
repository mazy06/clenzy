# Build stage
FROM node:20-alpine AS build
WORKDIR /app

# Build args pour les variables d'environnement Vite
ARG VITE_API_BASE_URL=http://localhost:8084
ARG VITE_API_BASE_PATH=/api
ARG VITE_KEYCLOAK_URL=http://localhost:8083
ARG VITE_KEYCLOAK_REALM=clenzy
ARG VITE_KEYCLOAK_CLIENT_ID=clenzy-web
ARG VITE_APP_NAME=Clenzy
ARG VITE_APP_VERSION=1.0.0

# Les rendre disponibles comme variables d'environnement pour le build Vite
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_API_BASE_PATH=$VITE_API_BASE_PATH
ENV VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL
ENV VITE_KEYCLOAK_REALM=$VITE_KEYCLOAK_REALM
ENV VITE_KEYCLOAK_CLIENT_ID=$VITE_KEYCLOAK_CLIENT_ID
ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_APP_VERSION=$VITE_APP_VERSION

COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./

# Installer les dépendances avec le bon gestionnaire de paquets
# Note: ETXTBSY fix — on supprime le binaire esbuild potentiellement corrompu
# avant la validation post-install (bug Docker + Alpine + npm ci + esbuild)
RUN if [ -f package-lock.json ]; then \
      npm ci --ignore-scripts && \
      node node_modules/esbuild/install.js && \
      npm cache clean --force; \
    elif [ -f yarn.lock ]; then \
      yarn install --frozen-lockfile && yarn cache clean; \
    elif [ -f pnpm-lock.yaml ]; then \
      pnpm install --frozen-lockfile && pnpm store prune; \
    else \
      npm install && npm cache clean --force; \
    fi

COPY . .
RUN npm run build

# Run stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
