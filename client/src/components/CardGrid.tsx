import { Coffee } from "lucide-react";

interface CardGridProps {
  deck: string[];
  myVote: string | null | undefined;
  revealed: boolean;
  onVote: (value: string) => void;
}

export default function CardGrid({
  deck,
  myVote,
  revealed,
  onVote,
}: CardGridProps) {

  return (
    <section className="board-deck" aria-labelledby="deck-title">
      <h2 id="deck-title">{revealed ? "Votes revealed" : "Select your estimate"}</h2>
      <p>{revealed ? "Choose another card to adjust your vote." : "Your vote stays hidden until the team reveals."}</p>
      <div className="estimate-deck">
        {deck.map((value) => {
          const isCoffee = value === "☕";
          return (
            <button
              key={value}
              type="button"
              onClick={() => onVote(value)}
              className="estimate-card"
              aria-pressed={myVote === value}
              aria-label={isCoffee ? "Coffee break" : undefined}
            >
              {isCoffee ? <Coffee aria-hidden="true" /> : (
                <>
                  <span>{value}</span>
                  <span className="card-suit" aria-hidden="true" />
                </>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
