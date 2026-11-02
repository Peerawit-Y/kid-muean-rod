/**
 * src/security.js - Classroom Security, Profanity Filter, and Session Management
 */

// คลังคำหยาบและคำที่ไม่เหมาะสม (ภาษาไทย & อังกฤษ) สำหรับบรรยากาศห้องเรียน
const INAPPROPRIATE_WORDS = [
  // คำหยาบทั่วไป
  "ควย", "เหี้ย", "สัส", "เย็ด", "มึง", "กู", "สถุล", "ชาติหมา", "จัญไร",
  "หน้าด้าน", "อีดอก", "อีกะหรี่", "ห่า", "ส้นตีน", "ระยำ", "เสือก", "พ่อมึงตาย",
  "fuck", "shit", "bitch", "asshole", "dick", "pussy", "bastard", "cunt", "nigger",
  "porn", "sex", "xxx", "เงี่ยน", "หรรม", "จิมิ", "หัวดอ", "แตด", "หี"
];

/**
 * ตรวจสอบคำหยาบและคำไม่เหมาะสม
 */
function validatePlayerName(name) {
  if (!name || typeof name !== "string") {
    return { valid: false, message: "กรุณาระบุชื่อผู้เล่น" };
  }

  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return { valid: false, message: "ชื่อต้องมีความยาวอย่างน้อย 2 ตัวอักษร" };
  }
  if (trimmed.length > 15) {
    return { valid: false, message: "ชื่อต้องไม่เกิน 15 ตัวอักษร" };
  }

  // ป้องกันอักขระพิเศษแปลกปลอมที่อาจใช้โจมตี XSS หรือพังเลย์เอาต์
  const cleanName = trimmed.replace(/[<>'"/\\`]/g, "");
  if (cleanName.length < 2) {
    return { valid: false, message: "ชื่อมีอักขระพิเศษที่ไม่ถูกต้อง" };
  }

  const lower = cleanName.toLowerCase();
  for (const badWord of INAPPROPRIATE_WORDS) {
    if (lower.includes(badWord.toLowerCase())) {
      return {
        valid: false,
        message: "ชื่อของคุณมีคำที่ไม่สุภาพ กรุณาใช้ชื่อที่เหมาะสมสำหรับการเรียนการสอน"
      };
    }
  }

  return { valid: true, cleanName };
}

/**
 * ตรวจสอบชื่อซ้ำในห้องเกม
 */
function isNameDuplicate(room, newName) {
  const normalizedNew = newName.trim().toLowerCase();
  for (const player of Object.values(room.players)) {
    if (player.name.trim().toLowerCase() === normalizedNew) {
      return true;
    }
  }
  return false;
}

/**
 * สร้าง Token สำหรับ Reconnection ปลอดภัย
 */
function generateToken(prefix = "tok") {
  return prefix + "_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

module.exports = {
  validatePlayerName,
  isNameDuplicate,
  generateToken
};
