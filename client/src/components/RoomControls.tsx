import { Button } from "@/components/ui/button";
import { Eye, RotateCcw } from "lucide-react";

interface RoomControlsProps {
  revealed: boolean;
  voterCount: number;
  totalParticipants: number;
  onReveal: () => void;
  onReset: () => void;
}

export default function RoomControls({
  revealed,
  voterCount,
  totalParticipants,
  onReveal,
  onReset,
}: RoomControlsProps) {

  return (
    <div className="board-controls">
      <div className="round-progress">
        <p role="status">{voterCount} of {totalParticipants} voted</p>
        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${(voterCount / Math.max(1, totalParticipants)) * 100}%` }} />
        </div>
      </div>
      {!revealed ? (
        <Button
          onClick={onReveal}
          disabled={voterCount === 0}
          className="action-button"
        >
          <Eye className="h-4 w-4" />
          Reveal Votes
        </Button>
      ) : (
        <Button
          onClick={onReset}
          variant="outline"
          className="action-button action-outline"
        >
          <RotateCcw className="h-4 w-4" />
          New Round
        </Button>
      )}
    </div>
  );
}
