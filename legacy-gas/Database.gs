/**
 * Database.gs
 * จัดการ I/O ของ Google Sheets
 */

function getSpreadsheet() {
  if (CONFIG.SPREADSHEET_ID && CONFIG.SPREADSHEET_ID !== "") {
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * สร้างหรือเตรียมความพร้อมชีตทั้งหมด 5 แผ่นเมื่อเริ่มใช้งานครั้งแรก
 * ให้รันฟังก์ชันนี้ 1 ครั้งใน Apps Script Editor
 */
function setupInitialDatabase() {
  const ss = getSpreadsheet();
  const sheets = [
    {
      name: CONFIG.SHEET_NAMES.ROOMS,
      headers: ["room_id", "room_code", "status", "current_round", "max_players", "created_at", "host_id"]
    },
    {
      name: CONFIG.SHEET_NAMES.PLAYERS,
      headers: ["player_id", "room_id", "name", "alive", "score", "joined_at", "last_seen"]
    },
    {
      name: CONFIG.SHEET_NAMES.QUESTIONS,
      headers: ["question_id", "question", "option_a", "option_b", "option_c", "option_d", "category", "difficulty", "active"]
    },
    {
      name: CONFIG.SHEET_NAMES.ANSWERS,
      headers: ["answer_id", "room_id", "round", "player_id", "answer", "answered_at", "valid"]
    },
    {
      name: CONFIG.SHEET_NAMES.RESULTS,
      headers: ["room_id", "round", "option_a_count", "option_b_count", "option_c_count", "option_d_count", "majority", "eliminated_count", "created_at"]
    }
  ];

  sheets.forEach(function(s) {
    let sheet = ss.getSheetByName(s.name);
    if (!sheet) {
      sheet = ss.insertSheet(s.name);
      sheet.appendRow(s.headers);
      sheet.setFrozenRows(1);
    }
  });

  // ใส่คำถามตัวอย่างลงในชีต Questions ถ้ายังไม่มีข้อมูล
  const qSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.QUESTIONS);
  if (qSheet.getLastRow() <= 1) {
    qSheet.appendRow(["q_1", "ถ้ามีเงิน 1 ล้านบาท คุณจะเลือกทำอะไร?", "ซื้อรถ", "ซื้อบ้าน", "ลงทุน", "เที่ยวรอบโลก", "Lifestyle", "Normal", true]);
    qSheet.appendRow(["q_2", "ถ้าต้องกินอาหารอย่างเดียว 1 เดือน?", "ข้าวผัด", "ก๋วยเตี๋ยว", "พิซซ่า", "ชาบู", "Food", "Normal", true]);
    qSheet.appendRow(["q_3", "Social Media ที่ขาดไม่ได้ที่สุด?", "Facebook", "Instagram", "TikTok", "YouTube", "Tech", "Normal", true]);
  }

  Logger.log("Database initialized successfully!");
}