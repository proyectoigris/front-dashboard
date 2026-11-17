# --- Etapa 1: compilación (Linux arm64 / Raspberry Pi OS) ---
# Las dependencias se instalan dentro del contenedor para obtener los binarios
# nativos de Linux (esbuild, rollup, tailwind oxide), no los de Windows.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# --- Etapa 2: servidor estático ---
FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
