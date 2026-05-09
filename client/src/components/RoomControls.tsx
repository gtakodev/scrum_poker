import { useRoomStore } from "@/stores/useRoomStore";
import { Button } from "@/components/ui/button";
import { Eye, RotateCcw } from "lucide-react";
import { sendRoomMessage } from "@/lib/roomSocket";

export default function RoomControls() {
  const roomState = useRoomStore((s) => s.roomState);

  if (!roomState) return null;

  const isRevealed = roomState.revealed;
  const voterCount = roomState.participants.filter(
    (p) => p.vote !== null
  ).length;
  const totalParticipants = roomState.participants.length;

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {!isRevealed ? (
        <Button
          onClick={() => sendRoomMessage({ type: "reveal" })}
          disabled={voterCount === 0}
          className="gap-2"
        >
          <Eye className="h-4 w-4" />
          Reveal Votes ({voterCount}/{totalParticipants})
        </Button>
      ) : (
        <Button
          onClick={() => sendRoomMessage({ type: "reset" })}
          variant="outline"
          className="gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          New Round
        </Button>
      )}
    </div>
  );
}
