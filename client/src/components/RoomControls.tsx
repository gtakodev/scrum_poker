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
    <div className="flex flex-wrap items-center justify-center gap-3">
      {!revealed ? (
        <Button
          onClick={onReveal}
          disabled={voterCount === 0}
          className="gap-2"
        >
          <Eye className="h-4 w-4" />
          Reveal Votes ({voterCount}/{totalParticipants})
        </Button>
      ) : (
        <Button
          onClick={onReset}
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
