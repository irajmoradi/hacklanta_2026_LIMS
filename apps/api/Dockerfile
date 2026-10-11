FROM ghcr.io/astral-sh/uv:0.10.9 AS uv
FROM python:3.12-slim-bookworm
COPY --from=uv /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PYTHONUNBUFFERED=1
WORKDIR /app/apps/api
COPY apps/api/pyproject.toml apps/api/uv.lock ./
RUN uv sync --frozen --no-dev
COPY apps/api/app ./app
COPY apps/api/scripts ./scripts
COPY apps/api/migrations ./migrations
COPY packages/catalog/furniture.json /app/packages/catalog/furniture.json
COPY packages/contracts/schema.sql /app/packages/contracts/schema.sql
RUN useradd --uid 10001 --create-home village && mkdir -p /app/data/assets && chown -R village:village /app/data
ENV PATH="/app/apps/api/.venv/bin:$PATH"
USER village
EXPOSE 8010
CMD ["uvicorn", "app.main:create_app", "--factory", "--no-proxy-headers", "--host", "0.0.0.0", "--port", "8010"]
