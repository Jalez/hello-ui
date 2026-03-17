# UI Designer

A gamified platform for learning CSS, HTML, and UI design through interactive challenges with real-time collaboration, pixel-perfect feedback, and AI-powered assistance.

A live instance is running at [tie-lukioplus.rd.tuni.fi/css-artist](https://tie-lukioplus.rd.tuni.fi/css-artist), used in courses at Tampere University.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC)

## Features

### Game Modes
- **Player Mode** (`/game/[gameId]`) — Complete design challenges solo or in groups
- **Creator Mode** (`/creator/[gameId]`) — Build and customize games with maps and levels
- **Public Games** (`/games`) — Browse and play community-created games via share links
- **LTI Integration** — Embed games in learning management systems (Canvas, Blackboard, A+) with automatic grade passback

### Real-time Collaboration
- Collaborative code editing powered by Yjs CRDTs over WebSocket
- Live cursor tracking and typing presence
- Group lobbies with chat and start-gate coordination
- Health monitoring with automatic divergence recovery

### Interactive Learning
- Live HTML/CSS/JS editors with CodeMirror 6
- Side-by-side artboards with pixel-perfect comparison
- Progressive difficulty levels with point scoring
- Leaderboards and per-level statistics
- AI-powered code generation and review (OpenAI)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS 4.0, Radix UI |
| State | Redux Toolkit |
| Database | PostgreSQL, Drizzle ORM |
| Editors | CodeMirror 6 |
| Collaboration | Yjs, y-websocket (custom WS server) |
| Auth | NextAuth.js (Google OAuth, LTI, dev local) |
| AI | OpenAI API |
| Payments | Stripe |

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm
- PostgreSQL

### Installation

```bash
git clone https://github.com/Jalez/ui-designer.git
cd ui-designer
pnpm install
cp .env.local.example .env.local
# Edit .env.local with your credentials
```

### Database Setup

```bash
pnpm db:init        # Create tables and schemas
```

### Start Development

```bash
pnpm dev            # Next.js app (port 3000)
# In a separate terminal:
cd ws-server && node server.mjs   # WebSocket server (port 3100)
```

Open http://localhost:3000.

## Running with Docker

```bash
cp .env.local.example .env.local
# Edit .env.local with your credentials
docker compose up --build
```

| Service   | Port | Description                    |
|-----------|------|--------------------------------|
| app       | 3000 | Next.js application            |
| ws-server | 3100 | WebSocket collaboration server |
| db        | 5433 | PostgreSQL database            |

```bash
docker compose up                  # Start (images must exist)
docker compose up --build -d       # Build and run in background
docker compose down                # Stop
docker compose down -v             # Stop and wipe database
```

> The container loads variables from `.env.local` automatically. The database connection is overridden internally to point to the Docker `db` service.

## Project Structure

```
ui-designer/
├── app/                       # Next.js App Router
│   ├── api/                   # API routes (games, groups, LTI, admin)
│   ├── game/[gameId]/         # Player game page
│   ├── creator/[gameId]/      # Creator editor and settings
│   ├── games/                 # Public games listing
│   ├── drawboard/             # Iframe-rendered HTML/CSS canvas
│   └── admin/                 # Admin dashboard
├── components/                # React components
│   ├── ArtBoards/             # Design canvas (Frame, drawboard iframes)
│   ├── Editors/               # CodeMirror editors with collaboration
│   ├── groups/                # Group lobby, presence, chat
│   └── ui/                    # Shared UI primitives (Radix-based)
├── lib/
│   ├── collaboration/         # Yjs provider, hooks, health monitoring
│   ├── db/schema/             # Drizzle ORM schemas
│   └── lti/                   # LTI 1.0 launch, identity, grade passback
├── store/                     # Redux Toolkit slices
├── ws-server/                 # Standalone Node.js WebSocket server
│   ├── server.mjs             # Entry point, room management
│   ├── socket-handlers/       # Editor, lobby, progress, session, Yjs
│   └── yjs-room-state.mjs    # Yjs document persistence
├── scripts/                   # DB init, migrations, maintenance
└── migrations/                # Database migrations
```

## Available Scripts

```bash
# Development
pnpm dev                # Start dev server
pnpm build              # Production build
pnpm start              # Production server
pnpm lint               # ESLint

# Database
pnpm db:init            # Initialize schemas
pnpm db:reset           # Purge and reinitialize
pnpm db:migrate         # Run Drizzle migrations
pnpm db:studio          # Open Drizzle Studio

# Testing (Playwright)
pnpm pw:local-group     # Group collaboration smoke test
pnpm pw:ws-recovery     # WebSocket recovery scenarios
pnpm pw:latency         # Artificial latency testing
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push and open a Pull Request

## License

This project is open source and available under the [MIT License](LICENSE).

## Support

If you find UI Designer helpful, consider supporting the project:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-%23FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/jalez)
