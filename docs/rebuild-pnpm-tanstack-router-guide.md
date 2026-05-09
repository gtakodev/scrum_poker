# Rebuild Guide: pnpm + TanStack Router + Express

Ce guide est ecrit pour reimplementer l'application actuelle dans **un autre dossier** sous forme de **monorepo pnpm**, avec :

- `pnpm`
- `React`
- `Vite`
- `TypeScript`
- `TanStack Router`
- `TanStack Query`
- `Tailwind CSS v4`
- `Express`
- `ws`
- tests `Vitest` + `Playwright`

Contraintes choisies :

- pas de Bun
- pas de wouter
- pas de shadcn/ui par defaut
- clone fonctionnel du projet existant
- un seul theme: **Obsidian**

---

## 1. Ce qu'il faut reproduire exactement

Le projet actuel fait les choses suivantes :

- creation d'une room
- join d'une room via id ou lien partage
- temps reel via WebSocket
- vote planning poker
- reveal des votes
- reset / nouvelle manche
- kick d'un participant
- reconnexion via `sessionToken`
- une seule session active par participant
- votes masques pour les autres tant que la room n'est pas reveal
- vote modifiable meme apres reveal
- room en memoire, sans auth, sans base de donnees
- expiration automatique des rooms
- confetti si tous les votes sont identiques

Le comportement important a conserver, d'apres le code et les tests actuels :

- `POST /api/rooms` cree une room
- `GET /api/rooms/:roomId` verifie qu'une room existe
- `WS /ws/:roomId` sert a `join`, `vote`, `reveal`, `reset`, `kick`
- un participant reconnecte avec le meme `sessionToken` retrouve le meme `participantId`
- un participant kicke perd sa session; s'il revient avec l'ancien token, il obtient une nouvelle identite
- si un meme participant ouvre un nouvel onglet avec le meme token, le nouvel onglet remplace l'ancien
- les votes sont visibles seulement pour soi tant que la room n'est pas reveal
- un vote identique envoye deux fois est un no-op
- un second `reveal` est un no-op
- les operations avant `join` retournent une erreur `Not joined to a room`
- les payloads invalides ne doivent pas faire tomber le serveur

---

## 2. Stack finale recommandee

### Client

- `react`
- `react-dom`
- `vite`
- `typescript`
- `@vitejs/plugin-react`
- `@tanstack/react-router`
- `@tanstack/router-plugin`
- `@tanstack/react-query`
- `@tanstack/react-query-devtools` en dev
- `@tanstack/react-router-devtools` en dev
- `tailwindcss`
- `@tailwindcss/vite`

### Serveur

- `express`
- `ws`
- `nanoid`
- `tsx` pour lancer le serveur TypeScript en dev

### Tests

- `vitest` pour les tests unitaires
- `playwright` pour l'e2e navigateur

### Pourquoi cette combinaison

- `TanStack Router` remplace proprement `wouter` sans ajouter un framework full-stack plus gros que necessaire
- `TanStack Query` est bien adapte au mix `HTTP initial + WebSocket ensuite`
- `TanStack Query Devtools` et `TanStack Router Devtools` sont utiles pour apprendre et debugger
- `Express + ws` est plus pedagogique que `Bun.serve()` si tu veux tout comprendre a la main
- `Tailwind v4` te laisse coder l'UI toi-meme sans imposer une couche de composants preconstruits

### Ce qu'on prend dans l'ecosysteme TanStack, et ce qu'on ne prend pas

Oui a garder :

- `TanStack Router`
- `TanStack Query`
- les devtools Router et Query en developpement

Non pour cette version :

- `TanStack Form`
- `TanStack Start`
- `TanStack Store`

Pourquoi :

- `Router` et `Query` resolvent de vrais problemes centraux du projet
- `Form` apporte peu de valeur ici, car on n'a que 3 petits formulaires simples
- `Start` ajoute une couche full-stack dont tu n'as pas besoin pour comprendre ce rebuild
- `Store` ferait doublon avec `Query + state local`

Regle pratique :

- on utilise l'ecosysteme TanStack la ou il est **vraiment utile**
- on n'ajoute pas une lib juste pour rester "100% TanStack"

---

## 3. Architecture retenue

### Transport reseau

On garde la meme separation que le projet actuel :

- HTTP pour les operations simples de bootstrap
- WebSocket pour le temps reel de room

Concretement :

- `POST /api/rooms`
- `GET /api/rooms/:roomId`
- `WS /ws/:roomId`

Pourquoi garder ce split :

- c'est deja le contrat actuel
- c'est simple a raisonner
- `TanStack Query` gere tres bien les appels HTTP
- la WebSocket sert uniquement a la vie de la room

### Etat cote client

On utilise :

- `TanStack Query` pour l'etat serveur / cache
- `React state` pour l'etat de connexion local au screen room

### Formulaires

Pour ce projet, garde des **formulaires React simples**, sans librairie de form.

Les formulaires concernes sont :

- create room
- join room
- saisir le display name

Pourquoi ne pas utiliser `TanStack Form` ici :

