import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import HomePage from "@/pages/HomePage";
import RoomPage from "@/pages/RoomPage";
import NotFoundPage from "@/pages/NotFoundPage";
import { queryClient } from "@/lib/query-client";

interface RouterContext {
  queryClient: QueryClient;
}

function RootLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Outlet />
      {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </div>
  );
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

const roomRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/room/$roomId",
  component: RoomPage,
});

const routeTree = rootRoute.addChildren([indexRoute, roomRoute]);

export const router = createRouter({
  routeTree,
  context: {
    queryClient,
  },
  defaultPreload: "intent",
  scrollRestoration: true,
});

export const roomRouteApi = roomRoute;

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
