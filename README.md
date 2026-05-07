# SprintVote

A lightweight, real-time, browser-based Planning Poker app for agile teams. No authentication, no persistence, minimal friction.

## Features

- **Real-time voting** — WebSocket-powered, instant updates for all participants
- **No roles** — all participants are equal (anyone can reveal, reset, or kick)
- **Reconnection** — rejoin a room after disconnect via localStorage session token
- **5 visual themes** — Light, Dark, Retro Pixel, Cyberpunk, Forest (stored locally)
- **Confetti** — celebratory animation when all votes are unanimous
- **Share links** — one-click copy to invite teammates
- **Card deck** — `1, 2, 3, 5, 8, 13, 20, 40, 100, ?, ☕`
- **Room expiry** — rooms auto-expire after 24h of inactivity

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| Frontend | React 19, Vite 7, Tailwind CSS 4, shadcn/ui |
| Routing | wouter v3 |
| State | Zustand |
| Backend | Bun.serve() (native HTTP + WebSocket) |
| Deployment | Docker, Caddy |

## Quick Start (Development)

Prerequisites: [Bun](https://bun.sh) v1.3+

```bash
# Install dependencies
cd server && bun install && cd ..
cd client && bun install && cd ..

# Start the backend (port 3000)
cd server && bun run dev &

# Start the frontend dev server (port 5173, proxies API/WS to 3000)
cd client && bun run dev
```

Open http://localhost:5173 in your browser.

## Production Build

```bash
# Build the frontend
cd client && bun run build

# Start the server (serves API + built frontend)
cd server && NODE_ENV=production bun run start
```

The server runs on port 3000 and serves both the API and the static frontend.

## Docker Deployment

```bash
# Build and run with Docker
docker build -t sprintvote .
docker run -p 3000:3000 sprintvote
```

### With Caddy (HTTPS)

1. Edit `Caddyfile` — replace `yourdomain.example.com` with your actual domain
2. Point your domain's DNS to your server's IP
3. Run:

```bash
docker compose up -d
```

Caddy will auto-provision HTTPS via Let's Encrypt. The app will be available at `https://yourdomain.example.com`.

## Project Structure

```
scrum_poker/
├── shared/types.ts          # Shared TypeScript types (RoomState, messages)
├── server/src/
│   ├── index.ts             # Bun.serve() — HTTP + WebSocket + static serving
│   ├── room.ts              # Room CRUD, in-memory store, cleanup
│   └── handlers.ts          # WebSocket message dispatch, broadcast
├── client/src/
│   ├── App.tsx              # Routes, theme init
│   ├── pages/               # HomePage, RoomPage, NotFoundPage
│   ├── components/          # CardGrid, ParticipantList, VoteSummary, etc.
│   ├── stores/              # Zustand store
│   ├── hooks/               # useWebSocket, useConfettiOnReveal
│   ├── themes/              # Theme system (5 themes)
│   └── lib/                 # Utilities, confetti
├── Dockerfile               # Multi-stage build
├── docker-compose.yml       # App + Caddy
└── Caddyfile                # Reverse proxy config
```

## WebSocket Protocol

**Client → Server:**
- `join` — join a room with a display name (+ optional session token for reconnection)
- `vote` — cast a vote
- `reveal` — reveal all votes
- `reset` — clear all votes
- `kick` — remove a participant

**Server → Client:**
- `room_state` — full room snapshot (personalized per participant)
- `error` — error message
- `kicked` — you were kicked from the room

## Running Tests

```bash
# Start the server first
cd server && bun run dev &

# Run the E2E test suite
bun run test-e2e.ts
```