- trop peu de champs pour que la lib apporte un vrai gain
- validations tres simples: `trim`, required, eventuellement longueur max
- le coeur du projet est le temps reel, pas la complexite des formulaires
- pedagogiquement, du `useState` + `onSubmit` est plus clair pour comprendre toute l'app

Quand `TanStack Form` deviendrait pertinent :

- beaucoup plus de formulaires
- validation avancee par champ
- erreurs inline riches et etat de formulaire reutilisable partout
- settings / profil / administration / workflows plus gros

Conclusion nette :

- **oui pour TanStack Router**
- **oui pour TanStack Query**
- **non pour TanStack Form dans cette version**

Regle importante :

- **la WebSocket n'appartient pas a TanStack Query**
- **la WebSocket n'appartient pas non plus a un store global**

Ce qui va dans Query :

- existence de la room
- metadonnees de room si tu les fetches en HTTP
- snapshot `room_state` recu du serveur

Ce qui reste en `useState` / `useRef` :

- instance `WebSocket`
- `connected`
- `myParticipantId`
- erreurs de connexion
- timer de reconnexion

---

## 4. Arborescence cible

Je te conseille cette structure finale :

```txt
sprintvote-rebuild/
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  shared/
    types.ts
  client/
    package.json
    tsconfig.json
    vite.config.ts
    vitest.config.ts
    playwright.config.ts
    index.html
    src/
      main.tsx
      router.tsx
      routeTree.gen.ts
      styles/
        index.css
      lib/
        api.ts
        query-client.ts
        storage.ts
        room-keys.ts
      routes/
        __root.tsx
        index.tsx
        room.$roomId.tsx
      features/
        home/
          parse-room-id.ts
        room/
          use-room-socket.ts
          room-socket.ts
          room-connection-state.ts
          use-confetti-on-reveal.ts
        ui/
          button.tsx
          input.tsx
      components/
        room-header.tsx
        participant-list.tsx
        card-grid.tsx
        room-controls.tsx
        vote-summary.tsx
        share-link.tsx
      test/
        setup.ts
    e2e/
      home.spec.ts
      room.spec.ts
  server/
    package.json
    tsconfig.json
    vitest.config.ts
    src/
      index.ts
      room-store.ts
      room-events.ts
      validation.ts
      ws-types.ts
      room-store.test.ts
```

Notes de structure :

- `shared/types.ts` reste a la racine comme dans le projet actuel
- `client/src/routes` contient le routing TanStack Router
- `client/src/features/room` contient toute la logique room cote client
- `server/src/room-store.ts` porte la logique metier en memoire
- `server/src/room-events.ts` porte la logique WebSocket et de broadcast

---

## 5. Mapping ancien projet -> nouveau projet

Utilise ce tableau comme boussole.

| Ancien projet | Nouveau projet |
| --- | --- |
| `client/src/App.tsx` | `client/src/routes/__root.tsx` |
| `client/src/pages/HomePage.tsx` | `client/src/routes/index.tsx` |
| `client/src/pages/RoomPage.tsx` | `client/src/routes/room.$roomId.tsx` |
| `client/src/hooks/useWebSocket.ts` | `client/src/features/room/use-room-socket.ts` |
| `client/src/lib/roomSocket.ts` | `client/src/features/room/room-socket.ts` |
| `client/src/stores/useRoomStore.ts` | `TanStack Query + state local room route` |
| `client/src/themes/index.ts` | supprime; garde seulement le theme Obsidian dans `styles/index.css` |
| `server/src/room.ts` | `server/src/room-store.ts` |
| `server/src/handlers.ts` | `server/src/room-events.ts` |
| `server/src/validation.ts` | `server/src/validation.ts` |
| `shared/types.ts` | `shared/types.ts` |

---

## 6. Ordre de travail recommande

Fais la reimplementation dans cet ordre. Ne saute pas d'etapes.

1. monter le monorepo et les scripts
2. faire demarrer le client Vite
3. brancher TanStack Router avec `/` et `/room/$roomId`
4. brancher TanStack Query au root
5. coder le theme Obsidian fixe
6. faire tourner Express avec les routes HTTP
7. extraire `shared/types.ts`
8. faire marcher `POST /api/rooms`
9. faire marcher `GET /api/rooms/:roomId`
10. poser l'infrastructure WebSocket sur le meme port qu'Express
11. implementer `join`
12. afficher un premier `room_state` cote client
13. implementer `vote`
14. implementer `reveal`
15. implementer `reset`
16. implementer `kick`
17. implementer reconnexion et remplacement d'onglet
18. implementer confetti
19. ajouter tests unitaires
20. ajouter tests e2e

---

## 7. Commandes d'installation

Dans ton nouveau dossier :

```bash
mkdir sprintvote-rebuild
cd sprintvote-rebuild
pnpm init
mkdir client server shared
```

### Workspace

```bash
pnpm add -Dw typescript concurrently
```

### Client

```bash
pnpm create vite client --template react-ts
cd client
pnpm add @tanstack/react-router @tanstack/react-query
pnpm add -D @tanstack/react-router-devtools @tanstack/react-query-devtools
pnpm add -D @tanstack/router-plugin @vitejs/plugin-react tailwindcss @tailwindcss/vite vitest jsdom @testing-library/react @testing-library/jest-dom playwright
cd ..
```

