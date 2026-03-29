# Single-stage build for Next.js standalone output
# Compatible with Docker 1.13.x (no multi-stage support)

FROM node:20-bullseye
WORKDIR /app

# Force ASCII output — old docker-compose chokes on Unicode progress bars
ENV LANG=C.UTF-8 LC_ALL=C.UTF-8
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --reporter=append-only
RUN npx playwright install --with-deps chromium

# Copy source and build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_DRAWBOARD_URL=http://localhost:3500
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:3100
ARG NEXT_PUBLIC_ASSET_PREFIX=
ARG NEXT_PUBLIC_BASE_PATH=
# Client bundle: must be set at build time (runtime .env alone does not change NEXT_PUBLIC_* in the browser).
ARG NEXT_PUBLIC_DRAWBOARD_CAPTURE_MODE=playwright
ARG NEXT_PUBLIC_REMOTE_SYNC_DEBOUNCE_MS=0
ENV NEXT_PUBLIC_DRAWBOARD_URL=$NEXT_PUBLIC_DRAWBOARD_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_WEBSOCKET_URL=$NEXT_PUBLIC_WEBSOCKET_URL
ENV NEXT_PUBLIC_ASSET_PREFIX=$NEXT_PUBLIC_ASSET_PREFIX
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
ENV NEXT_PUBLIC_DRAWBOARD_CAPTURE_MODE=$NEXT_PUBLIC_DRAWBOARD_CAPTURE_MODE
ENV NEXT_PUBLIC_REMOTE_SYNC_DEBOUNCE_MS=$NEXT_PUBLIC_REMOTE_SYNC_DEBOUNCE_MS
RUN pnpm build

# Next.js standalone needs static files and public dir alongside server.js
RUN cp -r .next/static .next/standalone/.next/static && \
    cp -r public .next/standalone/public && \
    cp /app/proxy-wrapper.js .next/standalone/

# Set up production runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

WORKDIR /app/.next/standalone

EXPOSE 3000

CMD ["node", "proxy-wrapper.js"]
