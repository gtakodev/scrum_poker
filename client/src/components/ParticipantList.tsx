import type { Participant } from "@shared/types";
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
    <aside className="app-panel participants-panel" aria-labelledby="participants-title">
      <h2 id="participants-title">Participants ({participants.length})</h2>
      <ul className="participants-list">
        {participants.map((p) => {
          const isMe = p.id === myParticipantId;
          const hasVoted = p.vote !== null;
          const status = p.connected ? (hasVoted ? "Voted" : "Not voted") : "Offline";

          return (
            <li className="participant-row" key={p.id}>
              <span className="participant-avatar" aria-hidden="true">
                {Array.from(p.displayName)[0]?.toUpperCase()}
              </span>
              <div className="participant-info">
                <p className="participant-name">
                  {p.displayName}
                  {isMe && <span> (you)</span>}
                </p>
                <span className="participant-status" data-ready={p.connected && hasVoted}>{status}</span>
              </div>
              {revealed && hasVoted ? (
                <span className="participant-card vote-face" aria-label={`Vote: ${p.vote}`}>
                  {p.vote}
                </span>
              ) : (
                <span className="participant-card vote-back" data-voted={hasVoted} aria-hidden="true">
                  <span className="card-suit" />
                </span>
              )}
              {!isMe && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="remove-participant"
                  onClick={() => onKick(p.id)}
                  title={`Remove ${p.displayName}`}
                  aria-label={`Remove ${p.displayName}`}
                >
                  <X aria-hidden="true" />
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