### Serveur

```bash
cd server
pnpm init
pnpm add express ws nanoid
pnpm add -D typescript tsx vitest @types/express @types/ws @types/node
cd ..
```

### Shared

Le dossier `shared/` n'a pas besoin d'etre un package npm a part entiere. C'est volontairement simple.

---

## 8. Fichiers de bootstrap a creer en premier

Cette section contient les **fichiers initiaux**. L'objectif est d'obtenir un squelette propre, demarrable, et pedagogique.

### `package.json`

```json
{
  "name": "sprintvote-rebuild",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "concurrently -n client,server -c cyan,magenta \"pnpm --filter client dev\" \"pnpm --filter server dev\"",
    "dev:client": "pnpm --filter client dev",
    "dev:server": "pnpm --filter server dev",
    "build": "pnpm --filter client build",
    "test:unit": "pnpm --filter server test && pnpm --filter client test",
    "test:e2e": "pnpm --filter client test:e2e"
  },
  "devDependencies": {
    "concurrently": "<installed by pnpm>",
    "typescript": "<installed by pnpm>"
  }
}
```

### `pnpm-workspace.yaml`

```yaml
packages:
  - client
  - server
```

### `tsconfig.base.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "baseUrl": "."
  }
}
```

### `shared/types.ts`

```ts
export const DEFAULT_DECK = [
  "1",
  "2",
  "3",
  "5",
  "8",
  "13",
  "20",
  "40",
  "100",
  "?",
  "☕",
] as const;

export type CardValue = (typeof DEFAULT_DECK)[number];

export interface Participant {
  id: string;
  displayName: string;
  vote: string | null;
  connected: boolean;
}

export interface RoomState {
  id: string;
  name: string;
  deck: string[];
  revealed: boolean;
  participants: Participant[];
}

export type ClientMessage =
  | { type: "join"; displayName: string; sessionToken?: string }
  | { type: "vote"; value: string }
  | { type: "reveal" }
  | { type: "reset" }
  | { type: "kick"; participantId: string };

export type ServerMessage =
  | {
      type: "room_state";
      state: RoomState;
      sessionToken: string;
      yourParticipantId: string;
    }
  | { type: "error"; message: string }
  | { type: "kicked" };
```

---

## 9. Client: configuration initiale

### `client/package.json`

```json
{
  "name": "client",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run --passWithNoTests",
    "test:e2e": "playwright test"
  }
}
```

### `client/tsconfig.json`

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "types": ["vite/client"],
    "paths": {
      "@/*": ["./src/*"],
      "@shared/*": ["../shared/*"]
    }
  },
  "include": ["src", "vite.config.ts", "vitest.config.ts", "playwright.config.ts"]
}
```

### `client/vite.config.ts`

```ts
import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "../shared"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:3000",
        ws: true,
      },
    },
  },
});
```

### `client/vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
```

### `client/playwright.config.ts`

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
});
```

### `client/src/test/setup.ts`

```ts
import "@testing-library/jest-dom/vitest";
```

---

## 10. Client: bootstrap TanStack Router + Query

### `client/src/lib/query-client.ts`

```ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

### `client/src/router.tsx`

```tsx
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { queryClient } from "./lib/query-client";

