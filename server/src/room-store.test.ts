import { beforeEach, describe, expect, it } from "vitest";
import {
  addParticipant,
  buildRoomState,
  createRoom,
  disconnectParticipant,
  removeParticipant,
  resetStoreForTests,
  revealVotes,
  setVote,
} from "./room-store";

describe("room-store", () => {
  beforeEach(() => {
    resetStoreForTests();
  });

  it("reuses a participant when reconnecting with the same session token", () => {
    const room = createRoom("session lifecycle");
    const firstJoin = addParticipant(room, "Alice");

    disconnectParticipant(room, firstJoin.participant.id);
    const reconnect = addParticipant(room, "Alice Updated", firstJoin.sessionToken);

    expect(reconnect.participant.id).toBe(firstJoin.participant.id);
    expect(reconnect.participant.displayName).toBe("Alice Updated");
  });

  it("removes the session when a participant is kicked", () => {
    const room = createRoom("kick lifecycle");
    const firstJoin = addParticipant(room, "Alice");

    removeParticipant(room, firstJoin.participant.id);
    const rejoin = addParticipant(room, "Alice Returns", firstJoin.sessionToken);

    expect(rejoin.participant.id).not.toBe(firstJoin.participant.id);
  });

  it("hides other participants votes before reveal", () => {
    const room = createRoom("private votes");
    const alice = addParticipant(room, "Alice").participant;
    const bob = addParticipant(room, "Bob").participant;

    setVote(room, alice.id, "8");
    setVote(room, bob.id, "13");

    const aliceView = buildRoomState(room, alice.id);
    const bobInAliceView = aliceView.participants.find((participant) => participant.id === bob.id);

    expect(bobInAliceView?.vote).toBe("hidden");
  });

  it("treats same vote and repeated reveal as no-ops", () => {
    const room = createRoom("no-op checks");
    const participant = addParticipant(room, "Alice").participant;

    expect(setVote(room, participant.id, "5")).toBe(true);
    expect(setVote(room, participant.id, "5")).toBe(false);
    expect(revealVotes(room)).toBe(true);
    expect(revealVotes(room)).toBe(false);
  });
});
