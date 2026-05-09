import { useEffect, useRef } from "react";
import { useRoomStore } from "@/stores/useRoomStore";
import { useTheme } from "@/themes";
import { triggerConfetti, isUnanimous } from "@/lib/confetti";

/**
 * Watch for unanimous votes when reveal happens.
 * Triggers confetti animation once per reveal cycle.
 */
export function useConfettiOnReveal() {
  const roomState = useRoomStore((s) => s.roomState);
  const { theme } = useTheme();
  const prevRevealed = useRef(false);

  useEffect(() => {
    if (!roomState) {
      prevRevealed.current = false;
      return;
    }

    // Detect transition from hidden → revealed
    if (roomState.revealed && !prevRevealed.current) {
      const votes = roomState.participants.map((p) => p.vote);
      if (isUnanimous(votes)) {
        triggerConfetti(theme);
      }
    }

    prevRevealed.current = roomState.revealed;
  }, [roomState, theme]);
}