export const router = createRouter({
  routeTree,
  context: {
    queryClient,
  },
  defaultPreload: "intent",
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
```

### `client/src/main.tsx`

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import { queryClient } from "./lib/query-client";
import "./styles/index.css";

document.documentElement.classList.add("dark");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
);
```

### `client/src/routes/__root.tsx`

```tsx
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  Link,
  Outlet,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

interface RouterContext {
  queryClient: QueryClient;
}

function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">Page not found</p>
      <Link to="/" className="rounded-md border border-border px-4 py-2 hover:bg-secondary">
        Back to Home
      </Link>
    </div>
  );
}

function RootLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Outlet />
      <ReactQueryDevtools initialIsOpen={false} />
      <TanStackRouterDevtools position="bottom-right" />
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});
```

### `client/src/lib/api.ts`

```ts
export interface CreateRoomResponse {
  roomId: string;
  name: string;
}

export interface RoomExistsResponse {
  exists: boolean;
  name?: string;
}

export async function createRoom(name: string): Promise<CreateRoomResponse> {
  const response = await fetch("/api/rooms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? "Failed to create room");
  }

  return response.json();
}

export async function getRoom(roomId: string): Promise<RoomExistsResponse> {
  const response = await fetch(`/api/rooms/${roomId}`);

  if (response.status === 404) {
    return { exists: false };
  }

  if (!response.ok) {
    throw new Error("Failed to fetch room");
  }

  return response.json();
}
```

### `client/src/lib/storage.ts`

```ts
const DISPLAY_NAME_PREFIX = "sprintvote_name_";
const SESSION_PREFIX = "sprintvote_session_";

export function getDisplayName(roomId: string): string {
  try {
    return sessionStorage.getItem(`${DISPLAY_NAME_PREFIX}${roomId}`) ?? "";
  } catch {
    return "";
  }
}

export function setDisplayName(roomId: string, displayName: string): void {
  try {
    sessionStorage.setItem(`${DISPLAY_NAME_PREFIX}${roomId}`, displayName);
  } catch {
    // ignore storage errors
  }
}

export function getSessionToken(roomId: string): string | undefined {
  try {
    return localStorage.getItem(`${SESSION_PREFIX}${roomId}`) ?? undefined;
  } catch {
    return undefined;
  }
}

export function setSessionToken(roomId: string, token: string): void {
  try {
    localStorage.setItem(`${SESSION_PREFIX}${roomId}`, token);
  } catch {
    // ignore storage errors
  }
}
```

### `client/src/routes/index.tsx`

```tsx
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createRoom } from "@/lib/api";
import { setDisplayName } from "@/lib/storage";

function parseRoomId(input: string): string {
  const value = input.trim();

  try {
    const url = new URL(value);
    const parts = url.pathname.split("/");
    const roomIndex = parts.indexOf("room");
    if (roomIndex !== -1 && parts[roomIndex + 1]) {
      return parts[roomIndex + 1];
    }
  } catch {
    // plain room id
  }

  return value;
}

function HomePage() {
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState("");
  const [displayName, setDisplayNameState] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createRoomMutation = useMutation({
    mutationFn: createRoom,
    onSuccess: (data) => {
      setDisplayName(data.roomId, displayName.trim());
      navigate({ to: "/room/$roomId", params: { roomId: data.roomId } });
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Failed to create room");
    },
  });

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!roomName.trim() || !displayName.trim()) {
      return;
    }
    setError(null);
    createRoomMutation.mutate(roomName.trim());
  }

  function handleJoin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!joinRoomId.trim()) {
      return;
    }

    const roomId = parseRoomId(joinRoomId);
    navigate({ to: "/room/$roomId", params: { roomId } });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            Sprint<span className="text-primary">Vote</span>
          </h1>
          <p className="mt-2 text-muted-foreground">
            Fast, real-time planning poker for agile teams
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Create a Room</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Start a new estimation session for your team
          </p>

          <form onSubmit={handleCreate} className="mt-4 space-y-3">
            <input
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              placeholder="Room name"
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
            />
            <input
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              placeholder="Your display name"
              value={displayName}
              onChange={(event) => setDisplayNameState(event.target.value)}
            />
            <button
              type="submit"
              disabled={createRoomMutation.isPending}
              className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-60"
            >
              {createRoomMutation.isPending ? "Creating..." : "Create Room"}
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Join a Room</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter a room ID or paste a share link
          </p>

          <form onSubmit={handleJoin} className="mt-4 space-y-3">
            <input
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              placeholder="Room ID or share link"
              value={joinRoomId}
              onChange={(event) => setJoinRoomId(event.target.value)}
            />
            <button
              type="submit"
              className="w-full rounded-md border border-border bg-secondary px-4 py-2 font-medium text-secondary-foreground"
            >
              Join Room
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: HomePage,
});
```

### `client/src/routes/room.$roomId.tsx`

```tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { getRoom } from "@/lib/api";
import { getDisplayName, setDisplayName } from "@/lib/storage";

function RoomPage() {
  const { roomId } = Route.useParams();
  const [displayName, setDisplayNameState] = useState(() => getDisplayName(roomId));
  const [joined, setJoined] = useState(() => Boolean(getDisplayName(roomId)));

  const roomQuery = useQuery({
    queryKey: ["room-exists", roomId],
    queryFn: () => getRoom(roomId),
  });

  function handleJoin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!displayName.trim()) {
      return;
    }

    setDisplayName(roomId, displayName.trim());
    setJoined(true);
  }

  if (roomQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (roomQuery.data?.exists === false) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <h1 className="text-2xl font-bold">Room Not Found</h1>
        <p className="text-muted-foreground">This room does not exist or has expired.</p>
        <Link to="/" className="rounded-md border border-border px-4 py-2 hover:bg-secondary">
          Back to Home
        </Link>
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <section className="w-full max-w-sm rounded-xl border border-border bg-card p-6">
          <h1 className="text-xl font-semibold">Join Room</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter your display name to continue</p>
          <form onSubmit={handleJoin} className="mt-4 space-y-3">
            <input
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              placeholder="Your display name"
              value={displayName}
              onChange={(event) => setDisplayNameState(event.target.value)}
              autoFocus
            />
            <button className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground">
              Join
            </button>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-3xl rounded-xl border border-border bg-card p-6">
        <h1 className="text-2xl font-semibold">Room {roomId}</h1>
        <p className="mt-2 text-muted-foreground">
          Bootstrap route OK. Next step: brancher la WebSocket et afficher le vrai `room_state`.
        </p>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/room/$roomId")({
  component: RoomPage,
});
```

---

## 11. Client: theme Obsidian fixe

Comme tu veux seulement Obsidian, supprime toute la logique de theme dynamique.

### `client/src/styles/index.css`

```css
@import "tailwindcss";

@custom-variant dark (&:is(.dark *));

.dark {
  --background: oklch(0.16 0.02 275);
  --foreground: oklch(0.93 0.01 275);
  --card: oklch(0.2 0.025 275);
  --card-foreground: oklch(0.93 0.01 275);
  --popover: oklch(0.22 0.025 275);
  --popover-foreground: oklch(0.93 0.01 275);
  --primary: oklch(0.72 0.17 290);
  --primary-foreground: oklch(0.15 0.03 290);
  --secondary: oklch(0.24 0.03 275);
  --secondary-foreground: oklch(0.88 0.01 275);
  --muted: oklch(0.24 0.025 275);
  --muted-foreground: oklch(0.58 0.04 275);
  --accent: oklch(0.76 0.12 195);
  --accent-foreground: oklch(0.15 0.03 195);
  --destructive: oklch(0.45 0.18 25);
  --destructive-foreground: oklch(0.65 0.22 25);
  --border: oklch(0.28 0.03 275);
  --input: oklch(0.24 0.025 275);
  --ring: oklch(0.65 0.17 290);
  --radius: 0.625rem;
}

html.dark {
  background-image: radial-gradient(
    ellipse at 50% -20%,
    oklch(0.25 0.06 290 / 0.12),
    transparent 60%
  );
  background-attachment: fixed;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

body {
  background-color: var(--background);
  color: var(--foreground);
}

* {
  border-color: var(--border);
}
```

---

## 12. Serveur: bootstrap Express + ws

### `server/package.json`

```json
{
  "name": "server",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "test": "vitest run"
  }
}
```

### `server/tsconfig.json`

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022"],
    "types": ["node"]
  },
  "include": ["src", "../shared/types.ts"]
}
```

### `server/vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

