# SprintVote

A lightweight, real-time, browser-based Planning Poker app for agile teams. No authentication, no persistence, minimal friction.

## Features

- **Real-time voting** - WebSocket-powered, instant updates for all participants
- **Re-vote after reveal** - adjust estimates live without starting a new round
- **No roles** - all participants are equal (anyone can reveal, reset, or kick)
- **Session resume** - rejoin a room after a disconnect via a localStorage-backed `sessionToken`
- **Single active tab per session** - a newer tab replaces the older socket for the same participant
- **Kick handling** - a kicked client stops auto-reconnecting; the room link still works for a manual return
- **Fixed Obsidian theme** - one dark theme across the whole app
- **Unanimous reveal confetti** - celebratory animation when all votes are unanimous
- **Reduced motion support** - confetti and motion-heavy UI effects back off under `prefers-reduced-motion`
- **Share links** - one-click copy to invite teammates
- **Card deck** - `1, 2, 3, 5, 8, 13, 20, 40, 100, ?, ☕`
- **Room expiry** - rooms auto-expire after 24h of inactivity

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Workspace | pnpm |
| Frontend | React 19, Vite 7, Tailwind CSS 4 |
| Routing | TanStack Router |
| Server State | TanStack Query |
| Backend | Express + ws + TypeScript |
| UI | Radix UI primitives |

## Quick Start (Development)

Prerequisites: Node.js 24+ and pnpm 10+

```bash
# Install workspace dependencies
pnpm install

# Start client + server
pnpm dev
```

Open http://localhost:5173 in your browser.

## Production Build

```bash
# Build the client bundle
pnpm build
```

## Project Structure

```
scrum_poker/
├── pnpm-workspace.yaml       # Workspace packages
├── tsconfig.base.json        # Shared TypeScript config
├── shared/types.ts          # Shared TypeScript types (RoomState, messages)
├── server/src/
│   ├── index.ts             # Express + ws bootstrap
│   ├── room-store.ts        # Room CRUD, in-memory store, cleanup
│   ├── room-events.ts       # WebSocket message dispatch, personalized broadcasts
│   └── validation.ts        # Shared input normalization helpers
├── client/src/
│   ├── pages/               # HomePage, RoomPage, NotFoundPage
│   ├── features/room/       # Query keys + room socket lifecycle
│   ├── components/          # CardGrid, ParticipantList, VoteSummary, etc.
│   ├── hooks/               # React lifecycle bindings for effects
│   ├── lib/                 # Query, API, storage, and utilities
│   ├── router.tsx           # TanStack Router setup
│   └── styles/              # Obsidian theme CSS
├── test-e2e.ts             # HTTP + WS integration verification
├── Dockerfile               # Multi-stage build
├── docker-compose.yml       # App + Caddy
└── Caddyfile                # Reverse proxy config
```

## Client Layer Responsibilities

- `features/room/use-room-socket.ts` owns the WebSocket lifecycle and reconnection behavior.
- `TanStack Query` keeps the latest `room_state` as cached server state.
- `components/` render room state passed from the route instead of pulling from a global store.
- `lib/storage.ts` stores per-room display names and session tokens.

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

## Verification and Tests

Recommended from the repo root:

```bash
pnpm verify
```

`pnpm verify` runs:

- server typecheck
- server unit tests
- client test command
- client production build
- `test-e2e.ts` against a temporary local server

Focused commands from the repo root:

```bash
pnpm --filter server typecheck
pnpm --filter server test
pnpm --filter client build
pnpm test:e2e
```
