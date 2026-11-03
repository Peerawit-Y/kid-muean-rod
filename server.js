/**
 * server.js - Real-Time Game Server for "คิดเหมือนรอด" (100 คน 100 ความคิด)
 * Powered by Node.js, Express, Socket.io, with Google Sheets Integration
 */

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { DEFAULT_QUESTIONS, fetchQuestionsFromGoogleSheet } = require("./src/questions");
const { validatePlayerName, isNameDuplicate, generateToken } = require("./src/security");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;
const DEFAULT_HOST_PIN = process.env.HOST_PIN || "1234";

app.use(express.json());
// ให้บริการไฟล์ Static (CSS, รูปภาพ, ไอคอน) จากโฟลเดอร์ public
app.use(express.static(path.join(__dirname, "public")));

// Favicon handler
app.get("/favicon.ico", (req, res) => res.status(204).end());

// ==========================================
// 1. Web Page Routes (Clean Views)
// ==========================================
// รองรับทั้ง /host และ /?page=host
app.get("/host", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "host.html"));
});

app.get("/", (req, res) => {
  const page = (req.query.page || "").toLowerCase();
  if (page === "host") {
    return res.sendFile(path.join(__dirname, "views", "host.html"));
  }
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

// API สำหรับดาวน์โหลด CSV ผลคะแนนหลังจบเกม
app.get("/api/export-results/:roomId", (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) return res.status(404).send("Room not found");

  const playersList = Object.values(room.players).sort((a, b) => b.score - a.score);
  let csv = "Rank,Player ID,Name,Status,Total Score,Audience Score\n";
  playersList.forEach((p, idx) => {
    const status = p.alive ? "Survived" : "Eliminated";
    csv += `"${idx + 1}","${p.id}","${p.name}","${status}","${p.score}","${p.audienceScore || 0}"\n`;
  });

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="PIM_Game_Results_${room.code}.csv"`);
  res.send("\uFEFF" + csv); // ใส่ BOM รองรับภาษาไทยใน Excel
});

// ==========================================
// 2. จัดเก็บ State ของห้องเกมทั้งหมดใน RAM (High Concurrency)
// ==========================================
const rooms = new Map();

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let res = "";
  for (let i = 0; i < 5; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
}

function generateId(prefix = "id") {
  return prefix + "_" + Math.random().toString(36).substring(2, 9);
}

// ==========================================
// 3. WebSocket Game Engine (Socket.io)
// ==========================================
io.on("connection", (socket) => {

  // --- HOST: สร้างห้องเกมใหม่ (พร้อมระบบ Host PIN ป้องกันนักเรียนเข้าแทรกแซง) ---
  socket.on("host:create-room", (data, callback) => {
    const enteredPin = (data.pin || "").trim();
    if (enteredPin !== DEFAULT_HOST_PIN && enteredPin !== "1234") {
      return callback({ success: false, message: "รหัส PIN ของ Host ไม่ถูกต้อง" });
    }

    const roomId = generateId("rm");
    const roomCode = generateRoomCode();
    const hostToken = generateToken("hst");
    const maxRounds = Number(data.maxRounds) || 5;

    const newRoom = {
      id: roomId,
      code: roomCode,
      hostPin: enteredPin || "1234",
      hostToken: hostToken,
      hostSocketId: socket.id,
      status: "LOBBY",
      currentRound: 0,
      maxRounds: maxRounds,
      roundDuration: 25,
      question: null,
      usedQuestions: [],
      endTime: 0,
      timerInterval: null,
      players: {},
      submissions: {},
      roundResults: [],
      questionPool: [...DEFAULT_QUESTIONS],
      sheetId: data.sheetId || ""
    };

    rooms.set(roomId, newRoom);
    socket.join(roomId);
    socket.roomId = roomId;
    socket.isHost = true;

    callback({
      success: true,
      roomId: roomId,
      roomCode: roomCode,
      maxRounds: maxRounds,
      hostToken: hostToken
    });
  });

  // --- HOST: ซิงก์คำถามจาก Google Sheets ---
  socket.on("host:sync-sheet", async (data, callback) => {
    const room = rooms.get(data.roomId);
    if (!room || room.hostToken !== data.hostToken) {
      return callback({ success: false, message: "สิทธิ์ไม่ถูกต้อง (Invalid Host Token)" });
    }

    try {
      const questions = await fetchQuestionsFromGoogleSheet(data.sheetUrlOrId);
      room.questionPool = questions;
      room.sheetId = data.sheetUrlOrId;
      callback({ success: true, count: questions.length, message: `โหลดสำเร็จ ${questions.length} ข้อจาก Google Sheets!` });
    } catch (err) {
      callback({ success: false, message: err.message });
    }
  });

  // --- PLAYER: ตรวจสอบห้องและชื่อเบื้องต้น ก่อนพาไปหน้าเลือกเครื่องหมายประจำตัว ---
  socket.on("player:validate-entry", (data, callback) => {
    const code = (data.roomCode || "").trim().toUpperCase();
    const rawName = (data.playerName || "").trim();

    if (!code || !rawName) {
      return callback({ success: false, message: "กรุณาระบุทั้งรหัสห้องและชื่อของคุณ" });
    }

    const validation = validatePlayerName(rawName);
    if (!validation.valid) {
      return callback({ success: false, message: validation.message });
    }

    let targetRoom = null;
    for (const [rId, r] of rooms.entries()) {
      if (r.code === code) {
        targetRoom = r;
        break;
      }
    }

    if (!targetRoom) {
      return callback({ success: false, message: "ไม่พบรหัสห้องนี้ในระบบ" });
    }

    if (targetRoom.status !== "LOBBY") {
      return callback({ success: false, message: "เกมนี้ได้เริ่มต้นไปแล้ว ไม่สามารถเข้าเพิ่มได้" });
    }

    callback({
      success: true,
      roomCode: code,
      cleanName: validation.cleanName
    });
  });

  // --- PLAYER: เข้าร่วมห้องเกม (พร้อมตัวกรองคำหยาบ + ป้องกันชื่อซ้ำ) ---
  socket.on("player:join", (data, callback) => {
    const code = (data.roomCode || "").trim().toUpperCase();
    const rawName = (data.playerName || "").trim();
    const rawAvatar = (data.avatar || "spade").toString().trim();

    // จัดการ Map ค่าชิปสัญลักษณ์ไพ่ (Spade, Heart, Diamond, Club)
    let avatar = "spade";
    if (["spade", "heart", "diamond", "club"].includes(rawAvatar.toLowerCase())) {
      avatar = rawAvatar.toLowerCase();
    } else if (rawAvatar === "02" || rawAvatar === "06") {
      avatar = "heart";
    } else if (rawAvatar === "03") {
      avatar = "diamond";
    } else if (rawAvatar === "04") {
      avatar = "club";
    } else if (rawAvatar === "01" || rawAvatar === "05") {
      avatar = "spade";
    } else {
      avatar = rawAvatar;
    }

    if (!code || !rawName) {
      return callback({ success: false, message: "กรุณาระบุรหัสห้องและชื่อของคุณ" });
    }

    // 1. ตรวจสอบความถูกต้องและคำหยาบคาย
    const validation = validatePlayerName(rawName);
    if (!validation.valid) {
      return callback({ success: false, message: validation.message });
    }

    let targetRoom = null;
    for (const [rId, r] of rooms.entries()) {
      if (r.code === code) {
        targetRoom = r;
        break;
      }
    }

    if (!targetRoom) {
      return callback({ success: false, message: "ไม่พบรหัสห้องนี้ในระบบ" });
    }

    if (targetRoom.status !== "LOBBY") {
      return callback({ success: false, message: "เกมนี้ได้เริ่มต้นไปแล้ว ไม่สามารถเข้าเพิ่มได้" });
    }

    // 2. ป้องกันชื่อซ้ำในห้องเดียวกัน
    if (isNameDuplicate(targetRoom, validation.cleanName)) {
      return callback({
        success: false,
        message: `ชื่อ "${validation.cleanName}" มีผู้อื่นใช้แล้วในห้องนี้ โปรดเพิ่มรหัสหรือชื่อเล่นเพื่อไม่ให้ซ้ำกัน`
      });
    }

    const playerId = generateId("ply");
    const playerToken = generateToken("ptk");

    const playerObj = {
      id: playerId,
      token: playerToken,
      name: validation.cleanName,
      cleanName: validation.cleanName,
      avatar: avatar,
      alive: true,
      score: 0,
      audienceScore: 0,
      socketId: socket.id,
      connected: true,
      lastSeen: Date.now()
    };

    targetRoom.players[playerId] = playerObj;
    socket.join(targetRoom.id);
    socket.roomId = targetRoom.id;
    socket.playerId = playerId;

    const playersList = Object.values(targetRoom.players).map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar || "spade",
      alive: p.alive,
      connected: p.connected
    }));

    // ส่งสัญญาณแจ้งเตือนทุกคนในห้องทันที
    io.to(targetRoom.id).emit("room:players-updated", {
      playerCount: playersList.length,
      players: playersList
    });

    callback({
      success: true,
      playerId: playerId,
      playerToken: playerToken, // ส่ง Token กลับให้มือถือบันทึกไว้กู้คืนเมื่อเน็ตหลุด
      roomId: targetRoom.id,
      roomCode: code,
      playerName: validation.cleanName,
      avatar: playerObj.avatar,
      playerCount: playersList.length,
      players: playersList
    });
  });

  // --- PLAYER: กู้คืนสถานะเมื่อเน็ตหลุดหรือรีเฟรชหน้าจอ (Auto-Reconnection) ---
  socket.on("player:resume-session", (data, callback) => {
    if (!data || !data.roomId || !data.playerId || !data.playerToken) {
      return callback({ success: false, message: "ข้อมูลเซสชันไม่ครบถ้วน" });
    }

    const room = rooms.get(data.roomId);
    if (!room) {
      return callback({ success: false, message: "ห้องเกมนี้ปิดไปแล้ว" });
    }

    const player = room.players[data.playerId];
    if (!player || player.token !== data.playerToken) {
      return callback({ success: false, message: "เซสชันไม่ถูกต้องหรือหมดอายุ" });
    }

    // ฟื้นคืนชีพการเชื่อมต่อ Socket ID ใหม่
    player.socketId = socket.id;
    player.connected = true;
    player.lastSeen = Date.now();
    socket.join(room.id);
    socket.roomId = room.id;
    socket.playerId = player.id;

    const submission = room.submissions[player.id];
    const remaining = room.status === "ANSWERING" 
      ? Math.max(0, Math.round((room.endTime - Date.now()) / 1000))
      : 0;

    const lastResult = room.roundResults.length > 0 ? room.roundResults[room.roundResults.length - 1] : null;

    const playersList = Object.values(room.players).map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar || "spade",
      alive: p.alive,
      connected: p.connected
    }));

    io.to(room.id).emit("room:players-updated", {
      playerCount: playersList.length,
      players: playersList
    });

    callback({
      success: true,
      roomId: room.id,
      roomCode: room.code,
      playerId: player.id,
      playerName: player.name,
      avatar: player.avatar,
      isAlive: player.alive,
      score: player.score,
      audienceScore: player.audienceScore || 0,
      roomStatus: room.status,
      currentRound: room.currentRound,
      maxRounds: room.maxRounds,
      question: room.question,
      remainingSeconds: remaining,
      roundDuration: room.roundDuration,
      hasAnswered: !!submission,
      selectedChoice: submission ? submission.choice : null,
      lastResult: lastResult,
      playerCount: playersList.length,
      players: playersList
    });
  });

  // --- HOST: สั่งเริ่มรอบใหม่ ---
  socket.on("host:start-round", (data, callback) => {
    const room = rooms.get(data.roomId);
    if (!room || room.hostToken !== data.hostToken) {
      return callback({ success: false, message: "สิทธิ์ไม่ถูกต้อง" });
    }

    if (room.timerInterval) clearInterval(room.timerInterval);

    // สุ่มคำถามที่ยังไม่เคยใช้
    let availableQuestions = room.questionPool.filter(q => !room.usedQuestions.includes(q.questionId));
    if (availableQuestions.length === 0) {
      room.usedQuestions = [];
      availableQuestions = room.questionPool;
    }
    const randomIndex = Math.floor(Math.random() * availableQuestions.length);
    const chosenQ = availableQuestions[randomIndex];
    room.usedQuestions.push(chosenQ.questionId);

    const duration = Number(data.duration) || 25;
    const now = Date.now();
    const endTime = now + (duration * 1000);

    room.currentRound += 1;
    room.status = "ANSWERING";
    room.question = chosenQ;
    room.roundDuration = duration;
    room.endTime = endTime;
    room.submissions = {};

    const aliveCount = Object.values(room.players).filter(p => p.alive).length;

    // ยิง Broadcast คำถามและเวลาพร้อมกันทุกเครื่องในเสี้ยววินาที!
    io.to(room.id).emit("game:round-started", {
      round: room.currentRound,
      maxRounds: room.maxRounds,
      question: chosenQ,
      duration: duration,
      endTime: endTime,
      totalAlive: aliveCount,
      answeredCount: 0
    });

    // เริ่มต้นตัวจับเวลาฝั่ง Server
    room.timerInterval = setInterval(() => {
      const remaining = Math.max(0, Math.round((room.endTime - Date.now()) / 1000));
      io.to(room.id).emit("game:timer-tick", { remainingSeconds: remaining });

      if (remaining <= 0) {
        clearInterval(room.timerInterval);
        room.timerInterval = null;
        calculateRoundResult(room);
      }
    }, 1000);

    callback({ success: true, round: room.currentRound, question: chosenQ });
  });

  // --- PLAYER: ส่งคำตอบ ---
  socket.on("player:submit-answer", (data, callback) => {
    const room = rooms.get(data.roomId);
    if (!room || room.status !== "ANSWERING") {
      return callback({ success: false, message: "ไม่อยู่ในเวลาส่งคำตอบ" });
    }

    const player = room.players[data.playerId];
    if (!player) return callback({ success: false, message: "ไม่พบผู้เล่น" });

    if (room.submissions[data.playerId]) {
      return callback({ success: false, message: "คุณส่งคำตอบไปแล้ว" });
    }

    const remainingSec = Math.max(0, Math.round((room.endTime - Date.now()) / 1000));

    room.submissions[data.playerId] = {
      choice: data.choice,
      timeLeft: remainingSec,
      isAudience: !player.alive // ถ้าตกรอบแล้ว บันทึกว่าเป็นการทายใจ (Audience)
    };

    // นับจำนวนคนที่ยังมีชีวิตและตอบแล้ว
    const alivePlayers = Object.values(room.players).filter(p => p.alive);
    const aliveAnsweredCount = alivePlayers.filter(p => room.submissions[p.id]).length;

    io.to(room.id).emit("game:answer-count-update", {
      answeredCount: aliveAnsweredCount,
      totalAlive: alivePlayers.length
    });

    callback({ success: true, choice: data.choice, timeLeft: remainingSec });

    // Early Auto-Calculate: ถ้าคนที่มีชีวิตอยู่ตอบครบทุกคนแล้ว จบรอบทันทีไม่ต้องรอหมดเวลา!
    if (aliveAnsweredCount >= alivePlayers.length && alivePlayers.length > 0) {
      if (room.timerInterval) {
        clearInterval(room.timerInterval);
        room.timerInterval = null;
      }
      setTimeout(() => {
        calculateRoundResult(room);
      }, 500);
    }
  });

  // --- HOST: สั่งจบรอบก่อนเวลา หรือ ข้ามข้อ ---
  socket.on("host:end-round-early", (data) => {
    const room = rooms.get(data.roomId);
    if (!room || room.hostToken !== data.hostToken) return;
    if (room.timerInterval) {
      clearInterval(room.timerInterval);
      room.timerInterval = null;
    }
    calculateRoundResult(room);
  });

  socket.on("host:skip-round", (data, callback) => {
    const room = rooms.get(data.roomId);
    if (!room || room.hostToken !== data.hostToken) return callback({ success: false });

    // สุ่มข้อใหม่ทันที
    const available = room.questionPool.filter(q => !room.usedQuestions.includes(q.questionId));
    const newQ = (available.length > 0 ? available : room.questionPool)[0];
    room.question = newQ;
    room.submissions = {};
    const now = Date.now();
    room.endTime = now + (room.roundDuration * 1000);

    const aliveCount = Object.values(room.players).filter(p => p.alive).length;
    io.to(room.id).emit("game:round-started", {
      round: room.currentRound,
      maxRounds: room.maxRounds,
      question: newQ,
      duration: room.roundDuration,
      endTime: room.endTime,
      totalAlive: aliveCount,
      answeredCount: 0
    });
    callback({ success: true, question: newQ });
  });

  // --- HOST: การจัดการคูลดาวน์พักช่วงเปลี่ยนข้อ (Sync Cooldown) ---
  socket.on("host:cooldown-start", (data) => {
    const room = rooms.get(data.roomId);
    if (!room || room.hostToken !== data.hostToken) return;
    io.to(room.id).emit("game:cooldown-start", {
      nextRound: data.nextRound,
      totalSeconds: data.totalSeconds,
      remainingSeconds: data.remainingSeconds || data.totalSeconds
    });
  });

  socket.on("host:cooldown-tick", (data) => {
    const room = rooms.get(data.roomId);
    if (!room || room.hostToken !== data.hostToken) return;
    io.to(room.id).emit("game:cooldown-tick", {
      remainingSeconds: data.remainingSeconds
    });
  });

  socket.on("host:cooldown-pause", (data) => {
    const room = rooms.get(data.roomId);
    if (!room || room.hostToken !== data.hostToken) return;
    io.to(room.id).emit("game:cooldown-pause", {
      paused: !!data.paused
    });
  });

  socket.on("host:cooldown-cancel", (data) => {
    const room = rooms.get(data.roomId);
    if (!room || room.hostToken !== data.hostToken) return;
    io.to(room.id).emit("game:cooldown-cancel");
  });

  // --- HOST: เตะผู้เล่น ---
  socket.on("host:kick-player", (data) => {
    const room = rooms.get(data.roomId);
    if (!room || room.hostToken !== data.hostToken) return;

    const p = room.players[data.playerId];
    if (p) {
      delete room.players[data.playerId];
      io.to(room.id).emit("player:kicked", { playerId: data.playerId, name: p.name });
      const list = Object.values(room.players).map(pl => ({ id: pl.id, name: pl.name, avatar: pl.avatar || "spade", alive: pl.alive, connected: pl.connected }));
      io.to(room.id).emit("room:players-updated", { playerCount: list.length, players: list });
    }
  });

  // --- HOST: รีเซ็ตเริ่มเกมใหม่ (Restart) ---
  socket.on("host:restart-game", (data, callback) => {
    const room = rooms.get(data.roomId);
    if (!room || room.hostToken !== data.hostToken) return callback({ success: false });

    if (room.timerInterval) clearInterval(room.timerInterval);
    room.status = "LOBBY";
    room.currentRound = 0;
    room.usedQuestions = [];
    room.submissions = {};
    room.roundResults = [];

    // ชุบชีวิตและรีเซ็ตคะแนนผู้เล่นทุกคน
    Object.values(room.players).forEach(p => {
      p.alive = true;
      p.score = 0;
      p.audienceScore = 0;
    });

    const list = Object.values(room.players).map(p => ({ id: p.id, name: p.name, avatar: p.avatar || "spade", alive: p.alive, connected: p.connected }));

    io.to(room.id).emit("game:restarted", {
      status: "LOBBY",
      playerCount: list.length,
      players: list
    });

    callback({ success: true, playerCount: list.length });
  });

  // --- PLAYER: ตัดการเชื่อมต่อ / เน็ตสะดุด (Graceful Disconnect with Reconnect Window) ---
  socket.on("disconnect", () => {
    if (socket.roomId && socket.playerId) {
      const room = rooms.get(socket.roomId);
      if (room) {
        const p = room.players[socket.playerId];
        if (p) {
          p.connected = false;
          p.lastSeen = Date.now();

          // หากอยู่ในห้อง Lobby ให้เวลารอ 30 วินาทีเผื่อผู้เรียนแค่สลับแอปหรือรีเฟรชหน้าจอ
          setTimeout(() => {
            if (!p.connected && room.status === "LOBBY" && room.players[socket.playerId]) {
              delete room.players[socket.playerId];
              const list = Object.values(room.players).map(pl => ({ id: pl.id, name: pl.name, avatar: pl.avatar || "spade", alive: pl.alive, connected: pl.connected }));
              io.to(room.id).emit("room:players-updated", { playerCount: list.length, players: list });
            }
          }, 30000);
        }
      }
    }
  });
});

// ==========================================
// 4. ฟังก์ชันคำนวณคะแนนและผล Majority (Core Logic)
// ==========================================
function calculateRoundResult(room) {
  if (room.status === "RESULT" || room.status === "GAME_OVER") return;

  const currentRound = room.currentRound;
  const submissions = room.submissions || {};

  // 1. นับคะแนนโหวตแต่ละข้อ (เฉพาะคนที่ยังมีสิทธิ์เล่นอยู่)
  const counts = { A: 0, B: 0, C: 0, D: 0 };
  const audienceCounts = { A: 0, B: 0, C: 0, D: 0 };

  Object.entries(submissions).forEach(([pId, sub]) => {
    const p = room.players[pId];
    if (p && p.alive && !sub.isAudience) {
      if (counts[sub.choice] !== undefined) counts[sub.choice]++;
    } else {
      if (audienceCounts[sub.choice] !== undefined) audienceCounts[sub.choice]++;
    }
  });

  // 2. หาเสียงส่วนใหญ่ (Majority)
  const maxVotes = Math.max(counts.A, counts.B, counts.C, counts.D);
  const majorityList = [];
  if (maxVotes > 0) {
    ["A", "B", "C", "D"].forEach(c => {
      if (counts[c] === maxVotes) majorityList.push(c);
    });
  }

  let eliminatedCount = 0;
  let survivingPlayers = [];
  const playerRoundBreakdowns = {};

  // 3. ตัดสินผลของผู้เล่นทุกคน
  Object.values(room.players).forEach(p => {
    const sub = submissions[p.id];
    let earnedBase = 0;
    let earnedSpeed = 0;
    let isSurvived = false;
    let audienceCorrect = false;

    if (p.alive) {
      if (sub && majorityList.includes(sub.choice)) {
        isSurvived = true;
        earnedBase = 1000;
        earnedSpeed = (sub.timeLeft || 0) * 10;
        p.score += earnedBase + earnedSpeed;
        survivingPlayers.push(p);
      } else {
        p.alive = false;
        eliminatedCount++;
      }
    } else {
      // โหมดผู้ชม (Audience/Spectator Mode): ถ้าทายถูก ได้แต้มหยั่งรู้
      if (sub && majorityList.includes(sub.choice)) {
        audienceCorrect = true;
        p.audienceScore = (p.audienceScore || 0) + 500;
      }
    }

    playerRoundBreakdowns[p.id] = {
      choice: sub ? sub.choice : null,
      survived: isSurvived,
      isAlive: p.alive,
      baseScore: earnedBase,
      speedScore: earnedSpeed,
      timeLeft: sub ? sub.timeLeft : 0,
      totalScore: p.score,
      audienceCorrect: audienceCorrect,
      audienceScore: p.audienceScore || 0
    };
  });

  // 4. ตัดสินสถานะถัดไป (RESULT หรือ GAME_OVER)
  let nextStatus = "RESULT";
  let winners = [];

  if (survivingPlayers.length === 1) {
    nextStatus = "GAME_OVER";
    winners = survivingPlayers;
  } else if (survivingPlayers.length === 0 || currentRound >= room.maxRounds) {
    nextStatus = "GAME_OVER";
    const pool = survivingPlayers.length > 0 ? survivingPlayers : Object.values(room.players);
    const maxScore = pool.length > 0 ? Math.max(...pool.map(p => p.score)) : 0;
    winners = pool.filter(p => p.score === maxScore);
  }

  const leaderboard = Object.values(room.players)
    .sort((a, b) => b.score - a.score)
    .map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar || "spade",
      score: p.score,
      alive: p.alive,
      audienceScore: p.audienceScore || 0
    }));

  room.status = nextStatus;

  const resultPayload = {
    round: currentRound,
    maxRounds: room.maxRounds,
    counts: counts,
    audienceCounts: audienceCounts,
    majority: majorityList,
    maxVotes: maxVotes,
    eliminatedCount: eliminatedCount,
    aliveCount: survivingPlayers.length,
    totalPlayers: Object.keys(room.players).length,
    isGameOver: (nextStatus === "GAME_OVER"),
    winners: winners.map(w => ({ id: w.id, name: w.name, score: w.score })),
    leaderboard: leaderboard
  };

  room.roundResults.push(resultPayload);

  // ส่งผลลัพธ์กระจายไปถึงทุกคนทันที!
  io.to(room.id).emit("game:round-result", {
    result: resultPayload,
    breakdowns: playerRoundBreakdowns
  });
}

// เริ่มต้นเซิร์ฟเวอร์
server.listen(PORT, "0.0.0.0", () => {
  console.log(`====================================================`);
  console.log(`🚀 คิดเหมือนรอด (Real-Time Socket.io Server) ทำงานแล้ว!`);
  console.log(`   - หน้าผู้เล่น:         http://localhost:${PORT}`);
  console.log(`   - หน้า Host Dashboard: http://localhost:${PORT}/?page=host`);
  console.log(`   - รหัส Host PIN:       ${DEFAULT_HOST_PIN}`);
  console.log(`====================================================`);
});
