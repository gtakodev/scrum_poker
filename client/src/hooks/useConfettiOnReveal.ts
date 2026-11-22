import { useEffect, useRef } from "react";
import type { RoomState } from "@shared/types";
import { triggerConfetti, isUnanimous } from "@/lib/confetti";

export function useConfettiOnReveal(roomState: RoomState | null) {
  const previous = useRef<RoomState | null>(null);

  useEffect(() => {
    if (roomState?.revealed && previous.current?.id === roomState.id && !previous.current.revealed) {
      const votes = roomState.participants.map((participant) => participant.vote);
      if (isUnanimous(votes)) {
        triggerConfetti();
      }
    }

    previous.current = roomState;
  }, [roomState]);
}
