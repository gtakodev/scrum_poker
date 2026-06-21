import { useEffect, useRef } from "react";
import type { RoomState } from "@shared/types";
import { triggerConfetti, isUnanimous } from "@/lib/confetti";

export function useConfettiOnReveal(roomState: RoomState | null) {
  const prevRevealed = useRef(false);

  useEffect(() => {
    if (!roomState) {
      prevRevealed.current = false;
      return;
    }

    if (roomState.revealed && !prevRevealed.current) {
      const votes = roomState.participants.map((participant) => participant.vote);
      if (isUnanimous(votes)) {
        triggerConfetti();
      }
    }

    prevRevealed.current = roomState.revealed;
  }, [roomState]);
}
