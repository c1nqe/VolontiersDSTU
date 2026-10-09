# Сервер «Волонтёры ДГТУ» вместе с собранным фронтендом.
# Сборка: docker build -t volontiers .
# Запуск: см. docker-compose.yml (профиль app) и docs/BACKEND.md.
# Файл написан без возможности собрать его в среде разработки (там нет Docker) — при первой сборке проверьте вывод.

FROM node:20-slim AS web
WORKDIR /web
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM rust:1-slim AS server
WORKDIR /srv
RUN apt-get update && apt-get install -y --no-install-recommends pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
COPY backend ./backend
COPY schema.graphql operations.graphql ./
WORKDIR /srv/backend
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libssl3 && rm -rf /var/lib/apt/lists/* \
    && useradd --system --create-home --uid 10001 volontiers
WORKDIR /app
COPY --from=server /srv/backend/target/release/volontiers-server /app/volontiers-server
COPY --from=web /web/dist /app/dist
USER volontiers
ENV BIND=0.0.0.0:8080 STATIC_DIR=/app/dist APP_ENV=production RUN_MIGRATIONS=false TRUST_PROXY=true
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD ["/bin/sh", "-c", "exec 3<>/dev/tcp/127.0.0.1/8080 && printf 'GET /healthz HTTP/1.0\\r\\n\\r\\n' >&3 && grep -q ok <&3"]
ENTRYPOINT ["/app/volontiers-server"]
CMD ["serve"]
