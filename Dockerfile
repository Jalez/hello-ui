# Single-stage build for Next.js standalone output
# Compatible with Docker 1.13.x (no multi-stage support)

FROM node:20-bullseye
WORKDIR /app

# Force ASCII output — old docker-compose chokes on Unicode progress bars
ENV LANG=C.UTF-8 LC_ALL=C.UTF-8

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --reporter=append-only

# Copy source and build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_DRAWBOARD_URL=http://localhost:3500
ARG NEXT_PUBLIC_BASE_PATH=
ENV NEXT_PUBLIC_DRAWBOARD_URL=$NEXT_PUBLIC_DRAWBOARD_URL
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
RUN pnpm build

# Set up production runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

CMD ["node", ".next/standalone/server.js"]