### `server/src/validation.ts`

```ts
export function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}
```

### `server/src/room-store.ts`

```ts
import { nanoid } from "nanoid";
import { DEFAULT_DECK, type Participant, type RoomState } from "../../shared/types";

interface InternalParticipant {
  id: string;
  displayName: string;
  vote: string | null;
  connected: boolean;
  sessionToken: string;
  lastSeen: number;
}

export interface Room {
  id: string;
  name: string;
  deck: string[];
  revealed: boolean;
  participants: Map<string, InternalParticipant>;
  createdAt: number;
  lastActivity: number;
}

const rooms = new Map<string, Room>();
const sessionIndex = new Map<string, { roomId: string; participantId: string }>();

export function createRoom(name: string): Room {
  const room: Room = {
    id: nanoid(8),
    name,
    deck: [...DEFAULT_DECK],
    revealed: false,
    participants: new Map(),
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };

  rooms.set(room.id, room);
  return room;
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function addParticipant(
  room: Room,
  displayName: string,
  sessionToken?: string
) {
  if (sessionToken) {
    const session = sessionIndex.get(sessionToken);
    if (session?.roomId === room.id) {
      const existing = room.participants.get(session.participantId);
      if (existing) {
        const didChangeRoom = !existing.connected || existing.displayName !== displayName;
        existing.connected = true;
        existing.displayName = displayName;
        existing.lastSeen = Date.now();
        room.lastActivity = Date.now();
        return { participant: existing, sessionToken, didChangeRoom };
      }
    }
  }

  const participant: InternalParticipant = {
    id: nanoid(10),
    displayName,
    vote: null,
    connected: true,
    sessionToken: nanoid(21),
    lastSeen: Date.now(),
  };

  room.participants.set(participant.id, participant);
  sessionIndex.set(participant.sessionToken, {
    roomId: room.id,
    participantId: participant.id,
  });
  room.lastActivity = Date.now();

  return {
    participant,
    sessionToken: participant.sessionToken,
    didChangeRoom: true,
  };
}

export function disconnectParticipant(room: Room, participantId: string): boolean {
  const participant = room.participants.get(participantId);
  if (!participant || !participant.connected) {
    return false;
  }

  participant.connected = false;
  participant.lastSeen = Date.now();
  room.lastActivity = Date.now();
  return true;
}

export function removeParticipant(room: Room, participantId: string): boolean {
  const participant = room.participants.get(participantId);
  if (!participant) {
    return false;
  }

  sessionIndex.delete(participant.sessionToken);
  room.participants.delete(participantId);
  room.lastActivity = Date.now();
  return true;
}

export function setVote(room: Room, participantId: string, value: string): boolean {
  const participant = room.participants.get(participantId);
  if (!participant || participant.vote === value) {
    return false;
  }

  participant.vote = value;
  room.lastActivity = Date.now();
  return true;
}

export function revealVotes(room: Room): boolean {
  if (room.revealed) {
    return false;
  }

  room.revealed = true;
  room.lastActivity = Date.now();
  return true;
}

export function resetVotes(room: Room): boolean {
  let didChangeRoom = room.revealed;
  room.revealed = false;

  for (const participant of room.participants.values()) {
    if (participant.vote !== null) {
      didChangeRoom = true;
    }
    participant.vote = null;
  }

  if (!didChangeRoom) {
    return false;
  }

  room.lastActivity = Date.now();
  return true;
}

export function buildRoomState(room: Room, forParticipantId: string): RoomState {
  const participants: Participant[] = [];

  for (const participant of room.participants.values()) {
    let vote: string | null = participant.vote;

    if (!room.revealed && participant.id !== forParticipantId) {
      vote = participant.vote !== null ? "hidden" : null;
    }

    participants.push({
      id: participant.id,
      displayName: participant.displayName,
      vote,
      connected: participant.connected,
    });
  }

  return {
    id: room.id,
    name: room.name,
    deck: room.deck,
    revealed: room.revealed,
    participants,
  };
}
```

