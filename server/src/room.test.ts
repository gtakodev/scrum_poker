import { describe, expect, test } from "bun:test";
import {
  addParticipant,
  buildRoomState,
  createRoom,
  disconnectParticipant,
  removeParticipant,
  revealVotes,
  setVote,
} from "./room";

describe("room state transitions", () => {
  test("session tokens reconnect existing participants until the participant is removed", () => {
    const room = createRoom("session lifecycle");
    const firstJoin = addParticipant(room, "Alice");

    disconnectParticipant(room, firstJoin.participant.id);
    const reconnect = addParticipant(room, "Alice Updated", firstJoin.sessionToken);

    expect(reconnect.participant.id).toBe(firstJoin.participant.id);
    expect(reconnect.participant.displayName).toBe("Alice Updated");

    removeParticipant(room, firstJoin.participant.id);
    const afterRemoval = addParticipant(room, "Alice Returns", firstJoin.sessionToken);

    expect(afterRemoval.participant.id).not.toBe(firstJoin.participant.id);
  });

  test("unchanged votes and repeated reveal are no-ops", () => {
    const room = createRoom("no-op checks");
    const { participant } = addParticipant(room, "Alice");

    expect(setVote(room, participant.id, "5")).toBe(true);
    expect(setVote(room, participant.id, "5")).toBe(false);
    expect(revealVotes(room)).toBe(true);
    expect(revealVotes(room)).toBe(false);
  });

  test("unrevealed room state only shows each participant their own vote", () => {
    const room = createRoom("private votes");
    const alice = addParticipant(room, "Alice").participant;
    const bob = addParticipant(room, "Bob").participant;

    setVote(room, alice.id, "8");
    setVote(room, bob.id, "13");

    const aliceView = buildRoomState(room, alice.id);
    const aliceInAliceView = aliceView.participants.find((p) => p.id === alice.id);
    const bobInAliceView = aliceView.participants.find((p) => p.id === bob.id);

    expect(aliceInAliceView?.vote).toBe("8");
    expect(bobInAliceView?.vote).toBe("hidden");
  });
});
