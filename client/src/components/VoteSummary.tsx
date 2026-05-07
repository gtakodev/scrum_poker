import { useRoomStore } from "@/stores/useRoomStore";

export default function VoteSummary() {
  const roomState = useRoomStore((s) => s.roomState);

  if (!roomState || !roomState.revealed) return null;

  const votes = roomState.participants
    .map((p) => p.vote)
    .filter((v): v is string => v !== null);

  if (votes.length === 0) return null;

  // Count frequency
  const counts: Record<string, number> = {};
  for (const v of votes) {
    counts[v] = (counts[v] || 0) + 1;
  }

  // Numeric votes for average
  const numericVotes = votes
    .map((v) => parseFloat(v))
    .filter((n) => !isNaN(n));

  const average =
    numericVotes.length > 0
      ? numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length
      : null;

  // Most common vote
  const maxCount = Math.max(...Object.values(counts));
  const mostCommon = Object.entries(counts)
    .filter(([, c]) => c === maxCount)
    .map(([v]) => v);

  // Check unanimity
  const isUnanimous = Object.keys(counts).length === 1 && votes.length > 1;

  return (
    <div className="animate-fade-in-up w-full max-w-md rounded-lg border border-t-4 border-t-primary bg-card p-4">
      <h3 className="mb-3 text-sm font-medium text-muted-foreground">
        Results
      </h3>
      <div className="grid grid-cols-3 gap-4 text-center">
        {average !== null && (
          <div>
            <div className="text-2xl font-bold text-primary">{average.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">Average</div>
          </div>
        )}
        <div>
          <div className="text-2xl font-bold">{mostCommon.join(", ")}</div>
          <div className="text-xs text-muted-foreground">
            Most Common
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold">
            {isUnanimous ? (
              <span className="text-primary">Yes!</span>
            ) : (
              "No"
            )}
          </div>
          <div className="text-xs text-muted-foreground">Consensus</div>
        </div>
      </div>

      {/* Vote distribution */}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {Object.entries(counts)
          .sort(([a], [b]) => {
            const na = parseFloat(a);
            const nb = parseFloat(b);
            if (!isNaN(na) && !isNaN(nb)) return na - nb;
            return a.localeCompare(b);
          })
          .map(([value, count]) => (
            <div
              key={value}
              className="flex items-center gap-1.5 rounded-md border bg-secondary/50 px-2.5 py-1 text-sm"
            >
              <span className="font-bold">{value}</span>
              <span className="text-muted-foreground">x{count}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