### `server/src/index.ts`

```ts
import express from "express";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { createRoom, getRoom } from "./room-store";
import { normalizeNonEmptyString } from "./validation";

const app = express();
app.use(express.json());

app.post("/api/rooms", (request, response) => {
  const name = normalizeNonEmptyString(request.body?.name);

  if (!name) {
    response.status(400).json({ error: "Room name is required" });
    return;
  }

  const room = createRoom(name);
  response.status(201).json({ roomId: room.id, name: room.name });
});

app.get("/api/rooms/:roomId", (request, response) => {
  const room = getRoom(request.params.roomId);

  if (!room) {
    response.status(404).json({ exists: false });
    return;
  }

  response.json({ exists: true, name: room.name });
});

const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url ?? "/", "http://localhost");

  if (!url.pathname.startsWith("/ws/")) {
    socket.destroy();
    return;
  }

  const roomId = url.pathname.slice("/ws/".length);
  const room = getRoom(roomId);

  if (!room) {
    socket.write("HTTP/1.1 404 Not Found\\r\\n\\r\\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    ws.send(JSON.stringify({ type: "error", message: "Socket wiring not implemented yet" }));
  });
});

const PORT = Number(process.env.PORT ?? 3000);
server.listen(PORT, () => {
  console.log(`SprintVote server running on http://localhost:${PORT}`);
});
```

Ce `index.ts` est volontairement un **bootstrap**. Le guide plus bas explique ensuite comment le completer pour reproduire le vrai comportement WebSocket.

---

## 13. Tests initiaux

### `server/src/room-store.test.ts`

```ts
import { describe, expect, it } from "vitest";
import {
  addParticipant,
  buildRoomState,
  createRoom,
  disconnectParticipant,
  removeParticipant,
  revealVotes,
  setVote,
} from "./room-store";

describe("room-store", () => {
  it("reuses a participant when reconnecting with the same session token", () => {
    const room = createRoom("session lifecycle");
    const firstJoin = addParticipant(room, "Alice");

    disconnectParticipant(room, firstJoin.participant.id);
    const reconnect = addParticipant(room, "Alice Updated", firstJoin.sessionToken);

    expect(reconnect.participant.id).toBe(firstJoin.participant.id);
    expect(reconnect.participant.displayName).toBe("Alice Updated");
  });

  it("removes the session when a participant is kicked", () => {
    const room = createRoom("kick lifecycle");
    const firstJoin = addParticipant(room, "Alice");

    removeParticipant(room, firstJoin.participant.id);
    const rejoin = addParticipant(room, "Alice Returns", firstJoin.sessionToken);

    expect(rejoin.participant.id).not.toBe(firstJoin.participant.id);
  });

  it("hides other participants votes before reveal", () => {
    const room = createRoom("private votes");
    const alice = addParticipant(room, "Alice").participant;
    const bob = addParticipant(room, "Bob").participant;

    setVote(room, alice.id, "8");
    setVote(room, bob.id, "13");

    const aliceView = buildRoomState(room, alice.id);
    const bobInAliceView = aliceView.participants.find((participant) => participant.id === bob.id);

    expect(bobInAliceView?.vote).toBe("hidden");
  });

  it("treats same vote and repeated reveal as no-ops", () => {
    const room = createRoom("no-op checks");
    const participant = addParticipant(room, "Alice").participant;

    expect(setVote(room, participant.id, "5")).toBe(true);
    expect(setVote(room, participant.id, "5")).toBe(false);
    expect(revealVotes(room)).toBe(true);
    expect(revealVotes(room)).toBe(false);
  });
});
```

### `client/e2e/home.spec.ts`

```ts
import { expect, test } from "@playwright/test";

