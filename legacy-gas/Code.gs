/**
 * Code.gs
 */

function doGet(e) {
  const page = (e && e.parameter && e.parameter.page) ? e.parameter.page : "player";
  
  if (page === "host") {
    return HtmlService.createTemplateFromFile("host")
      .evaluate()
      .setTitle("คิดเหมือนรอด - Host Dashboard")
      .addMetaTag("viewport", "width=device-width, initial-scale=1, maximum-scale=1")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return HtmlService.createTemplateFromFile("index")
    .evaluate()
    .setTitle("คิดเหมือนรอด — คุณจะรอด... ถ้าคิดเหมือนคนส่วนใหญ่")
    .addMetaTag("viewport", "width=device-width, initial-scale=1, maximum-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Host: สร้างห้องใหม่
 */
function createRoom(maxPlayers, maxRounds) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = getSpreadsheet();
    const roomSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ROOMS);

    const roomId = generateId("rm");
    const roomCode = generateRoomCode();
    const hostToken = generateId("hst");
    const now = new Date().toISOString();
    const limit = Number(maxPlayers) || 100;
    const targetRounds = Number(maxRounds) || 5;

    roomSheet.appendRow([
      roomId,
      roomCode,
      CONFIG.GAME_STATES.LOBBY,
      0,
      limit,
      now,
      hostToken
    ]);
    SpreadsheetApp.flush();

    const cache = CacheService.getScriptCache();
    const roomData = {
      roomId: roomId,
      roomCode: roomCode,
      status: CONFIG.GAME_STATES.LOBBY,
      currentRound: 0,
      maxRounds: targetRounds,
      hostToken: hostToken
    };
    cache.put("room_" + roomCode, JSON.stringify(roomData), CONFIG.CACHE_TTL_SECONDS);
    cache.put("room_id_" + roomId, JSON.stringify(roomData), CONFIG.CACHE_TTL_SECONDS);
    cache.put("max_rounds_" + roomId, String(targetRounds), CONFIG.CACHE_TTL_SECONDS);
    cache.put("lobby_players_" + roomId, JSON.stringify([]), CONFIG.CACHE_TTL_SECONDS);

    // สร้าง GameState เริ่มต้นให้อยู่ในสถานะ LOBBY ทันที เพื่อให้ผู้เล่นและ Host Polling ได้ข้อมูลถูกต้อง
    const initialGameState = {
      roomId: roomId,
      round: 0,
      maxRounds: targetRounds,
      status: CONFIG.GAME_STATES.LOBBY,
      question: null,
      endTime: 0,
      duration: 25
    };
    cache.put("gamestate_" + roomId, JSON.stringify(initialGameState), CONFIG.CACHE_TTL_SECONDS);

    return {
      success: true,
      roomId: roomId,
      roomCode: roomCode,
      maxRounds: targetRounds,
      hostToken: hostToken
    };
  } catch (err) {
    return { success: false, message: "สร้างห้องไม่สำเร็จ: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Player: เข้าร่วมห้อง + Profile Avatar
 */
function joinRoom(roomCode, playerName, avatar) {
  if (!roomCode || !playerName) {
    return { success: false, message: "กรุณาระบุรหัสห้องและชื่อของคุณ" };
  }
  const cleanCode = roomCode.trim().toUpperCase();
  const cleanName = playerName.trim().slice(0, 15);
  const userAvatar = avatar || "😀";

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = getSpreadsheet();
    const roomSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ROOMS);
    const playerSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.PLAYERS);
    const cache = CacheService.getScriptCache();

    // ค้นหาห้องจาก Fast Cache ก่อน หากไม่พบจึงค้นหาจาก Sheet
    let targetRoom = null;
    const roomCached = cache.get("room_" + cleanCode);
    if (roomCached) {
      try { targetRoom = JSON.parse(roomCached); } catch(e){}
    }

    if (!targetRoom) {
      const roomData = roomSheet.getDataRange().getValues();
      for (let i = 1; i < roomData.length; i++) {
        if (String(roomData[i][1]).trim().toUpperCase() === cleanCode) {
          targetRoom = {
            roomId: String(roomData[i][0]).trim(),
            roomCode: String(roomData[i][1]).trim(),
            status: roomData[i][2],
            currentRound: roomData[i][3],
            maxPlayers: roomData[i][4]
          };
          break;
        }
      }
    }

    if (!targetRoom) {
      return { success: false, message: "ไม่พบรหัสห้องนี้ในระบบ" };
    }

    if (targetRoom.status !== CONFIG.GAME_STATES.LOBBY) {
      return { success: false, message: "เกมนี้ได้เริ่มต้นไปแล้ว" };
    }

    const playerId = generateId("ply");
    const now = new Date().toISOString();

    // บันทึกลงชีต Players (เพิ่ม Avatar ใน column name เป็น "😀 ชื่อ")
    const displayName = userAvatar + " " + cleanName;
    playerSheet.appendRow([
      playerId,
      targetRoom.roomId,
      displayName,
      true, // alive
      0,    // score
      now,
      now
    ]);
    SpreadsheetApp.flush();

    // บันทึกสถานะผู้เล่นลง Fast Cache
    cache.put("alive_" + playerId, "true", CONFIG.CACHE_TTL_SECONDS);

    const cacheKey = "lobby_players_" + targetRoom.roomId;
    let cachedPlayers = [];
    const raw = cache.get(cacheKey);
    if (raw) {
      try { cachedPlayers = JSON.parse(raw); } catch(e){}
    }

    // กรณี Cache Miss หรือหลุดหาย ให้กู้คืนรายชื่อจากชีต Players เพื่อป้องกันผู้เล่นคนอื่นหาย
    if (!cachedPlayers || cachedPlayers.length === 0) {
      const pVals = playerSheet.getDataRange().getValues();
      cachedPlayers = [];
      for (let j = 1; j < pVals.length; j++) {
        if (String(pVals[j][1]).trim() === targetRoom.roomId) {
          cachedPlayers.push({
            id: String(pVals[j][0]).trim(),
            name: String(pVals[j][2]).trim(),
            alive: (pVals[j][3] === true || String(pVals[j][3]).toLowerCase() === "true")
          });
        }
      }
    } else {
      const exists = cachedPlayers.some(p => p.id === playerId);
      if (!exists) {
        cachedPlayers.push({
          id: playerId,
          name: displayName,
          alive: true
        });
      }
    }

    cache.put(cacheKey, JSON.stringify(cachedPlayers), CONFIG.CACHE_TTL_SECONDS);

    return {
      success: true,
      playerId: playerId,
      roomId: targetRoom.roomId,
      roomCode: cleanCode,
      playerName: displayName,
      playerCount: cachedPlayers.length,
      players: cachedPlayers
    };
  } catch (err) {
    return { success: false, message: "เกิดข้อผิดพลาด: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * ดึงสถานะ Lobby แบบ Fast Cache พร้อม Fallback
 */
function getLobbyState(roomId) {
  if (!roomId) return { success: false, playerCount: 0, players: [] };
  try {
    const cleanRoomId = String(roomId).trim();
    const cache = CacheService.getScriptCache();

    // 1. อ่านจาก Fast Cache ก่อน
    const cacheKey = "lobby_players_" + cleanRoomId;
    const raw = cache.get(cacheKey);
    if (raw) {
      const pList = JSON.parse(raw);
      if (Array.isArray(pList) && pList.length > 0) {
        return {
          success: true,
          status: CONFIG.GAME_STATES.LOBBY,
          playerCount: pList.length,
          players: pList
        };
      }
    }

    // 2. Fallback อ่านจาก Sheet Players
    const ss = getSpreadsheet();
    const playerSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.PLAYERS);
    const players = playerSheet.getDataRange().getValues();
    const roomPlayers = [];

    for (let j = 1; j < players.length; j++) {
      if (String(players[j][1]).trim() === cleanRoomId) {
        roomPlayers.push({
          id: String(players[j][0]).trim(),
          name: String(players[j][2]).trim(),
          alive: (players[j][3] === true || String(players[j][3]).toLowerCase() === "true")
        });
      }
    }

    cache.put(cacheKey, JSON.stringify(roomPlayers), CONFIG.CACHE_TTL_SECONDS);

    return {
      success: true,
      status: CONFIG.GAME_STATES.LOBBY,
      playerCount: roomPlayers.length,
      players: roomPlayers
    };
  } catch (err) {
    return { success: false, playerCount: 0, players: [] };
  }
}

/**
 * Player: สั่งออกจากห้อง
 */
function leaveRoom(roomId, playerId) {
  if (!roomId || !playerId) return { success: false };
  try {
    const cleanRoomId = String(roomId).trim();
    const cleanPlayerId = String(playerId).trim();
    const cache = CacheService.getScriptCache();
    const cacheKey = "lobby_players_" + cleanRoomId;
    const raw = cache.get(cacheKey);
    if (raw) {
      let players = JSON.parse(raw);
      players = players.filter(p => p.id !== cleanPlayerId);
      cache.put(cacheKey, JSON.stringify(players), CONFIG.CACHE_TTL_SECONDS);
    }
    return { success: true };
  } catch(e) {
    return { success: false, message: e.toString() };
  }
}