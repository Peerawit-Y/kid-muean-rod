/**
 * Config.gs
 * จัดเก็บการตั้งค่าส่วนกลางของระบบ
 */
const CONFIG = {
  // หากใช้ Standalone Script ให้ระบุ SPREADSHEET_ID ที่นี่
  // หากเป็น Container-bound script ผูกกับชีต ให้ปล่อยว่างไว้ ""
  SPREADSHEET_ID: "", 
  
  SHEET_NAMES: {
    ROOMS: "Rooms",
    PLAYERS: "Players",
    QUESTIONS: "Questions",
    ANSWERS: "Answers",
    RESULTS: "Results"
  },

  GAME_STATES: {
    LOBBY: "LOBBY",
    QUESTION: "QUESTION",
    ANSWERING: "ANSWERING",
    TIME_UP: "TIME_UP",
    CALCULATING: "CALCULATING",
    RESULT: "RESULT",
    GAME_OVER: "GAME_OVER"
  },

  ROOM_CODE_LENGTH: 5,
  MAX_PLAYERS_DEFAULT: 100,
  CACHE_TTL_SECONDS: 21600 // 6 ชั่วโมง
};

/**
 * Utility สร้างรหัสห้องสุ่ม A-Z, 0-9
 */
function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // ตัดตัวสับสน O, 0, 1, I ออก
  let result = "";
  for (let i = 0; i < CONFIG.ROOM_CODE_LENGTH; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Utility สร้าง ID สุ่มทั่วไป
 */
function generateId(prefix) {
  return (prefix || "id") + "_" + Utilities.getUuid().slice(0, 8);
}