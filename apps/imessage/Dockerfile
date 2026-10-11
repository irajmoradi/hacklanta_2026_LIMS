FROM oven/bun:1.3.10
WORKDIR /app
COPY apps/imessage/package.json apps/imessage/bun.lock ./
RUN bun install --frozen-lockfile --production
COPY apps/imessage/src ./src
COPY infra/imessage-entrypoint.sh /usr/local/bin/village-imessage
USER bun
ENTRYPOINT ["sh", "/usr/local/bin/village-imessage"]
