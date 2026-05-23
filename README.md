# SprintVote

A lightweight, real-time, browser-based Planning Poker app for agile teams. No authentication, no persistence, minimal friction.

## Features

- **Real-time voting** - WebSocket-powered, instant updates for all participants
- **Re-vote after reveal** - adjust estimates live without starting a new round
- **No roles** - all participants are equal (anyone can reveal, reset, or kick)
- **Session resume** - rejoin a room after a disconnect via a localStorage-backed `sessionToken`
- **Single active tab per session** - a newer tab replaces the older socket for the same participant
- **Kick handling** - a kicked client stops auto-reconnecting; the room link still works for a manual return
- **5 visual themes** - Daylight, Obsidian, Neon Arcade, Blueprint, Desert Atelier
- **Unanimous reveal confetti** - celebratory animation when all votes are unanimous
- **Reduced motion support** - confetti and motion-heavy UI effects back off under `prefers-reduced-motion`
- **Share links** - one-click copy to invite teammates
- **Card deck** - `1, 2, 3, 5, 8, 13, 20, 40, 100, ?, ☕`
- **Room expiry** - rooms auto-expire after 24h of inactivity

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun 1.3+ |
| Frontend | React 19, Vite 7, Tailwind CSS 4 |
| UI | Radix UI primitives, Sonner |
| Routing | wouter 3 |
| State | Zustand 5 |
| Backend | Bun.serve() + TypeScript |
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
│   ├── handlers.ts          # WebSocket message dispatch, personalized broadcasts
│   └── validation.ts        # Shared input normalization helpers
├── client/src/
│   ├── App.tsx              # Routes, theme document sync
│   ├── pages/               # HomePage, RoomPage, NotFoundPage
│   ├── components/          # CardGrid, ParticipantList, VoteSummary, etc.
│   ├── stores/              # Serializable UI/application state
│   ├── hooks/               # React lifecycle bindings for sockets and effects
│   ├── themes/              # Theme source of truth (5 themes)
│   └── lib/                 # Imperative adapters and utilities
├── scripts/verify.ts        # Root verification (typecheck + tests + build + E2E)
├── Dockerfile               # Multi-stage build
├── docker-compose.yml       # App + Caddy
└── Caddyfile                # Reverse proxy config
```

## Client Layer Responsibilities

- `stores/` keeps serializable room UI state only. It does not own browser resources such as WebSocket instances.
- `hooks/` binds React lifecycle to external systems. `useWebSocket` opens, closes, reconnects, and translates server messages into store updates.
- `lib/roomSocket.ts` is the narrow imperative adapter used by components to send room commands through the active socket.
- `themes/` owns theme state and theme-specific derived values.
- `components/` render state and dispatch user intent; they do not manage connection lifecycle.

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

## Session and Kick Behavior

- The client stores one `sessionToken` per room in `localStorage`.
- Rejoining with a still-valid token restores the same `participantId`.
- A session allows only one active tab at a time. If a newer tab joins with the same token, the server closes the older socket.
- When the client receives `kicked`, it stops the automatic reconnect loop and shows an error.
- A kicked user can still open the room link manually. If the old token was invalidated by the kick, the server creates a new participant identity.

## Theme Strategy

`client/src/themes/index.ts` is the single source of truth for theme state.

- `useTheme()` reads the current app theme from localStorage-backed state
- `setTheme()` updates storage and notifies all theme consumers
- `App.tsx` applies the current theme classes to `<html>`
- `ThemeSelector`, `useConfettiOnReveal`, and toast rendering all consume that same theme state

`next-themes` is intentionally not used.

## Verification and Tests

Recommended from the repo root:

```bash
bun run verify
```

`bun run verify` runs:

- server typecheck
- server unit tests
- client production build
- `test-e2e.ts` against a temporary local server

Focused commands from the repo root:

```bash
bun run typecheck
bun run test:server
bun run build:client

# Requires a server already running on PORT 3000 (or $PORT)
bun run test:e2e
```
