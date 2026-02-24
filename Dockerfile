# Single-stage build for Next.js standalone output
# Compatible with Docker 1.13.x (no multi-stage support)

FROM node:20-bullseye
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_DRAWBOARD_URL=http://localhost:3500
ENV NEXT_PUBLIC_DRAWBOARD_URL=$NEXT_PUBLIC_DRAWBOARD_URL
RUN pnpm build

# Set up production runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

CMD ["node", ".next/standalone/server.js"]
