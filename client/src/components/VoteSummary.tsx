import type { Participant } from "@shared/types";
import { isUnanimous } from "@/lib/confetti";

interface VoteSummaryProps {
  participants: Participant[];
}

export default function VoteSummary({ participants }: VoteSummaryProps) {
  const votes = participants
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
  const consensus = isUnanimous(votes);

  return (
    <section className="vote-results" aria-labelledby="results-title">
      <h3 id="results-title">Results</h3>
      <dl className="result-stats">
        {average !== null && (
          <div>
            <dt>Average</dt>
            <dd>{average.toFixed(1)}</dd>
          </div>
        )}
        <div>
          <dt>Most Common</dt>
          <dd>{mostCommon.join(", ")}</dd>
        </div>
        <div>
          <dt>Consensus</dt>
          <dd data-consensus={consensus}>{consensus ? "Yes!" : "No"}</dd>
        </div>
      </dl>

      {/* Vote distribution */}
      <ul className="vote-distribution" aria-label="Vote distribution">
        {Object.entries(counts)
          .sort(([a], [b]) => {
            const na = parseFloat(a);
            const nb = parseFloat(b);
            if (!isNaN(na) && !isNaN(nb)) return na - nb;
            return a.localeCompare(b);
          })
          .map(([value, count]) => (
            <li key={value}>
              <strong>{value}</strong>
              <span>×{count}</span>
            </li>
          ))}
      </ul>
    </section>
  );
}
