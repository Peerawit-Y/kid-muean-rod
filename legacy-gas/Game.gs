/**
 * Game.gs (High Concurrency & Optimization)
 */

const ROUND_DURATION_SECONDS = 25;

function startRound(roomId, hostToken, customDuration) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const cleanRoomId = String(roomId).trim();
    const cache = CacheService.getScriptCache();
    
    // ดึงข้อมูลห้องจาก Cache
    const roomJson = cache.get("room_id_" + cleanRoomId);
    let roomData = roomJson ? JSON.parse(roomJson) : null;
    if (roomData && roomData.hostToken !== hostToken) {
      return { success: false, message: "Host Token ไม่ถูกต้อง" };
    }

    const nextRound = (roomData ? roomData.currentRound : 0) + 1;
    const question = getRandomQuestion(cleanRoomId);
    if (!question) return { success: false, message: "ไม่มีคำถามในระบบ" };

    const roundDuration = Number(customDuration) || ROUND_DURATION_SECONDS;
    const now = new Date().getTime();
    const endTime = now + (roundDuration * 1000);
    const maxRounds = Number(cache.get("max_rounds_" + cleanRoomId)) || 5;

    // อัปเดตสถานะห้องใน Cache
    if (roomData) {
      roomData.currentRound = nextRound;
      roomData.status = CONFIG.GAME_STATES.ANSWERING;
      cache.put("room_id_" + cleanRoomId, JSON.stringify(roomData), CONFIG.CACHE_TTL_SECONDS);
    }

    const gameState = {
      roomId: cleanRoomId,
      round: nextRound,
      maxRounds: maxRounds,
      status: CONFIG.GAME_STATES.ANSWERING,
      question: question,
      endTime: endTime,
      duration: roundDuration
    };

    cache.put("gamestate_" + cleanRoomId, JSON.stringify(gameState), CONFIG.CACHE_TTL_SECONDS);
    // รีเซ็ตรายชื่อคนตอบรอบใหม่ใน Cache
    cache.put("submissions_" + cleanRoomId + "_" + nextRound, JSON.stringify({}), CONFIG.CACHE_TTL_SECONDS);

    return {
      success: true,
      round: nextRound,
      maxRounds: maxRounds,
      question: question,
      endTime: endTime
    };
  } catch (err) {
    return { success: false, message: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

function getGameState(roomId, playerId) {
  try {
    const cleanRoomId = String(roomId).trim();
    const cache = CacheService.getScriptCache();
    let stateJson = cache.get("gamestate_" + cleanRoomId);

    // Fallback: หากยังไม่มี GameState (เช่น อยู่ใน LOBBY หรือเพิ่งสร้างห้อง) ให้สร้าง LOBBY state อัตโนมัติ
    if (!stateJson) {
      let roomData = null;
      const roomJson = cache.get("room_id_" + cleanRoomId);
      if (roomJson) {
        try { roomData = JSON.parse(roomJson); } catch (e) {}
      }

      if (!roomData) {
        const ss = getSpreadsheet();
        const roomSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ROOMS);
        const rVals = roomSheet.getDataRange().getValues();
        for (let i = 1; i < rVals.length; i++) {
          if (String(rVals[i][0]).trim() === cleanRoomId) {
            roomData = {
              roomId: cleanRoomId,
              roomCode: String(rVals[i][1]).trim(),
              status: rVals[i][2] || CONFIG.GAME_STATES.LOBBY,
              currentRound: Number(rVals[i][3]) || 0
            };
            break;
          }
        }
      }

      if (!roomData) {
        return { success: false, message: "ไม่พบสถานะเกมหรือห้องนี้" };
      }

      const maxRounds = Number(cache.get("max_rounds_" + cleanRoomId)) || 5;
      const defaultState = {
        roomId: cleanRoomId,
        round: roomData.currentRound || 0,
        maxRounds: maxRounds,
        status: roomData.status || CONFIG.GAME_STATES.LOBBY,
        question: null,
        endTime: 0,
        duration: ROUND_DURATION_SECONDS
      };
      cache.put("gamestate_" + cleanRoomId, JSON.stringify(defaultState), CONFIG.CACHE_TTL_SECONDS);
      stateJson = JSON.stringify(defaultState);
    }

    const state = JSON.parse(stateJson);
    let hasAnswered = false;
    let selectedAnswer = null;
    let myTimeLeft = 0;
    let isAlive = true;
    let myRoundStats = null;

    // ดึงรายการคำตอบจาก Cache ก้อนเดียว (เร็วมาก ไม่แตะ Sheets)
    const subsRaw = cache.get("submissions_" + cleanRoomId + "_" + state.round);
    const submissions = subsRaw ? JSON.parse(subsRaw) : {};

    if (playerId) {
      const cleanPlayerId = String(playerId).trim();
      if (submissions[cleanPlayerId]) {
        hasAnswered = true;
        selectedAnswer = submissions[cleanPlayerId].choice;
        myTimeLeft = submissions[cleanPlayerId].timeLeft || 0;
      }

      const aliveStatus = cache.get("alive_" + cleanPlayerId);
      if (aliveStatus !== null) {
        isAlive = (aliveStatus === "true");
      }

      const statsJson = cache.get("score_breakdown_" + cleanRoomId + "_" + state.round + "_" + cleanPlayerId);
      if (statsJson) {
        myRoundStats = JSON.parse(statsJson);
      }
    }

    // ดึงจำนวนผู้เล่นจาก Lobby Cache พร้อม Fallback จากชีต Players ป้องกันตัวเลข 0 หรือหาย
    let lobbyRaw = cache.get("lobby_players_" + cleanRoomId);
    let lobbyPlayers = [];
    if (lobbyRaw) {
      try { lobbyPlayers = JSON.parse(lobbyRaw); } catch(e) {}
    }
    if (!lobbyPlayers || lobbyPlayers.length === 0) {
      const ss = getSpreadsheet();
      const pSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.PLAYERS);
      if (pSheet) {
        const pVals = pSheet.getDataRange().getValues();
        lobbyPlayers = [];
        for (let j = 1; j < pVals.length; j++) {
          if (String(pVals[j][1]).trim() === cleanRoomId) {
            lobbyPlayers.push({
              id: String(pVals[j][0]).trim(),
              name: String(pVals[j][2]).trim(),
              alive: (pVals[j][3] === true || String(pVals[j][3]).toLowerCase() === "true")
            });
          }
        }
        if (lobbyPlayers.length > 0) {
          cache.put("lobby_players_" + cleanRoomId, JSON.stringify(lobbyPlayers), CONFIG.CACHE_TTL_SECONDS);
        }
      }
    }

    // คำนวณจำนวนคนที่ยังมีสิทธิ์เล่น
    let totalAliveInRoom = 0;
    if (state.status === CONFIG.GAME_STATES.LOBBY) {
      totalAliveInRoom = lobbyPlayers.length;
    } else {
      lobbyPlayers.forEach(p => {
        if (p.alive !== false) totalAliveInRoom++;
      });
    }

    const answeredCountInRoom = Object.keys(submissions).length;
    const now = new Date().getTime();
    const remainingSeconds = Math.max(0, Math.round((state.endTime - now) / 1000));
    const isAllAnswered = (totalAliveInRoom > 0 && answeredCountInRoom >= totalAliveInRoom);

    let roundResult = null;
    let leaderboard = null;
    if (state.status === CONFIG.GAME_STATES.RESULT || state.status === CONFIG.GAME_STATES.GAME_OVER) {
      const resJson = cache.get("result_" + cleanRoomId + "_" + state.round);
      if (resJson) roundResult = JSON.parse(resJson);
      const lbJson = cache.get("leaderboard_" + cleanRoomId);
      if (lbJson) leaderboard = JSON.parse(lbJson);
    }

    return {
      success: true,
      status: state.status,
      round: state.round,
      maxRounds: state.maxRounds,
      question: state.question,
      remainingSeconds: remainingSeconds,
      hasAnswered: hasAnswered,
      selectedAnswer: selectedAnswer,
      myTimeLeft: myTimeLeft,
      myRoundStats: myRoundStats,
      isAlive: isAlive,
      result: roundResult,
      leaderboard: leaderboard,
      answeredCount: answeredCountInRoom,
      totalAlive: totalAliveInRoom,
      playerCount: lobbyPlayers.length,
      players: lobbyPlayers,
      isAllAnswered: isAllAnswered
    };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

function submitAnswer(roomId, playerId, round, answer) {
  if (!["A", "B", "C", "D"].includes(answer)) {
    return { success: false, message: "ตัวเลือกไม่ถูกต้อง" };
  }

  const cleanRoomId = String(roomId).trim();
  const cleanPlayerId = String(playerId).trim();
  const lock = LockService.getScriptLock();
  
  try {
    // ใช้ Lock สั้นๆ แค่ 2 วินาทีเพื่อแย่งกันเขียน Cache
    lock.waitLock(3000);
    const cache = CacheService.getScriptCache();
    const key = "submissions_" + cleanRoomId + "_" + round;
    
    let submissions = {};
    const raw = cache.get(key);
    if (raw) submissions = JSON.parse(raw);

    if (submissions[cleanPlayerId]) {
      return { success: false, message: "คุณส่งคำตอบไปแล้ว" };
    }

    const stateJson = cache.get("gamestate_" + cleanRoomId);
    let timeLeftBonus = 0;
    if (stateJson) {
      const state = JSON.parse(stateJson);
      const now = new Date().getTime();
      timeLeftBonus = Math.max(0, Math.round((state.endTime - now) / 1000));
    }

    submissions[cleanPlayerId] = {
      choice: answer,
      timeLeft: timeLeftBonus
    };

    cache.put(key, JSON.stringify(submissions), CONFIG.CACHE_TTL_SECONDS);
    return { success: true, answer: answer, timeLeft: timeLeftBonus };
  } catch (err) {
    return { success: false, message: "ระบบกำลังรับคำตอบพร้อมกัน กรุณากดใหม่อีกครั้ง" };
  } finally {
    lock.releaseLock();
  }
}

function autoEndRoundAndCalculate(roomId, hostToken) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(12000);
    const cleanRoomId = String(roomId).trim();
    const cache = CacheService.getScriptCache();
    const stateJson = cache.get("gamestate_" + cleanRoomId);
    if (!stateJson) return { success: false, message: "ไม่พบสถานะรอบ" };

    const state = JSON.parse(stateJson);
    if (state.status === CONFIG.GAME_STATES.RESULT || state.status === CONFIG.GAME_STATES.GAME_OVER) {
      return { success: true }; // ป้องกันประมวลผลซ้ำ
    }

    const currentRound = state.round;
    const maxRounds = state.maxRounds || 5;

    // ดึงคำตอบทั้งหมดจาก Cache ก้อนเดียว
    const subsRaw = cache.get("submissions_" + cleanRoomId + "_" + currentRound);
    const playerSubmissions = subsRaw ? JSON.parse(subsRaw) : {};

    const counts = { A: 0, B: 0, C: 0, D: 0 };
    Object.keys(playerSubmissions).forEach(pId => {
      const c = playerSubmissions[pId].choice;
      if (counts[c] !== undefined) counts[c]++;
    });

    const maxVotes = Math.max(counts.A, counts.B, counts.C, counts.D);
    const majorityList = [];
    if (maxVotes > 0) {
      ["A", "B", "C", "D"].forEach(choice => {
        if (counts[choice] === maxVotes) majorityList.push(choice);
      });
    }

    // อ่านและอัปเดตชีต Players ครั้งเดียวจบ
    const ss = getSpreadsheet();
    const playerSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.PLAYERS);
    const playerRange = playerSheet.getDataRange();
    const playerData = playerRange.getValues();

    let eliminatedCount = 0;
    let survivingPlayers = [];
    const leaderboardList = [];
    const answersBatch = [];
    const now = new Date().toISOString();

    for (let i = 1; i < playerData.length; i++) {
      const pId = String(playerData[i][0]).trim();
      const rId = String(playerData[i][1]).trim();
      const pName = String(playerData[i][2]).trim();
      let isAlive = playerData[i][3];
      let score = Number(playerData[i][4]) || 0;

      if (rId === cleanRoomId) {
        const sub = playerSubmissions[pId] || null;
        if (sub) {
          answersBatch.push([generateId("ans"), cleanRoomId, currentRound, pId, sub.choice, now, true]);
        }

        let earnedSpeed = 0;
        let earnedBase = 0;
        let isSurvived = false;

        if (isAlive === true || String(isAlive).toLowerCase() === "true") {
          if (sub && majorityList.includes(sub.choice)) {
            isSurvived = true;
            earnedBase = 1000;
            earnedSpeed = (sub.timeLeft || 0) * 10;
            score += earnedBase + earnedSpeed;
            survivingPlayers.push({ id: pId, name: pName, score: score });
            cache.put("alive_" + pId, "true", CONFIG.CACHE_TTL_SECONDS);
          } else {
            isAlive = false;
            eliminatedCount++;
            cache.put("alive_" + pId, "false", CONFIG.CACHE_TTL_SECONDS);
          }
        }

        cache.put("score_breakdown_" + cleanRoomId + "_" + currentRound + "_" + pId, JSON.stringify({
          survived: isSurvived,
          baseScore: earnedBase,
          speedScore: earnedSpeed,
          timeLeft: sub ? sub.timeLeft : 0,
          totalScore: score
        }), CONFIG.CACHE_TTL_SECONDS);

        playerData[i][3] = isAlive;
        playerData[i][4] = score;
        leaderboardList.push({ id: pId, name: pName, score: score, alive: isAlive });
      }
    }

    if (playerData.length > 1) {
      playerRange.setValues(playerData);
      SpreadsheetApp.flush();
    }

    // ซิงก์สถานะผู้เล่นลง lobby_players_ ใน Cache ด้วยสถานะ alive ล่าสุด
    const updatedLobby = [];
    for (let i = 1; i < playerData.length; i++) {
      if (String(playerData[i][1]).trim() === cleanRoomId) {
        updatedLobby.push({
          id: String(playerData[i][0]).trim(),
          name: String(playerData[i][2]).trim(),
          alive: (playerData[i][3] === true || String(playerData[i][3]).toLowerCase() === "true")
        });
      }
    }
    cache.put("lobby_players_" + cleanRoomId, JSON.stringify(updatedLobby), CONFIG.CACHE_TTL_SECONDS);

    if (answersBatch.length > 0) {
      const ansSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ANSWERS);
      ansSheet.getRange(ansSheet.getLastRow() + 1, 1, answersBatch.length, answersBatch[0].length).setValues(answersBatch);
      SpreadsheetApp.flush();
    }

    const majorityStr = majorityList.length > 0 ? majorityList.join(",") : "NONE";
    const resultSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.RESULTS);
    resultSheet.appendRow([cleanRoomId, currentRound, counts.A, counts.B, counts.C, counts.D, majorityStr, eliminatedCount, now]);
    SpreadsheetApp.flush();

    let nextStatus = CONFIG.GAME_STATES.RESULT;
    let winners = [];

    if (survivingPlayers.length === 1) {
      nextStatus = CONFIG.GAME_STATES.GAME_OVER;
      winners = survivingPlayers;
    } else if (survivingPlayers.length === 0 || currentRound >= maxRounds) {
      nextStatus = CONFIG.GAME_STATES.GAME_OVER;
      const pool = survivingPlayers.length > 0 ? survivingPlayers : leaderboardList;
      const maxScore = pool.length > 0 ? Math.max.apply(Math, pool.map(p => p.score)) : 0;
      winners = pool.filter(p => p.score === maxScore);
    }

    leaderboardList.sort((a, b) => b.score - a.score);
    cache.put("leaderboard_" + cleanRoomId, JSON.stringify(leaderboardList), CONFIG.CACHE_TTL_SECONDS);

    state.status = nextStatus;
    cache.put("gamestate_" + cleanRoomId, JSON.stringify(state), CONFIG.CACHE_TTL_SECONDS);

    const resultPayload = {
      round: currentRound,
      maxRounds: maxRounds,
      counts: counts,
      majority: majorityList,
      maxVotes: maxVotes,
      eliminatedCount: eliminatedCount,
      aliveCount: survivingPlayers.length,
      isGameOver: (nextStatus === CONFIG.GAME_STATES.GAME_OVER),
      winners: winners
    };

    cache.put("result_" + cleanRoomId + "_" + currentRound, JSON.stringify(resultPayload), CONFIG.CACHE_TTL_SECONDS);

    return { success: true, result: resultPayload, leaderboard: leaderboardList };
  } catch (err) {
    return { success: false, message: "Calculation Error: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

function restartGame(roomId, hostToken) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const cleanRoomId = String(roomId).trim();
    const cache = CacheService.getScriptCache();
    
    const roomJson = cache.get("room_id_" + cleanRoomId);
    let roomData = roomJson ? JSON.parse(roomJson) : null;
    if (roomData && roomData.hostToken !== hostToken) {
      return { success: false, message: "สิทธิ์ไม่ถูกต้อง" };
    }

    const ss = getSpreadsheet();

    // 1. ล้างประวัติคำถามที่เคยสุ่มไปแล้วในห้องนี้
    cache.remove("used_q_" + cleanRoomId);

    // 2. ดึงผู้เล่นทั้งหมดในห้องนี้ และรีเซ็ตคะแนน + alive = true
    const playerSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.PLAYERS);
    const playerRange = playerSheet.getDataRange();
    const playerData = playerRange.getValues();
    const refreshedLobby = [];

    for (let i = 1; i < playerData.length; i++) {
      if (String(playerData[i][1]).trim() === cleanRoomId) {
        playerData[i][3] = true; // alive
        playerData[i][4] = 0;    // score
        const pId = String(playerData[i][0]).trim();
        const pName = String(playerData[i][2]).trim();
        refreshedLobby.push({ id: pId, name: pName, alive: true });
        cache.put("alive_" + pId, "true", CONFIG.CACHE_TTL_SECONDS);
      }
    }

    if (playerData.length > 1) {
      playerRange.setValues(playerData);
      SpreadsheetApp.flush();
    }

    // 3. รีเซ็ต Lobby Players Cache
    cache.put("lobby_players_" + cleanRoomId, JSON.stringify(refreshedLobby), CONFIG.CACHE_TTL_SECONDS);
    cache.remove("leaderboard_" + cleanRoomId);

    // 4. รีเซ็ตสถานะห้องกลับสู่ LOBBY
    const maxRounds = Number(cache.get("max_rounds_" + cleanRoomId)) || 5;
    if (roomData) {
      roomData.status = CONFIG.GAME_STATES.LOBBY;
      roomData.currentRound = 0;
      cache.put("room_id_" + cleanRoomId, JSON.stringify(roomData), CONFIG.CACHE_TTL_SECONDS);
      if (roomData.roomCode) {
        cache.put("room_" + roomData.roomCode, JSON.stringify(roomData), CONFIG.CACHE_TTL_SECONDS);
      }
    }

    const initialGameState = {
      roomId: cleanRoomId,
      round: 0,
      maxRounds: maxRounds,
      status: CONFIG.GAME_STATES.LOBBY,
      question: null,
      endTime: 0,
      duration: ROUND_DURATION_SECONDS
    };
    cache.put("gamestate_" + cleanRoomId, JSON.stringify(initialGameState), CONFIG.CACHE_TTL_SECONDS);

    // 5. อัปเดตชีต Rooms
    const roomSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ROOMS);
    const roomVals = roomSheet.getDataRange().getValues();
    for (let i = 1; i < roomVals.length; i++) {
      if (String(roomVals[i][0]).trim() === cleanRoomId) {
        roomVals[i][2] = CONFIG.GAME_STATES.LOBBY;
        roomVals[i][3] = 0;
        roomSheet.getRange(i + 1, 1, 1, roomVals[i].length).setValues([roomVals[i]]);
        SpreadsheetApp.flush();
        break;
      }
    }

    return { success: true, message: "รีเซ็ตห้องเรียบร้อย พร้อมเริ่มเกมใหม่", playerCount: refreshedLobby.length };
  } catch (err) {
    return { success: false, message: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Host: สั่งเตะผู้เล่นออกจากห้อง
 */
function kickPlayer(roomId, hostToken, playerId) {
  const cleanRoomId = String(roomId).trim();
  const cleanPlayerId = String(playerId).trim();
  const cache = CacheService.getScriptCache();
  
  const roomJson = cache.get("room_id_" + cleanRoomId);
  const roomData = roomJson ? JSON.parse(roomJson) : null;
  if (roomData && roomData.hostToken !== hostToken) return { success: false };

  // ลบออกจาก Lobby Cache
  const lobbyRaw = cache.get("lobby_players_" + cleanRoomId);
  if (lobbyRaw) {
    let lobbyList = JSON.parse(lobbyRaw);
    lobbyList = lobbyList.filter(p => p.id !== cleanPlayerId);
    cache.put("lobby_players_" + cleanRoomId, JSON.stringify(lobbyList), CONFIG.CACHE_TTL_SECONDS);
  }

  // ปรับสถานะเป็น dead
  cache.put("alive_" + cleanPlayerId, "false", CONFIG.CACHE_TTL_SECONDS);

  // ปรับสถานะใน Sheet Players ด้วย
  try {
    const ss = getSpreadsheet();
    const pSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.PLAYERS);
    const pRange = pSheet.getDataRange();
    const pVals = pRange.getValues();
    for (let i = 1; i < pVals.length; i++) {
      if (String(pVals[i][0]).trim() === cleanPlayerId) {
        pVals[i][3] = false;
        pRange.setValues(pVals);
        SpreadsheetApp.flush();
        break;
      }
    }
  } catch(e) {}

  return { success: true };
}

/**
 * Host: ข้ามคำถามปัจจุบันและสุ่มใหม่ทันที
 */
function skipCurrentRound(roomId, hostToken) {
  const cleanRoomId = String(roomId).trim();
  const cache = CacheService.getScriptCache();
  
  const stateJson = cache.get("gamestate_" + cleanRoomId);
  if (!stateJson) return { success: false };
  const state = JSON.parse(stateJson);

  // สุ่มคำถามใหม่
  const newQ = getRandomQuestion(cleanRoomId);
  state.question = newQ;
  const now = new Date().getTime();
  state.endTime = now + ((state.duration || 25) * 1000);

  cache.put("gamestate_" + cleanRoomId, JSON.stringify(state), CONFIG.CACHE_TTL_SECONDS);
  cache.put("submissions_" + cleanRoomId + "_" + state.round, JSON.stringify({}), CONFIG.CACHE_TTL_SECONDS);
  return { success: true };
}