import { cn } from "@/lib/utils";

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
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-muted-foreground">
        {revealed ? "Votes revealed - adjust if needed" : "Select your estimate"}
      </h2>
      <div className="flex flex-wrap justify-center gap-3">
        {deck.map((value, index) => {
          const isSelected = myVote === value;
          return (
            <button
              key={value}
              onClick={() => onVote(value)}
              className={cn(
                "animate-card-pop",
                "flex h-20 w-14 items-center justify-center rounded-lg border-2 text-lg font-bold",
                "transition-all duration-200 ease-out",
                "hover:-translate-y-1 hover:shadow-lg hover:border-primary/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
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
