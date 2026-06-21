import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { RoomState } from "@shared/types";
import { roomRouteApi } from "@/router";
import { roomKeys } from "@/features/room/query-keys";
import { useRoomSocket } from "@/features/room/use-room-socket";
import { useConfettiOnReveal } from "@/hooks/useConfettiOnReveal";
import { getRoom } from "@/lib/api";
import { getDisplayName, saveDisplayName } from "@/lib/storage";
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

export default function RoomPage() {
  const { roomId } = roomRouteApi.useParams();
  const [displayName, setDisplayNameState] = useState(() => getDisplayName(roomId));
  const [joined, setJoined] = useState(() => Boolean(getDisplayName(roomId)));
  const [showReconnecting, setShowReconnecting] = useState(false);
  const roomExistsQuery = useQuery({
    queryKey: roomKeys.exists(roomId),
    queryFn: () => getRoom(roomId),
  });
  const roomStateQuery = useQuery<RoomState | null>({
    queryKey: roomKeys.state(roomId),
    queryFn: async () => null,
    enabled: false,
    initialData: null,
  });
  const roomState = roomStateQuery.data;
  const { connected, error, myParticipantId, sendMessage } = useRoomSocket(
    joined ? roomId : null,
    joined ? displayName.trim() : null
  );

  useConfettiOnReveal(roomState);

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
    if (!displayName.trim()) {
      return;
    }
    saveDisplayName(roomId, displayName.trim());
    setDisplayNameState(displayName.trim());
    setJoined(true);
  }

  if (roomExistsQuery.data?.exists === false) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 animate-fade-in-up">
        <h1 className="text-2xl font-bold">Room Not Found</h1>
        <p className="text-muted-foreground">
          This room doesn't exist or has expired.
        </p>
        <Link
          to="/"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  if (roomExistsQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground animate-subtle-pulse">Loading...</p>
      </div>
    );
  }

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
                onChange={(e) => setDisplayNameState(e.target.value)}
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

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 animate-fade-in-up">
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
        <Link
          to="/"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  if (!roomState) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground animate-subtle-pulse">
          {connected ? "Joining room..." : "Connecting..."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
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
            {showReconnecting && (
              <span className="text-xs text-destructive animate-subtle-pulse">
                Reconnecting...
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 md:flex-row">
        <aside className="w-full md:w-64 flex-shrink-0">
          <ParticipantList
            participants={roomState.participants}
            myParticipantId={myParticipantId}
            revealed={roomState.revealed}
            onKick={(participantId) => sendMessage({ type: "kick", participantId })}
          />
        </aside>

        <main className="flex flex-1 flex-col items-center gap-6">
          <CardGrid
            deck={roomState.deck}
            myVote={
              roomState.participants.find(
                (participant) => participant.id === myParticipantId
              )?.vote
            }
            revealed={roomState.revealed}
            onVote={(value) => sendMessage({ type: "vote", value })}
          />

          {roomState.revealed ? (
            <VoteSummary
              participants={roomState.participants}
              revealed={roomState.revealed}
            />
          ) : null}

          <RoomControls
            revealed={roomState.revealed}
            voterCount={
              roomState.participants.filter((participant) => participant.vote !== null)
                .length
            }
            totalParticipants={roomState.participants.length}
            onReveal={() => sendMessage({ type: "reveal" })}
            onReset={() => sendMessage({ type: "reset" })}
          />
        </main>
      </div>
    </div>
  );
}
