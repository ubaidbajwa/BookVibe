# ---- BookVibe Frontend (Vite/React → static, served by Nginx) ----

# Stage 1: build the static bundle
FROM node:20-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Vite inlines VITE_* variables at BUILD time, so they must be passed as
# build args. For the same-origin Nginx setup these are relative paths:
#   VITE_API_URL=/api/v1   → REST calls hit Nginx, which proxies to backend
#   VITE_SOCKET_URL=""     → Socket.io connects to the same origin
ARG VITE_API_URL=/api/v1
ARG VITE_SOCKET_URL=
ARG VITE_ADMIN_PATH
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
ENV VITE_ADMIN_PATH=$VITE_ADMIN_PATH

RUN npm run build

# Stage 2: serve with Nginx (also acts as reverse proxy to the backend)
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
