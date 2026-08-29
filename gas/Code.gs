/**
 * Ujian GAS - backend Google Apps Script.
 *
 * 1. Buat Google Sheet baru.
 * 2. Extensions > Apps Script.
 * 3. Tempel file ini.
 * 4. Jalankan setup() sekali dan izinkan akses.
 * 5. Deploy > New deployment > Web app.
 *    Execute as: Me
 *    Who has access: Anyone
 * 6. Salin URL /exec ke GasApi.kt.
 *
 * Sheet:
 * Users, Exams, Questions, Invitations, Results, Reminders
 *
 * Password untuk MVP ini disimpan apa adanya di Sheet.
 * Untuk produksi, ganti dengan hashing/token authentication.
 */

const SHEETS = {
  Users: ["id","name","email","password","role","createdAt"],
  Exams: ["id","title","duration","startAt","endAt","createdAt"],
  Questions: ["id","examId","question","optionA","optionB","optionC","optionD","answer"],
  Invitations: ["id","email","examId","status","createdAt"],
  Results: ["id","email","examId","score","correct","total","submittedAt"],
  Reminders: ["id","email","examId","text","remindAt"]
};

function setup() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(SHEETS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) sh.appendRow(SHEETS[name]);
  });
  // Contoh data ujian.
  const exams = ss.getSheetByName("Exams");
  if (exams.getLastRow() === 1) {
    exams.appendRow(["EX001","Ujian Demo",30,"2026-09-01 08:00","2026-12-31 23:59",new Date()]);
  }
  const q = ss.getSheetByName("Questions");
  if (q.getLastRow() === 1) {
    q.appendRow(["Q001","EX001","Ibukota Indonesia?","Jakarta","Bandung","Surabaya","Medan","A"]);
    q.appendRow(["Q002","EX001","2 + 2 = ?","3","4","5","6","B"]);
  }
}

function doGet(e) { return handle(e); }
function doPost(e) { return handle(e); }

function handle(e) {
  try {
    const p = e.parameter || {};
    const action = p.action || "ping";
    const result = router(action, p);
    return json(result);
  } catch (err) {
    return json({ok:false, message:String(err)});
  }
}

function router(action, p) {
  switch (action) {
    case "ping": return {ok:true, message:"Ujian GAS API aktif"};
    case "register": return register(p);
    case "login": return login(p);
    case "exams": return exams();
    case "questions": return questions(p);
    case "submit": return submit(p);
    case "invitations": return invitations(p);
    case "results": return results(p);
    case "reminders": return reminders(p);
    default: return {ok:false, message:"Action tidak dikenal: " + action};
  }
}

function ss() { return SpreadsheetApp.getActive(); }
function sheet(name) { return ss().getSheetByName(name); }
function rows(name) {
  const sh = sheet(name), values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  return values.slice(1).map(r => {
    const o = {};
    SHEETS[name].forEach((h,i) => o[h] = r[i]);
    return o;
  });
}
function id(prefix) { return prefix + Utilities.getUuid().slice(0,8); }
function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}

function register(p) {
  if (!p.name || !p.email || !p.password) return {ok:false,message:"Data belum lengkap"};
  const users = rows("Users");
  if (users.some(u => String(u.email).toLowerCase() === String(p.email).toLowerCase()))
    return {ok:false,message:"Email sudah terdaftar"};
  sheet("Users").appendRow([id("U"),p.name,p.email,p.password,"student",new Date()]);
  return {ok:true,message:"Pendaftaran berhasil"};
}

function login(p) {
  const u = rows("Users").find(x =>
    String(x.email).toLowerCase() === String(p.email).toLowerCase() &&
    String(x.password) === String(p.password)
  );
  return u ? {ok:true,name:u.name,role:u.role} : {ok:false,message:"Email/password salah"};
}

function exams() {
  return {ok:true,data:rows("Exams").map(e => ({
    id:e.id,title:e.title,duration:e.duration,startAt:e.startAt,endAt:e.endAt
  }))};
}

function questions(p) {
  const data = rows("Questions").filter(q => String(q.examId) === String(p.examId));
  // Jangan kirim kunci jawaban ke Android.
  return {ok:true,data:data.map(q => ({
    id:q.id,examId:q.examId,question:q.question,
    optionA:q.optionA,optionB:q.optionB,optionC:q.optionC,optionD:q.optionD
  }))};
}

function submit(p) {
  if (!p.email || !p.examId || !p.answers) return {ok:false,message:"Data jawaban tidak lengkap"};
  const answerMap = JSON.parse(p.answers);
  const qs = rows("Questions").filter(q => String(q.examId) === String(p.examId));
  let correct = 0;
  qs.forEach(q => {
    if (String(answerMap[q.id] || "") === String(q.answer)) correct++;
  });
  const total = qs.length;
  const score = total ? Math.round(correct * 10000 / total) / 100 : 0;
  sheet("Results").appendRow([id("R"),p.email,p.examId,score,correct,total,new Date()]);
  return {ok:true,score:score,correct:correct,total:total,message:"Ujian berhasil dikirim"};
}

function invitations(p) {
  const examsById = {};
  rows("Exams").forEach(e => examsById[e.id] = e);
  const data = rows("Invitations").filter(i => String(i.email).toLowerCase() === String(p.email).toLowerCase())
    .map(i => ({text:"Undangan: " + ((examsById[i.examId]||{}).title || i.examId) + " • " + i.status}));
  return {ok:true,data:data};
}

function results(p) {
  const data = rows("Results").filter(r => String(r.email).toLowerCase() === String(p.email).toLowerCase())
    .map(r => ({text:"Ujian " + r.examId + " — Nilai " + r.score + " (" + r.correct + "/" + r.total + ")"}));
  return {ok:true,data:data};
}

function reminders(p) {
  const data = rows("Reminders").filter(r => String(r.email).toLowerCase() === String(p.email).toLowerCase())
    .map(r => ({text:r.text + " • " + r.remindAt}));
  return {ok:true,data:data};
}
