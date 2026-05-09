import confetti from "canvas-confetti";
import { getThemeConfettiColors, type ThemeName } from "@/themes";

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function triggerConfetti(theme: ThemeName): void {
  if (prefersReducedMotion()) {
    return;
  }

  const colors = getThemeConfettiColors(theme);

  // Burst from left
  confetti({
    particleCount: 80,
    angle: 60,
    spread: 55,
    origin: { x: 0, y: 0.6 },
    colors,
  });

  // Burst from right
  confetti({
    particleCount: 80,
    angle: 120,
    spread: 55,
    origin: { x: 1, y: 0.6 },
    colors,
  });

  // Delayed center burst for extra effect
  setTimeout(() => {
    confetti({
      particleCount: 50,
      spread: 360,
      startVelocity: 20,
      origin: { x: 0.5, y: 0.4 },
      colors,
    });
  }, 250);
}

/**
 * Check if all votes are unanimous.
 * Requires at least 2 voters with non-null votes.
 */
export function isUnanimous(votes: (string | null)[]): boolean {
  const actual = votes.filter((v): v is string => v !== null);
  if (actual.length < 2) return false;
  return actual.every((v) => v === actual[0]);
}
