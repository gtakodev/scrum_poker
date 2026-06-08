import type { Participant } from "@shared/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface ParticipantListProps {
  participants: Participant[];
  myParticipantId: string | null;
  revealed: boolean;
  onKick: (participantId: string) => void;
}

export default function ParticipantList({
  participants,
  myParticipantId,
  revealed,
  onKick,
}: ParticipantListProps) {

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">
        Participants ({participants.length})
      </h2>
      <div className="space-y-2">
        {participants.map((p, index) => {
          const isMe = p.id === myParticipantId;
          const hasVoted = p.vote !== null;
          const voteDisplay = revealed ? p.vote : hasVoted ? "hidden" : null;

          return (
            <div
              key={p.id}
              className={cn(
                "animate-fade-in-up flex items-center justify-between rounded-lg border p-3 transition-colors",
                !p.connected && "opacity-50"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center gap-2 min-w-0">
                {/* Vote indicator / value */}
                <div
                  className={cn(
                    "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-xs font-bold transition-colors",
                    revealed && voteDisplay
                      ? "bg-primary text-primary-foreground"
                      : hasVoted
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {revealed && voteDisplay
                    ? voteDisplay
                    : hasVoted
                      ? "✓"
                      : "·"}
                </div>

                <span className="truncate text-sm font-medium">
                  {p.displayName}
                  {isMe && (
                    <span className="text-muted-foreground"> (you)</span>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {!p.connected && (
                  <Badge variant="secondary" className="text-xs">
                    offline
                  </Badge>
                )}
                {!isMe && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => onKick(p.id)}
                    title={`Remove ${p.displayName}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
