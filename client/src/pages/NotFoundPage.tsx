import { Link } from "@tanstack/react-router";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">Page not found</p>
      <Link
        to="/"
        className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
      >
        Back to Home
      </Link>
    </div>
  );
}
