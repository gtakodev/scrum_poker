import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, LogIn } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import { createRoom } from "@/lib/api";
import { saveDisplayName } from "@/lib/storage";

export default function HomePage() {
  const navigate = useNavigate();

  const [roomName, setRoomName] = useState("");
  const [createDisplayName, setCreateDisplayName] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const createRoomMutation = useMutation({
    mutationFn: createRoom,
    onSuccess: ({ roomId }) => {
      saveDisplayName(roomId, createDisplayName.trim());
      navigate({ to: "/room/$roomId", params: { roomId } });
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Failed to create room"
      );
    },
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!roomName.trim() || !createDisplayName.trim()) {
      return;
    }

    setError(null);
    createRoomMutation.mutate(roomName.trim());
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

    navigate({ to: "/room/$roomId", params: { roomId } });
  }

  return (
    <>
      <SiteHeader />
      <main className="site-width home-layout">
        <section className="home-intro">
          <h1>Estimate <span>together.</span></h1>
          <p>Real-time planning poker for your team.</p>
          <div className="hero-deck" aria-hidden="true">
            {["3", "8", "13"].map((value) => (
              <div className="hero-card" key={value}>
                <span className="hero-card-corner">{value}</span>
                <span className="card-suit" />
                <span className="hero-card-corner">{value}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="app-panel home-panel">
          <form onSubmit={handleCreate} className="room-form">
            <h2>Create a room</h2>
            <label>
              Room name
              <Input
                placeholder="e.g. Sprint 42"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                required
              />
            </label>
            <label>
              Your display name
              <Input
                placeholder="e.g. Alice"
                autoComplete="nickname"
                value={createDisplayName}
                onChange={(e) => setCreateDisplayName(e.target.value)}
                required
              />
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <Button type="submit" className="action-button" disabled={createRoomMutation.isPending}>
              {createRoomMutation.isPending ? "Creating..." : "Create Room"}
              <ArrowRight aria-hidden="true" />
            </Button>
          </form>
          <form onSubmit={handleJoin} className="room-form">
            <h2>Join a room</h2>
            <label>
              Room link or code
              <Input
                placeholder="Room ID or share link"
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value)}
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            </label>
            <Button type="submit" variant="outline" className="action-button action-outline">
              <LogIn aria-hidden="true" />
              Join Room
            </Button>
          </form>
        </div>
      </main>
    </>
  );
}
