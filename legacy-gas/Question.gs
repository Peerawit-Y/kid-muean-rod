/**
 * Question.gs
 * จัดการคลังคำถาม และป้องกันการสุ่มคำถามซ้ำในห้องเดียวกัน
 */

function getRandomQuestion(roomId) {
  const ss = getSpreadsheet();
  const qSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.QUESTIONS);
  const data = qSheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    return {
      questionId: "q_default",
      question: "ไม่มีคำถามในระบบ",
      optionA: "-", optionB: "-", optionC: "-", optionD: "-"
    };
  }

  const allActiveQuestions = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][8] === true || String(data[i][8]).toLowerCase() === "true") {
      allActiveQuestions.push({
        questionId: String(data[i][0]).trim(),
        question: data[i][1],
        optionA: data[i][2],
        optionB: data[i][3],
        optionC: data[i][4],
        optionD: data[i][5]
      });
    }
  }

  if (allActiveQuestions.length === 0) return null;

  const cache = CacheService.getScriptCache();
  const usedKey = "used_q_" + String(roomId).trim();
  let usedQuestions = [];
  const rawUsed = cache.get(usedKey);
  if (rawUsed) {
    try { usedQuestions = JSON.parse(rawUsed); } catch(e) { usedQuestions = []; }
  }

  let availableQuestions = allActiveQuestions.filter(q => !usedQuestions.includes(q.questionId));

  // ถ้าใช้จนครบทุกข้อแล้ว ให้ล้างประวัติแล้ววนใหม่
  if (availableQuestions.length === 0) {
    usedQuestions = [];
    availableQuestions = allActiveQuestions;
  }

  const randomIndex = Math.floor(Math.random() * availableQuestions.length);
  const selectedQuestion = availableQuestions[randomIndex];

  usedQuestions.push(selectedQuestion.questionId);
  cache.put(usedKey, JSON.stringify(usedQuestions), CONFIG.CACHE_TTL_SECONDS);

  return selectedQuestion;
}