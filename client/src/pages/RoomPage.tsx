import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useConfettiOnReveal } from "@/hooks/useConfettiOnReveal";
import { useRoomStore } from "@/stores/useRoomStore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import CardGrid from "@/components/CardGrid";
import ParticipantList from "@/components/ParticipantList";
import RoomControls from "@/components/RoomControls";
import ShareLink from "@/components/ShareLink";
import VoteSummary from "@/components/VoteSummary";
import ThemeSelector from "@/components/ThemeSelector";

export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId;
  const [, navigate] = useLocation();

  // Check if we have a stored display name (from room creation)
  const storedName =
    typeof window !== "undefined"
      ? sessionStorage.getItem(`sprintvote_name_${roomId}`) || ""
      : "";

  const [displayName, setDisplayName] = useState(storedName);
  const [joined, setJoined] = useState(!!storedName);
  const [roomExists, setRoomExists] = useState<boolean | null>(null);

  const roomState = useRoomStore((s) => s.roomState);
  const connected = useRoomStore((s) => s.connected);
  const error = useRoomStore((s) => s.error);
  const [showReconnecting, setShowReconnecting] = useState(false);

  // Connect WebSocket only after user has entered their name
  useWebSocket(joined ? roomId : null, joined ? displayName : null);

  // Confetti on unanimous reveal
  useConfettiOnReveal();

  // Check if room exists
  useEffect(() => {
    if (!roomId) return;

    fetch(`/api/rooms/${roomId}`)
      .then((res) => res.json())
      .then((data) => {
        setRoomExists(data.exists ?? false);
      })
      .catch(() => {
        setRoomExists(false);
      });
  }, [roomId]);

  useEffect(() => {
    if (connected || !roomState) {
      setShowReconnecting(false);
      return;
    }

    const timer = setTimeout(() => setShowReconnecting(true), 1500);
    return () => clearTimeout(timer);
  }, [connected, roomState]);

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) return;
    sessionStorage.setItem(`sprintvote_name_${roomId}`, displayName.trim());
    setDisplayName(displayName.trim());
    setJoined(true);
  }

  // Room doesn't exist
  if (roomExists === false) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 animate-fade-in-up">
        <h1 className="text-2xl font-bold">Room Not Found</h1>
        <p className="text-muted-foreground">
          This room doesn't exist or has expired.
        </p>
        <Button onClick={() => navigate("/")}>Back to Home</Button>
      </div>
    );
  }

  // Loading room check
  if (roomExists === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground animate-subtle-pulse">Loading...</p>
      </div>
    );
  }

  // Need display name
  if (!joined) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <Card className="w-full max-w-sm animate-fade-in-up">
          <CardHeader>
            <CardTitle>Join Room</CardTitle>
            <CardDescription>Enter your display name to join</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoin} className="space-y-3">
              <Input
                placeholder="Your display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                autoFocus
              />
              <Button type="submit" className="w-full">
                Join
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 animate-fade-in-up">
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
        <Button onClick={() => navigate("/")}>Back to Home</Button>
      </div>
    );
  }

  // Connecting
  if (!roomState) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground animate-subtle-pulse">
          {connected ? "Joining room..." : "Connecting..."}
        </p>
      </div>
    );
  }

  // Main room view
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight truncate">
              {roomState.name}
            </h1>
            <p className="text-xs text-muted-foreground font-mono">
              {roomState.id}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <ShareLink roomId={roomState.id} />
            <ThemeSelector />
            {showReconnecting && (
              <span className="text-xs text-destructive animate-subtle-pulse">
                Reconnecting...
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 md:flex-row">
        {/* Left: Participants */}
        <aside className="w-full md:w-64 flex-shrink-0">
          <ParticipantList />
        </aside>

        {/* Center: Cards + Controls */}
        <main className="flex flex-1 flex-col items-center gap-6">
          <CardGrid />

          {roomState.revealed && <VoteSummary />}

          <RoomControls />
        </main>
      </div>
    </div>
  );
}
