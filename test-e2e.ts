/**
 * End-to-end test script for SprintVote.
 * Run with: bun run test-e2e.ts
 * Requires the server to be running on port 3000.
 */

const BASE_URL = "http://localhost:3000";
const WS_BASE = "ws://localhost:3000";

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

  function waitOpen(timeoutMs = 3000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (ws.readyState === WebSocket.OPEN) return resolve();
      const timer = setTimeout(() => reject(new Error("WS open timeout")), timeoutMs);
      ws.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      ws.addEventListener("error", (e) => { clearTimeout(timer); reject(e); }, { once: true });
    });
  }

  return { ws, nextMessage, waitOpen };
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
  assert(aliceReconnectMsg.state.participants.length === 2, "Still 2 participants");

  // Bob sees Alice reconnected
  const bobSeeAliceReconnect = await bob.nextMessage();
  const aliceReconnectedInBob = bobSeeAliceReconnect.state.participants.find((p: any) => p.id === aliceId);
  assert(aliceReconnectedInBob.connected === true, "Bob sees Alice reconnected");

  // ─── 12. Invalid vote value ───
  console.log("\n12. Error Handling: Invalid Vote");
  alice2.ws.send(JSON.stringify({ type: "vote", value: "999" }));
  const errorMsg = await alice2.nextMessage();
  assert(errorMsg.type === "error", "Invalid vote returns error");
  assert(errorMsg.message === "Invalid vote value", "Error message correct");

  // ─── 13. Can't kick yourself ───
  console.log("\n13. Error Handling: Can't Kick Yourself");
  alice2.ws.send(JSON.stringify({ type: "kick", participantId: aliceId }));
  const selfKickError = await alice2.nextMessage();
  assert(selfKickError.type === "error", "Self-kick returns error");
  assert(selfKickError.message === "Cannot kick yourself", "Self-kick error message");

  // ─── 14. Special card values ───
  console.log("\n14. Special Card Values (?, coffee)");
  alice2.ws.send(JSON.stringify({ type: "vote", value: "?" }));
  const qVoteMsg = await alice2.nextMessage();
  const aliceQVote = qVoteMsg.state.participants.find((p: any) => p.id === aliceId);
  assert(aliceQVote.vote === "?", "Alice voted '?'");
  await bob.nextMessage(); // drain Bob's update

  alice2.ws.send(JSON.stringify({ type: "vote", value: "☕" }));
  const coffeeVoteMsg = await alice2.nextMessage();
  const aliceCoffeeVote = coffeeVoteMsg.state.participants.find((p: any) => p.id === aliceId);
  assert(aliceCoffeeVote.vote === "☕", "Alice voted '☕'");
  await bob.nextMessage(); // drain Bob's update

  // ─── 15. Vote not allowed after reveal ───
  console.log("\n15. Vote Not Allowed After Reveal");
  // Reset first, then vote, reveal, then try to vote again
  alice2.ws.send(JSON.stringify({ type: "reset" }));
  await alice2.nextMessage();
  await bob.nextMessage();

  alice2.ws.send(JSON.stringify({ type: "vote", value: "8" }));
  await alice2.nextMessage();
  await bob.nextMessage();

  alice2.ws.send(JSON.stringify({ type: "reveal" }));
  await alice2.nextMessage();
  await bob.nextMessage();

  // Now try to vote — should silently not change (the server ignores votes when revealed)
  alice2.ws.send(JSON.stringify({ type: "vote", value: "13" }));
  // Since the vote doesn't change state (server ignores), it still broadcasts
  const afterRevealVote = await alice2.nextMessage();
  const aliceVoteAfterReveal = afterRevealVote.state.participants.find((p: any) => p.id === aliceId);
  assert(aliceVoteAfterReveal.vote === "8", "Vote unchanged after reveal (still '8')");

  // ─── 16. Attempting operations without joining ───
  console.log("\n16. Error Handling: Not Joined");
  const noJoin = createQueuedWS(`${WS_BASE}/ws/${roomId}`);
  await noJoin.waitOpen();
  noJoin.ws.send(JSON.stringify({ type: "vote", value: "5" }));
  const notJoinedError = await noJoin.nextMessage();
  assert(notJoinedError.type === "error", "Operation without join returns error");
  assert(notJoinedError.message === "Not joined to a room", "Error message for not joined");
  noJoin.ws.close();

  // ─── Cleanup ───
  alice2.ws.close();
  bob.ws.close();
  charlie.ws.close();

  console.log("\n=== ALL 16 TESTS PASSED ===\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("\nFATAL:", err);
  process.exit(1);
});
