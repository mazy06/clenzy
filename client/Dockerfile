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
RUN npm ci || yarn install || pnpm install
COPY . .
RUN npm run build || yarn build || pnpm build

# Run stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
