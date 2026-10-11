FROM oven/bun:1.3.10 AS build
WORKDIR /app
COPY apps/web/package.json apps/web/bun.lock ./
RUN bun install --frozen-lockfile
COPY apps/web/ ./
ARG VITE_MOCK=1
ENV VITE_MOCK=$VITE_MOCK
RUN bun run build
FROM caddy:2.10.2-alpine
COPY --from=build /app/dist /srv
COPY infra/Caddyfile /etc/caddy/Caddyfile
EXPOSE 80 443