test("home page renders create and join forms", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /SprintVote/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Create a Room/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Join a Room/i })).toBeVisible();
});
```

Au tout debut, lance les e2e manuellement comme ceci :

1. terminal 1: `pnpm dev`
2. terminal 2: `pnpm test:e2e`

---

## 14. Faire evoluer le bootstrap vers le vrai clone

Une fois les fichiers precedents en place et l'app demarrable, tu vas completer par couches.

### Etape A - WebSocket cote serveur

Cree `server/src/room-events.ts`.

Responsabilites de ce fichier :

- parser et valider les messages entrants
- garder un registre `roomId -> participantId -> ws`
- envoyer le `room_state` personnalise a chacun
- fermer l'ancien onglet si le meme `participantId` se reconnecte
- broadcast apres `join`, `vote`, `reveal`, `reset`, `kick`, `disconnect`

Tu peux reprendre la structure actuelle presque a l'identique, avec seulement les adaptations Express/`ws`.

Ce qu'il faut porter depuis l'ancien `server/src/handlers.ts` :

- `parseClientMessage`
- `registerConnection`
- `unregisterConnection`
- `broadcastToRoom`
- `handleMessage`
- `handleClose`

### Etape B - Upgrade HTTP -> WS

Dans `server/src/index.ts`, remplace le placeholder `Socket wiring not implemented yet` par :

- extraction de `roomId`
- rejet si la room n'existe pas
- `wss.handleUpgrade(...)`
- attachement d'un objet de contexte au socket
- branchement de `message` et `close`

Tu auras besoin d'un type du genre :

```ts
export interface WSData {
  roomId: string;
  participantId: string | null;
  sessionToken: string | null;
}
```

Avec `ws`, comme les sockets ne portent pas nativement `data` comme Bun, tu peux :

- soit etendre le type `WebSocket`
- soit garder un `WeakMap<WebSocket, WSData>`

Je te conseille le `WeakMap`. C'est tres clair pedagogiquement.

### Etape C - WebSocket cote client

Cree `client/src/features/room/use-room-socket.ts`.

Ce hook doit :

- ouvrir la socket quand `roomId` et `displayName` sont connus
- envoyer `join` a l'ouverture
- recuperer `sessionToken` depuis `localStorage`
- ecrire `sessionToken` recu dans `localStorage`
- faire `queryClient.setQueryData(["room-state", roomId], msg.state)` a chaque `room_state`
- exposer `connected`, `error`, `myParticipantId`
- gerer la reconnexion automatique avec backoff

Important :

- ne mets pas l'instance `WebSocket` dans Query
- ne mets pas l'instance `WebSocket` dans le routeur

### Etape D - TanStack Query pour la room

Je te conseille de normaliser les cles Query comme ceci :

```ts
export const roomKeys = {
  exists: (roomId: string) => ["room-exists", roomId] as const,
  state: (roomId: string) => ["room-state", roomId] as const,
};
```

Usage :

- `useQuery({ queryKey: roomKeys.exists(roomId), queryFn: ... })`
- `queryClient.setQueryData(roomKeys.state(roomId), nextRoomState)`
- `const roomState = useQuery({ queryKey: roomKeys.state(roomId), enabled: false, initialData: null })`

Oui, c'est inhabituel de remplir Query depuis une WebSocket, mais ici c'est un bon fit : tu utilises Query comme **cache de l'etat serveur**.

### Etape E - Route room reelle

Quand tu passes du bootstrap au vrai clone, `client/src/routes/room.$roomId.tsx` doit gerer ces etats :

- room inexistante
- chargement de la verification HTTP
- demande du display name si absent
- erreur de socket
- connexion en cours
- room prete

La structure logique du composant doit etre proche de l'ancien `RoomPage.tsx`, mais adaptee comme ceci :

- `Route.useParams()` au lieu de `useParams` wouter
- `Link` / `navigate` TanStack Router au lieu de `useLocation` wouter
- `TanStack Query` au lieu du store Zustand pour `roomState`

### Etape F - Composants room

Recree ensuite :

- `participant-list.tsx`
- `card-grid.tsx`
- `room-controls.tsx`
- `vote-summary.tsx`
- `share-link.tsx`

Leur logique peut etre tres proche de l'existant.

Adaptations a faire :

- remplacer `useRoomStore(...)` par des props ou des hooks Query
- remplacer `sendRoomMessage(...)` par une API locale venant du hook socket

Bonne strategie :

- la route room appelle `useRoomSocket(...)`
- la route recupere `roomState`
- la route passe `roomState`, `myParticipantId` et `actions` aux composants

Cela rend les composants plus lisibles que le store global.

---

## 15. Contrat UI exact a conserver

### Home

- formulaire create room
- champ display name dans create
- formulaire join par id ou share link
- pas de selecteur de theme

### Room

- si la room n'existe pas: ecran `Room Not Found`
- si le nom n'est pas encore saisi: formulaire de join
- si `roomState` n'est pas encore la: `Connecting...` ou `Joining room...`
- header avec nom de la room et id de la room
- lien de partage
- liste des participants a gauche
- cartes au centre
- `Reveal Votes` si non reveal
- `New Round` si reveal
- resume des votes une fois reveal

### Detail important sur le vote

Avant reveal :

- je vois mon propre vote reel
- les autres voient `hidden`

Apres reveal :

- tout le monde voit toutes les vraies valeurs
- je peux changer ma carte sans relancer une nouvelle manche
- la room reste `revealed = true`

---

## 16. Contrat serveur exact a conserver

### `join`

- verifie `displayName`
- si `sessionToken` connu et encore valide dans la room, reconnecte le meme participant
- sinon cree un nouveau participant
- renvoie toujours `room_state` avec `sessionToken` et `yourParticipantId`

### `vote`

- refuse une valeur absente du deck
- ne broadcast rien si la valeur n'a pas change

### `reveal`

- ne fait rien si deja reveal

### `reset`

- remet `revealed = false`
- remet tous les votes a `null`
- ne broadcast rien si rien n'a change

### `kick`

- interdit de se kicker soi-meme
- envoie d'abord `kicked` a la cible si elle est connectee
- supprime la session de la cible
- broadcast ensuite le nouvel etat

### `close`

- marque `connected = false`
- broadcast le nouvel etat

---

## 17. Reconnexion et multi-onglet

Quand tu implementes la reconnexion, reproduis ce comportement precis :

- fermeture de socket = participant passe `connected = false`
- reconnexion avec meme token = meme `participantId`
- si un deuxieme onglet rejoint avec le meme token, il remplace le premier
- l'ancien onglet doit etre ferme avec un code dedie, par exemple `4001`
- si le state de room n'a pas change, ne broadcast pas inutilement a tout le monde

Le test e2e actuel valide ce comportement. Il faut donc le conserver.

---

## 18. Confetti

Le confetti est a faire en dernier.

Comme tu ne gardes que le theme Obsidian, tu peux simplifier enormement :

- pas besoin de logique de theme dynamique
- juste un tableau de couleurs fixe adapte au theme Obsidian

Exemple :

```ts
const OBSIDIAN_CONFETTI_COLORS = [
  "#a78bfa",
  "#c084fc",
  "#5eead4",
  "#f9a8d4",
  "#fbbf24",
];
```

Le declenchement doit rester :

- uniquement au passage `revealed: false -> true`
- uniquement si au moins 2 votes non nuls sont identiques

---

## 19. Strategie de tests

### Unit tests

Mets les unit tests surtout cote serveur.

Le coeur a tester :

- reconnexion avec meme token
- suppression de session au kick
- masquage des votes avant reveal
- no-op sur vote identique
- no-op sur reveal repete
- reset correct

Tu as deja la quasi-totalite des cas a porter depuis `server/src/room.test.ts`.

### E2E

Ensuite fais de vrais tests Playwright pour :

- create room depuis la home
- rejoindre la room dans un autre contexte navigateur
- voter a deux
- reveal
- reset
- kick
- room not found

Tu peux garder aussi un script d'integration HTTP/WS pur, comme le projet actuel, si tu veux une couche supplementaire tres rapide a executer. Mais si tu dois choisir une seule couche e2e, prends `Playwright`.

---

## 20. Checklist finale de parite

Quand tu as fini, verifie cette checklist.

- la home cree une room
- la home rejoint une room via id ou URL
- `/room/$roomId` gere correctement 404 / loading / join / connected
- deux navigateurs voient les updates en temps reel
- les votes sont caches avant reveal
- les votes sont visibles apres reveal
- un vote peut changer apres reveal
- `reset` remet tout a zero
- `kick` fonctionne et interdit le self-kick
- reconnexion avec token fonctionne
- remplacement d'onglet fonctionne
- le theme Obsidian est applique partout
- confetti se declenche seulement sur unanimite
- les tests unitaires passent
- les tests e2e passent

---

## 21. Ce que je ferais concretement, a ta place

Si tu veux avancer proprement sans te perdre, suis cette micro-sequence :

1. copie les fichiers de bootstrap de ce guide
2. demarre `pnpm dev`
3. verifie que `/` et `/room/test` s'affichent
4. termine les endpoints HTTP
5. porte `room-store.ts` a 100%
6. porte `room-events.ts` depuis l'ancien `handlers.ts`
7. implemente `use-room-socket.ts`
8. branche `room_state` dans TanStack Query
9. porte les composants room un par un
10. ajoute les tests unitaires serveur
11. ajoute les e2e Playwright
12. termine par confetti

---

## 22. Resume des choix importants

Pour ce rebuild, les bons choix sont :

- monorepo simple
- `shared/types.ts` a la racine
- `TanStack Router` file-based
- `TanStack Query` pour l'etat serveur
- `Express + ws` sur le meme port
- `Tailwind v4`
- theme Obsidian fixe
- tests `Vitest` + `Playwright`

Et les choix a **ne pas** faire dans cette version :

- ne pas remettre Zustand par reflexe
- ne pas remettre plusieurs themes
- ne pas prendre TanStack Start si ton but est de comprendre la base a la main
- ne pas introduire une base de donnees ou une auth maintenant

---

## 23. Reference utile pendant la reimplementation

Quand tu bloques, compare avec ces fichiers de l'app actuelle :

- `client/src/pages/HomePage.tsx`
- `client/src/pages/RoomPage.tsx`
- `client/src/hooks/useWebSocket.ts`
- `client/src/components/CardGrid.tsx`
- `client/src/components/ParticipantList.tsx`
- `client/src/components/RoomControls.tsx`
- `client/src/components/VoteSummary.tsx`
- `client/src/components/ShareLink.tsx`
- `server/src/room.ts`
- `server/src/handlers.ts`
- `server/src/validation.ts`
- `server/src/room.test.ts`
- `test-e2e.ts`

La meilleure approche est de **porter la logique**, pas de recopier aveuglement la structure.
