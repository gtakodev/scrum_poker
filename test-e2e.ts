/**
 * End-to-end test script for SprintVote.
 * Run with: bun run test-e2e.ts
 * Requires the server to be running on port 3000.
 */

const PORT = process.env.PORT || "3000";
const BASE_URL = `http://127.0.0.1:${PORT}`;
const WS_BASE = `ws://127.0.0.1:${PORT}`;

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    console.error(`  FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`  PASS: ${msg}`);
}

/** Create a WebSocket with a message queue so we never miss messages */
function createQueuedWS(url: string): {
  ws: WebSocket;
  nextMessage: (timeoutMs?: number) => Promise<any>;
  expectNoMessage: (timeoutMs?: number) => Promise<void>;
  waitOpen: (timeoutMs?: number) => Promise<void>;
} {
  const queue: any[] = [];
  let waiter: { resolve: (v: any) => void; reject: (e: Error) => void } | null = null;

  const ws = new WebSocket(url);

  ws.addEventListener("message", (event) => {
    const data = JSON.parse(event.data as string);
    if (waiter) {
      const w = waiter;
      waiter = null;
      w.resolve(data);
    } else {
      queue.push(data);
    }
  });

  function nextMessage(timeoutMs = 3000): Promise<any> {
    if (queue.length > 0) {
      return Promise.resolve(queue.shift());
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        waiter = null;
        reject(new Error("WS message timeout"));
      }, timeoutMs);
      waiter = {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      };
    });
  }

  async function expectNoMessage(timeoutMs = 400): Promise<void> {
    try {
      const message = await nextMessage(timeoutMs);
      throw new Error(`Unexpected WS message: ${JSON.stringify(message)}`);
    } catch (error) {
      if (error instanceof Error && error.message === "WS message timeout") {
        return;
      }

      throw error;
    }
  }

  function waitOpen(timeoutMs = 3000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (ws.readyState === WebSocket.OPEN) return resolve();
      const timer = setTimeout(() => reject(new Error("WS open timeout")), timeoutMs);
      ws.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      ws.addEventListener("error", (e) => { clearTimeout(timer); reject(e); }, { once: true });
    });
  }

  return { ws, nextMessage, expectNoMessage, waitOpen };
}

async function main() {
  console.log("\n=== SprintVote E2E Test ===\n");

  // ─── 1. Create Room via API ───
  console.log("1. Create Room");
  const createRes = await fetch(`${BASE_URL}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "E2E Test Sprint" }),
  });
  assert(createRes.status === 201, "Room created with 201");
  const { roomId, name } = (await createRes.json()) as any;
  assert(!!roomId, `Room ID returned: ${roomId}`);
  assert(name === "E2E Test Sprint", "Room name matches");

  // ─── 2. Check Room Exists ───
  console.log("\n2. Check Room Exists");
  const checkRes = await fetch(`${BASE_URL}/api/rooms/${roomId}`);
  const checkData = (await checkRes.json()) as any;
  assert(checkData.exists === true, "Room exists");
  assert(checkData.name === "E2E Test Sprint", "Room name from GET");

  // ─── 3. Check Non-existent Room ───
  console.log("\n3. Check Non-existent Room");
  const noRoom = await fetch(`${BASE_URL}/api/rooms/nonexistent`);
  assert(noRoom.status === 404, "Non-existent room returns 404");

  // ─── 4. WebSocket: Alice joins ───
  console.log("\n4. Alice Joins via WebSocket");
  const alice = createQueuedWS(`${WS_BASE}/ws/${roomId}`);
  await alice.waitOpen();
  assert(true, "Alice WS connected");

  alice.ws.send(JSON.stringify({ type: "join", displayName: "Alice" }));
  const aliceJoinMsg = await alice.nextMessage();
  assert(aliceJoinMsg.type === "room_state", "Alice receives room_state");
  assert(!!aliceJoinMsg.yourParticipantId, `Alice gets participantId: ${aliceJoinMsg.yourParticipantId}`);
  assert(!!aliceJoinMsg.sessionToken, "Alice gets sessionToken");
  const aliceId = aliceJoinMsg.yourParticipantId;
  const aliceToken = aliceJoinMsg.sessionToken;
  assert(aliceJoinMsg.state.participants.length === 1, "1 participant after Alice joins");
  assert(aliceJoinMsg.state.participants[0].displayName === "Alice", "Participant is Alice");

  // ─── 5. WebSocket: Bob joins ───
  console.log("\n5. Bob Joins via WebSocket");
  const bob = createQueuedWS(`${WS_BASE}/ws/${roomId}`);
  await bob.waitOpen();
  bob.ws.send(JSON.stringify({ type: "join", displayName: "Bob" }));

  // Bob receives room_state
  const bobJoinMsg = await bob.nextMessage();
  assert(bobJoinMsg.type === "room_state", "Bob receives room_state");
  assert(!!bobJoinMsg.yourParticipantId, `Bob gets participantId: ${bobJoinMsg.yourParticipantId}`);
  const bobId = bobJoinMsg.yourParticipantId;
  const bobToken = bobJoinMsg.sessionToken;
  assert(bobJoinMsg.state.participants.length === 2, "2 participants after Bob joins");

  // Alice also receives updated state
  const aliceUpdateAfterBob = await alice.nextMessage();
  assert(aliceUpdateAfterBob.state.participants.length === 2, "Alice sees 2 participants");

  // ─── 6. Alice Votes ───
  console.log("\n6. Alice Votes '5'");
  alice.ws.send(JSON.stringify({ type: "vote", value: "5" }));

  // Alice sees her own vote
  const aliceVoteMsg = await alice.nextMessage();
  const aliceInState = aliceVoteMsg.state.participants.find((p: any) => p.id === aliceId);
  assert(aliceInState.vote === "5", "Alice sees her own vote as '5'");

  // Bob sees Alice's vote as "hidden"
  const bobSeeAliceVote = await bob.nextMessage();
  const aliceInBobView = bobSeeAliceVote.state.participants.find((p: any) => p.id === aliceId);
  assert(aliceInBobView.vote === "hidden", "Bob sees Alice's vote as 'hidden'");
  assert(bobSeeAliceVote.state.revealed === false, "Not yet revealed");

  // ─── 7. Bob Votes ───
  console.log("\n7. Bob Votes '5' (same as Alice for unanimity)");
  bob.ws.send(JSON.stringify({ type: "vote", value: "5" }));

  const bobVoteMsg = await bob.nextMessage();
  const bobInState = bobVoteMsg.state.participants.find((p: any) => p.id === bobId);
  assert(bobInState.vote === "5", "Bob sees his own vote as '5'");

  // Alice sees Bob's vote hidden
  const aliceSeeBobVote = await alice.nextMessage();
  const bobInAliceView = aliceSeeBobVote.state.participants.find((p: any) => p.id === bobId);
  assert(bobInAliceView.vote === "hidden", "Alice sees Bob's vote as 'hidden'");

  // ─── 8. Reveal Votes ───
  console.log("\n8. Reveal Votes");
  alice.ws.send(JSON.stringify({ type: "reveal" }));

  const aliceRevealMsg = await alice.nextMessage();
  assert(aliceRevealMsg.state.revealed === true, "State is revealed");
  const aliceAfterReveal = aliceRevealMsg.state.participants.find((p: any) => p.id === aliceId);
  const bobAfterRevealInAliceView = aliceRevealMsg.state.participants.find((p: any) => p.id === bobId);
  assert(aliceAfterReveal.vote === "5", "Alice's vote visible: 5");
  assert(bobAfterRevealInAliceView.vote === "5", "Bob's vote visible to Alice: 5");

  // Bob also sees revealed
  const bobRevealMsg = await bob.nextMessage();
  assert(bobRevealMsg.state.revealed === true, "Bob sees revealed state");
  const aliceInBobReveal = bobRevealMsg.state.participants.find((p: any) => p.id === aliceId);
  assert(aliceInBobReveal.vote === "5", "Alice's vote visible to Bob: 5");

  // ─── 9. Reset Votes ───
  console.log("\n9. Reset Votes");
  bob.ws.send(JSON.stringify({ type: "reset" }));

  const bobResetMsg = await bob.nextMessage();
  assert(bobResetMsg.state.revealed === false, "Not revealed after reset");
  const bobAfterReset = bobResetMsg.state.participants.find((p: any) => p.id === bobId);
  assert(bobAfterReset.vote === null, "Bob's vote is null after reset");

  const aliceResetMsg = await alice.nextMessage();
  const aliceAfterReset = aliceResetMsg.state.participants.find((p: any) => p.id === aliceId);
  assert(aliceAfterReset.vote === null, "Alice's vote is null after reset");

  // ─── 10. Charlie joins and gets kicked ───
  console.log("\n10. Charlie Joins and Gets Kicked");
  const charlie = createQueuedWS(`${WS_BASE}/ws/${roomId}`);
  await charlie.waitOpen();
  charlie.ws.send(JSON.stringify({ type: "join", displayName: "Charlie" }));
  const charlieJoinMsg = await charlie.nextMessage();
  const charlieId = charlieJoinMsg.yourParticipantId;
  const charlieToken = charlieJoinMsg.sessionToken;
  assert(charlieJoinMsg.state.participants.length === 3, "3 participants after Charlie joins");

  // Drain Alice and Bob's update messages from Charlie joining
  await alice.nextMessage();
  await bob.nextMessage();

  // Alice kicks Charlie
  alice.ws.send(JSON.stringify({ type: "kick", participantId: charlieId }));

  // Charlie should receive a "kicked" message
  const charlieKickMsg = await charlie.nextMessage();
  assert(charlieKickMsg.type === "kicked", "Charlie receives 'kicked' message");

  // Alice sees 2 participants after kick
  const aliceAfterKick = await alice.nextMessage();
  assert(aliceAfterKick.state.participants.length === 2, "2 participants after kick");

  // Bob also sees 2
  const bobAfterKick = await bob.nextMessage();
  assert(bobAfterKick.state.participants.length === 2, "Bob sees 2 after kick");

  const kickedRoomCheck = await fetch(`${BASE_URL}/api/rooms/${roomId}`);
  const kickedRoomData = await kickedRoomCheck.json();
  assert(kickedRoomCheck.status === 200, "Kicked user can still access room link");
  assert(kickedRoomData.exists === true, "Room remains available after kick");

  // Returning with the old kicked token should not restore the removed identity.
  const charlieReturn = createQueuedWS(`${WS_BASE}/ws/${roomId}`);
  await charlieReturn.waitOpen();
  charlieReturn.ws.send(
    JSON.stringify({
      type: "join",
      displayName: "Charlie Returns",
      sessionToken: charlieToken,
    })
  );
  const charlieReturnMsg = await charlieReturn.nextMessage();
  assert(charlieReturnMsg.type === "room_state", "Kicked user can rejoin manually");
  assert(charlieReturnMsg.yourParticipantId !== charlieId, "Old kicked token creates a new participant identity");
  assert(charlieReturnMsg.state.participants.length === 3, "Room has 3 participants after kicked user returns");

  await alice.nextMessage();
  await bob.nextMessage();
  charlieReturn.ws.close();
  const aliceSeeCharlieReturnLeave = await alice.nextMessage();
  const bobSeeCharlieReturnLeave = await bob.nextMessage();
  const charlieReturnedInBob = bobSeeCharlieReturnLeave.state.participants.find(
    (p: any) => p.id === charlieReturnMsg.yourParticipantId
  );
  assert(charlieReturnedInBob.connected === false, "Returned participant can leave without breaking room state");

  // ─── 11. Reconnection Test ───
  console.log("\n11. Alice Reconnects with Session Token");
  alice.ws.close();
  await new Promise((r) => setTimeout(r, 500));

  // Bob should see Alice disconnected (broadcast from handleClose)
  const bobSeeAliceDisconnect = await bob.nextMessage();
  const aliceDisconnectedInBob = bobSeeAliceDisconnect.state.participants.find((p: any) => p.id === aliceId);
  assert(aliceDisconnectedInBob.connected === false, "Bob sees Alice disconnected");

  const alice2 = createQueuedWS(`${WS_BASE}/ws/${roomId}`);
  await alice2.waitOpen();
  alice2.ws.send(
    JSON.stringify({ type: "join", displayName: "Alice", sessionToken: aliceToken })
  );
  const aliceReconnectMsg = await alice2.nextMessage();
  assert(aliceReconnectMsg.yourParticipantId === aliceId, "Alice reconnected with same ID");
  assert(aliceReconnectMsg.state.participants.length === 3, "Room state keeps disconnected participants after manual return");

  // Bob sees Alice reconnected
  const bobSeeAliceReconnect = await bob.nextMessage();
  const aliceReconnectedInBob = bobSeeAliceReconnect.state.participants.find((p: any) => p.id === aliceId);
  assert(aliceReconnectedInBob.connected === true, "Bob sees Alice reconnected");

  // ─── 11b. Same session allows only one active tab ───
  console.log("\n11b. Same Session Replaces Older Tab");
  const alice3 = createQueuedWS(`${WS_BASE}/ws/${roomId}`);
  await alice3.waitOpen();
  alice3.ws.send(
    JSON.stringify({ type: "join", displayName: "Alice", sessionToken: aliceToken })
  );
  const aliceLatestJoin = await alice3.nextMessage();
  assert(aliceLatestJoin.yourParticipantId === aliceId, "Latest tab keeps same participant ID");

  await new Promise((r) => setTimeout(r, 300));
  assert(
    alice2.ws.readyState === WebSocket.CLOSING || alice2.ws.readyState === WebSocket.CLOSED,
    "Older tab is closed when a newer tab takes over"
  );

  await bob.expectNoMessage();
  assert(true, "Tab replacement does not broadcast when room state is unchanged");

  alice3.ws.send(JSON.stringify({ type: "vote", value: "3" }));
  const aliceLatestVote = await alice3.nextMessage();
  const aliceLatestVoteState = aliceLatestVote.state.participants.find((p: any) => p.id === aliceId);
  assert(aliceLatestVoteState.vote === "3", "Newest tab receives subsequent room updates");

  const bobSeeLatestVote = await bob.nextMessage();
  const aliceInBobAfterReplacementVote = bobSeeLatestVote.state.participants.find((p: any) => p.id === aliceId);
  assert(aliceInBobAfterReplacementVote.vote === "hidden", "Other participants still see hidden vote after tab replacement");

  alice2.ws.close();

  // ─── 12. Invalid vote value ───
  console.log("\n12. Error Handling: Invalid Vote");
  alice3.ws.send(JSON.stringify({ type: "vote", value: "999" }));
  const errorMsg = await alice3.nextMessage();
  assert(errorMsg.type === "error", "Invalid vote returns error");
  assert(errorMsg.message === "Invalid vote value", "Error message correct");

  // ─── 13. Can't kick yourself ───
  console.log("\n13. Error Handling: Can't Kick Yourself");
  alice3.ws.send(JSON.stringify({ type: "kick", participantId: aliceId }));
  const selfKickError = await alice3.nextMessage();
  assert(selfKickError.type === "error", "Self-kick returns error");
  assert(selfKickError.message === "Cannot kick yourself", "Self-kick error message");

  // ─── 14. Special card values ───
  console.log("\n14. Special Card Values (?, coffee)");
  alice3.ws.send(JSON.stringify({ type: "vote", value: "?" }));
  const qVoteMsg = await alice3.nextMessage();
  const aliceQVote = qVoteMsg.state.participants.find((p: any) => p.id === aliceId);
  assert(aliceQVote.vote === "?", "Alice voted '?'");
  await bob.nextMessage(); // drain Bob's update

  alice3.ws.send(JSON.stringify({ type: "vote", value: "☕" }));
  const coffeeVoteMsg = await alice3.nextMessage();
  const aliceCoffeeVote = coffeeVoteMsg.state.participants.find((p: any) => p.id === aliceId);
  assert(aliceCoffeeVote.vote === "☕", "Alice voted '☕'");
  await bob.nextMessage(); // drain Bob's update

  // ─── 15. Vote can change after reveal ───
  console.log("\n15. Vote Can Change After Reveal");
  // Reset first, then vote, reveal, then update the vote again.
  alice3.ws.send(JSON.stringify({ type: "reset" }));
  await alice3.nextMessage();
  await bob.nextMessage();

  alice3.ws.send(JSON.stringify({ type: "vote", value: "8" }));
  await alice3.nextMessage();
  await bob.nextMessage();

  alice3.ws.send(JSON.stringify({ type: "reveal" }));
  await alice3.nextMessage();
  await bob.nextMessage();

  // Updating a vote after reveal should keep the room revealed and stay in sync.
  alice3.ws.send(JSON.stringify({ type: "vote", value: "13" }));
  const afterRevealVote = await alice3.nextMessage();
  const aliceVoteAfterReveal = afterRevealVote.state.participants.find((p: any) => p.id === aliceId);
  assert(afterRevealVote.state.revealed === true, "State stays revealed after vote change");
  assert(aliceVoteAfterReveal.vote === "13", "Alice can change vote after reveal");

  const bobAfterRevealVote = await bob.nextMessage();
  const aliceInBobAfterRevealVote = bobAfterRevealVote.state.participants.find((p: any) => p.id === aliceId);
  assert(aliceInBobAfterRevealVote.vote === "13", "Bob sees updated revealed vote");

  // Re-sending an identical vote should not broadcast anything.
  alice3.ws.send(JSON.stringify({ type: "vote", value: "13" }));
  await alice3.expectNoMessage();
  await bob.expectNoMessage();
  assert(true, "Unchanged vote does not trigger room_state broadcasts");

  // Revealing an already revealed room should also be a no-op.
  alice3.ws.send(JSON.stringify({ type: "reveal" }));
  await alice3.expectNoMessage();
  await bob.expectNoMessage();
  assert(true, "Repeated reveal does not trigger room_state broadcasts");

  // ─── 16. Attempting operations without joining ───
  console.log("\n16. Error Handling: Not Joined");
  const noJoin = createQueuedWS(`${WS_BASE}/ws/${roomId}`);
  await noJoin.waitOpen();
  noJoin.ws.send(JSON.stringify({ type: "vote", value: "5" }));
  const notJoinedError = await noJoin.nextMessage();
  assert(notJoinedError.type === "error", "Operation without join returns error");
  assert(notJoinedError.message === "Not joined to a room", "Error message for not joined");
  noJoin.ws.close();

  // ─── 17. Malformed join payload must not crash server ───
  console.log("\n17. Error Handling: Malformed Join Payload");
  const malformedJoin = createQueuedWS(`${WS_BASE}/ws/${roomId}`);
  await malformedJoin.waitOpen();
  malformedJoin.ws.send(JSON.stringify({ type: "join", displayName: { bad: true } }));
  const malformedJoinError = await malformedJoin.nextMessage();
  assert(malformedJoinError.type === "error", "Malformed join returns error");
  assert(malformedJoinError.message === "Invalid display name", "Malformed join error message");
  malformedJoin.ws.close();

  const malformedJson = createQueuedWS(`${WS_BASE}/ws/${roomId}`);
  await malformedJson.waitOpen();
  malformedJson.ws.send("{bad json");
  const malformedJsonError = await malformedJson.nextMessage();
  assert(malformedJsonError.type === "error", "Malformed JSON returns error");
  assert(malformedJsonError.message === "Invalid message format", "Malformed JSON error message");
  malformedJson.ws.close();

  const malformedVote = createQueuedWS(`${WS_BASE}/ws/${roomId}`);
  await malformedVote.waitOpen();
  malformedVote.ws.send(JSON.stringify({ type: "join", displayName: "Malformed Vote Tester" }));
  const malformedVoteJoin = await malformedVote.nextMessage();
  assert(malformedVoteJoin.type === "room_state", "Malformed vote tester joins");
  await alice3.nextMessage();
  await bob.nextMessage();
  malformedVote.ws.send(JSON.stringify({ type: "vote", value: 5 }));
  const malformedVoteError = await malformedVote.nextMessage();
  assert(malformedVoteError.type === "error", "Malformed vote returns error");
  assert(malformedVoteError.message === "Invalid vote payload", "Malformed vote error message");

  malformedVote.ws.send(JSON.stringify({ type: "kick", participantId: 42 }));
  const malformedKickError = await malformedVote.nextMessage();
  assert(malformedKickError.type === "error", "Malformed kick returns error");
  assert(malformedKickError.message === "Invalid participantId", "Malformed kick error message");
  malformedVote.ws.close();
  await alice3.nextMessage();
  await bob.nextMessage();

  // Sanity check: the server is still alive and the HTTP API still responds.
  const roomStillExistsRes = await fetch(`${BASE_URL}/api/rooms/${roomId}`);
  const roomStillExists = await roomStillExistsRes.json();
  assert(roomStillExistsRes.status === 200, "Server stays alive after malformed join");
  assert(roomStillExists.exists === true, "Room still exists after malformed join");

  // ─── Cleanup ───
  alice3.ws.close();
  bob.ws.close();
  charlie.ws.close();

  console.log("\n=== ALL E2E CHECKS PASSED ===\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("\nFATAL:", err);
  process.exit(1);
});
