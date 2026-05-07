import { cn } from "@/lib/utils";
import { useRoomStore } from "@/stores/useRoomStore";

export default function CardGrid() {
  const roomState = useRoomStore((s) => s.roomState);
  const myParticipantId = useRoomStore((s) => s.myParticipantId);
  const sendMessage = useRoomStore((s) => s.sendMessage);

  if (!roomState) return null;

  const myParticipant = roomState.participants.find(
    (p) => p.id === myParticipantId
  );
  const myVote = myParticipant?.vote;
  const isRevealed = roomState.revealed;

  function handleVote(value: string) {
    if (isRevealed) return;
    sendMessage({ type: "vote", value });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-muted-foreground">
        {isRevealed ? "Votes revealed" : "Select your estimate"}
      </h2>
      <div className="flex flex-wrap justify-center gap-3">
        {roomState.deck.map((value, index) => {
          const isSelected = myVote === value;
          return (
            <button
              key={value}
              onClick={() => handleVote(value)}
              disabled={isRevealed}
              className={cn(
                "animate-card-pop",
                "flex h-20 w-14 items-center justify-center rounded-lg border-2 text-lg font-bold",
                "transition-all duration-200 ease-out",
                "hover:-translate-y-1 hover:shadow-lg hover:border-primary/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:hover:border-border",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20 -translate-y-1"
                  : "border-border bg-card text-card-foreground"
              )}
              style={{ animationDelay: `${index * 30}ms` }}
            >
              {value}
            </button>
          );
        })}
      </div>
    </div>
  );
}
