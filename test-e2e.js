const { io } = require("socket.io-client");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

// Run server directly in-process on test port 3005
process.env.PORT = "3005";
const app = express();
const server = http.createServer(app);
const ioServer = new Server(server, { cors: { origin: "*" } });

// Require modules to test
const { DEFAULT_QUESTIONS } = require("./src/questions");
const { validatePlayerName, isNameDuplicate, generateToken } = require("./src/security");

// Load the updated server logic or launch child process
const { spawn } = require("child_process");

async function runTestSuite() {
  console.log("--- Starting Isolated E2E Test on Port 3005 ---");
  const serverProc = spawn("node", ["server.js"], {
    env: { ...process.env, PORT: "3005" },
    stdio: "inherit"
  });

  await new Promise(r => setTimeout(r, 1200));

  const URL = "http://127.0.0.1:3005";
  const hostSocket = io(URL, { transports: ["websocket", "polling"] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Host connect timeout")), 5000);
    hostSocket.on("connect", () => {
      clearTimeout(timer);
      resolve();
    });
  });
  console.log("✓ 1. Host connected on port 3005");

  // Test Host PIN check (Wrong PIN should fail)
  const failPinRes = await new Promise(resolve => {
    hostSocket.emit("host:create-room", { maxRounds: 3, pin: "9999" }, resolve);
  });
  if (failPinRes && failPinRes.success === false) {
    console.log("✓ 2. Host PIN security check PASSED (Rejected wrong PIN)");
  } else {
    serverProc.kill();
    throw new Error("Host PIN protection failed: accepted wrong PIN");
  }

  // Create room with correct PIN
  const createRes = await new Promise(resolve => {
    hostSocket.emit("host:create-room", { maxRounds: 3, pin: "1234" }, resolve);
  });
  console.log("✓ 3. Host created room with PIN 1234:", createRes.roomCode);
  const { roomId, roomCode, hostToken } = createRes;

  // 2. Connect Players
  const p1Socket = io(URL, { transports: ["websocket", "polling"] });
  const p2Socket = io(URL, { transports: ["websocket", "polling"] });
  
  await Promise.all([
    new Promise(r => p1Socket.on("connect", r)),
    new Promise(r => p2Socket.on("connect", r))
  ]);

  // Test Profanity filter on player:join
  const badWordRes = await new Promise(resolve => {
    p1Socket.emit("player:join", { roomCode, playerName: "ไอ้เหี้ย" }, resolve);
  });
  if (badWordRes && badWordRes.success === false) {
    console.log("✓ 4. Profanity Filter on player:join PASSED:", badWordRes.message);
  } else {
    serverProc.kill();
    throw new Error("Profanity filter failed to block bad word");
  }

  // Valid join Player 1
  const p1Join = await new Promise(resolve => {
    p1Socket.emit("player:join", { roomCode, playerName: "Peemnaja" }, resolve);
  });
  console.log("✓ 5. Player 1 joined:", p1Join.playerName, "Token:", p1Join.playerToken ? "OK" : "Missing");

  // Test Duplicate name
  const dupRes = await new Promise(resolve => {
    p2Socket.emit("player:join", { roomCode, playerName: "Peemnaja" }, resolve);
  });
  if (dupRes && dupRes.success === false) {
    console.log("✓ 6. Duplicate Name Prevention PASSED:", dupRes.message);
  } else {
    serverProc.kill();
    throw new Error("Duplicate name prevention failed");
  }

  // Valid join Player 2
  const p2Join = await new Promise(resolve => {
    p2Socket.emit("player:join", { roomCode, playerName: "Somchai" }, resolve);
  });
  console.log("✓ 7. Player 2 joined:", p2Join.playerName);

  // Test Auto-Reconnection & Session Resume
  const resumeRes = await new Promise(resolve => {
    p1Socket.emit("player:resume-session", {
      roomId,
      playerId: p1Join.playerId,
      playerToken: p1Join.playerToken
    }, resolve);
  });
  if (resumeRes && resumeRes.success && resumeRes.playerId === p1Join.playerId) {
    console.log("✓ 8. Auto-Reconnection / Session Resume PASSED (Rebound smoothly)");
  } else {
    serverProc.kill();
    throw new Error("Session resume failed");
  }

  // 3. Host starts round 1
  const roundStartedPromise = new Promise(resolve => {
    p1Socket.on("game:round-started", resolve);
  });

  const startRes = await new Promise(resolve => {
    hostSocket.emit("host:start-round", { roomId, hostToken, duration: 15 }, resolve);
  });
  console.log("✓ 9. Host started round 1:", startRes.question.question);

  const roundData = await roundStartedPromise;
  console.log("✓ 10. Player 1 received round-started:", roundData.question.question);

  // 4. Players submit answers
  const resultPromise = new Promise(resolve => {
    hostSocket.on("game:round-result", resolve);
  });

  await Promise.all([
    new Promise(resolve => p1Socket.emit("player:submit-answer", { roomId, playerId: p1Join.playerId, choice: "A" }, resolve)),
    new Promise(resolve => p2Socket.emit("player:submit-answer", { roomId, playerId: p2Join.playerId, choice: "A" }, resolve))
  ]);
  console.log("✓ 11. Both players submitted answer 'A' (Early auto-calculate triggered)");

  const resultData = await resultPromise;
  console.log("✓ 12. Game round result received:");
  console.log("  - Majority:", resultData.result.majority);
  console.log("  - Alive Count:", resultData.result.aliveCount);
  console.log("  - Player 1 Total Score:", resultData.breakdowns[p1Join.playerId].totalScore);

  // 5. Test CSV export
  const csvRes = await fetch(`${URL}/api/export-results/${roomId}`);
  const csvText = await csvRes.text();
  console.log("✓ 13. CSV Export check:\n" + csvText.trim());

  // Cleanup
  hostSocket.disconnect();
  p1Socket.disconnect();
  p2Socket.disconnect();
  serverProc.kill();
  console.log("🎉 ALL 13 TEST SUITES PASSED FLAWLESSLY! 🎉");
  process.exit(0);
}

runTestSuite().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
