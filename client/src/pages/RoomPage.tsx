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
import { ArrowLeft, ArrowRight, LoaderCircle } from "lucide-react";
import CardGrid from "@/components/CardGrid";
import ParticipantList from "@/components/ParticipantList";
import RoomControls from "@/components/RoomControls";
import ShareLink from "@/components/ShareLink";
import VoteSummary from "@/components/VoteSummary";
import SiteHeader from "@/components/SiteHeader";
import PageMessage from "@/components/PageMessage";

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
      <PageMessage>
        <h1>Room Not Found</h1>
        <p>This room doesn't exist or has expired.</p>
        <Link to="/" className="back-link">
          <ArrowLeft aria-hidden="true" /> Back to Home
        </Link>
      </PageMessage>
    );
  }

  if (!roomExistsQuery.isLoading && !joined) {
    return (
      <PageMessage>
        <h1>Join Room</h1>
        <p>Enter your display name to join</p>
        <form onSubmit={handleJoin} className="room-form invite-form">
          <label>
            Your display name
            <Input
              placeholder="e.g. Alice"
              autoComplete="nickname"
              value={displayName}
              onChange={(e) => setDisplayNameState(e.target.value)}
              required
              autoFocus
            />
          </label>
          <Button type="submit" className="action-button">
            Join <ArrowRight aria-hidden="true" />
          </Button>
        </form>
      </PageMessage>
    );
  }

  if (error) {
    return (
      <PageMessage>
        <h1>Room disconnected</h1>
        <p role="alert">{error}</p>
        <Link to="/" className="back-link">
          <ArrowLeft aria-hidden="true" /> Back to Home
        </Link>
      </PageMessage>
    );
  }

  if (roomExistsQuery.isLoading || !roomState) {
    return (
      <PageMessage>
        <p className="loading-state" role="status">
          <LoaderCircle aria-hidden="true" />
          {roomExistsQuery.isLoading ? "Loading..." : connected ? "Joining room..." : "Connecting..."}
        </p>
      </PageMessage>
    );
  }

  const myVote = roomState.participants.find((participant) => participant.id === myParticipantId)?.vote;
  const voterCount = roomState.participants.filter((participant) => participant.vote !== null).length;

  return (
    <>
      <SiteHeader>
        <ShareLink roomId={roomState.id} />
      </SiteHeader>
      <main className="site-width room-layout">
        <div className="room-title">
          <h1>{roomState.name}</h1>
          <p>Room ID <code>{roomState.id}</code></p>
          {showReconnecting && <p className="reconnecting" role="status">Reconnecting...</p>}
        </div>
        <div className="room-grid">
          <div className="app-panel voting-board">
            <CardGrid
              deck={roomState.deck}
              myVote={myVote}
              revealed={roomState.revealed}
              onVote={(value) => sendMessage({ type: "vote", value })}
            />
            {roomState.revealed && (
              <VoteSummary participants={roomState.participants} />
            )}
            <RoomControls
              revealed={roomState.revealed}
              voterCount={voterCount}
              totalParticipants={roomState.participants.length}
              onReveal={() => sendMessage({ type: "reveal" })}
              onReset={() => sendMessage({ type: "reset" })}
            />
          </div>
          <ParticipantList
            participants={roomState.participants}
            myParticipantId={myParticipantId}
            revealed={roomState.revealed}
            onKick={(participantId) => sendMessage({ type: "kick", participantId })}
          />
        </div>
      </main>
    </>
  );
}
