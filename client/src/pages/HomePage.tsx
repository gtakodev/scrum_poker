import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import ThemeSelector from "@/components/ThemeSelector";

export default function HomePage() {
  const [, navigate] = useLocation();

  // Create room form
  const [roomName, setRoomName] = useState("");
  const [createDisplayName, setCreateDisplayName] = useState("");
  const [creating, setCreating] = useState(false);

  // Join room form
  const [joinRoomId, setJoinRoomId] = useState("");

  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!roomName.trim() || !createDisplayName.trim()) return;

    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: roomName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create room");
        return;
      }

      const data = await res.json();

      // Store display name for the room page to use
      sessionStorage.setItem(
        `sprintvote_name_${data.roomId}`,
        createDisplayName.trim()
      );
      navigate(`/room/${data.roomId}`);
    } catch {
      setError("Failed to create room. Is the server running?");
    } finally {
      setCreating(false);
    }
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinRoomId.trim()) return;

    // Extract room ID from URL or use as-is
    let roomId = joinRoomId.trim();
    try {
      const url = new URL(roomId);
      const parts = url.pathname.split("/");
      const roomIdx = parts.indexOf("room");
      if (roomIdx !== -1 && parts[roomIdx + 1]) {
        roomId = parts[roomIdx + 1];
      }
    } catch {
      // Not a URL, use as room ID directly
    }

    navigate(`/room/${roomId}`);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      {/* Theme selector in top-right */}
      <div className="fixed top-4 right-4 z-10">
        <ThemeSelector />
      </div>

      <div className="w-full max-w-md space-y-6">
        {/* Brand header */}
        <div className="text-center animate-fade-in-up">
          <h1 className="text-4xl font-bold tracking-tight">
            Sprint<span className="text-primary">Vote</span>
          </h1>
          <p className="mt-2 text-muted-foreground">
            Fast, real-time planning poker for agile teams
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive animate-fade-in-up">
            {error}
          </div>
        )}

        {/* Create Room */}
        <Card className="animate-fade-in-up" style={{ animationDelay: "80ms" }}>
          <CardHeader>
            <CardTitle>Create a Room</CardTitle>
            <CardDescription>
              Start a new estimation session for your team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-3">
              <Input
                placeholder="Room name (e.g. Sprint 42)"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                required
              />
              <Input
                placeholder="Your display name"
                value={createDisplayName}
                onChange={(e) => setCreateDisplayName(e.target.value)}
                required
              />
              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? "Creating..." : "Create Room"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="flex items-center gap-4 animate-fade-in-up" style={{ animationDelay: "160ms" }}>
          <Separator className="flex-1" />
          <span className="text-sm text-muted-foreground">or</span>
          <Separator className="flex-1" />
        </div>

        {/* Join Room */}
        <Card className="animate-fade-in-up" style={{ animationDelay: "240ms" }}>
          <CardHeader>
            <CardTitle>Join a Room</CardTitle>
            <CardDescription>
              Enter a room ID or paste a share link
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoin} className="space-y-3">
              <Input
                placeholder="Room ID or share link"
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value)}
                required
              />
              <Button type="submit" variant="outline" className="w-full">
                Join Room
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
