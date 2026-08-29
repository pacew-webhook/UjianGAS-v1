const SHEET_ID = '1sPB55UO_TbxQctmnHQ4FoRcPNNBuseOf';
const SESSION_PREFIX = 'ADMIN_SESSION_';
const SESSION_SECONDS = 21600;

function ss_(){ return SpreadsheetApp.openById(SHEET_ID); }
function sh_(name){ return ss_().getSheetByName(name); }
function now_(){ return new Date(); }
function id_(prefix){ return prefix+'-'+Utilities.getUuid().slice(0,8).toUpperCase(); }

function doGet() {
  return HtmlService
    .createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Ujian GAS');
}

function include(filename) {
  return HtmlService
    .createHtmlOutputFromFile(filename)
    .getContent();
}

function setupDatabase(){
  const schema={
    Admin:['AdminID','Nama','Email','PasswordHash','Role','Status','CreatedAt'],
    Siswa:['StudentID','Nama','Email','PasswordHash','Kelas','Status','CreatedAt'],
    Ujian:['ExamID','NamaUjian','Mapel','DurasiMenit','Tanggal','JamMulai','JamSelesai','Status','CreatedAt'],
    Soal:['QuestionID','ExamID','Pertanyaan','PilihanA','PilihanB','PilihanC','PilihanD','JawabanBenar','Bobot','CreatedAt'],
    Undangan:['InviteID','ExamID','StudentID','Status','SentAt'],
    Jawaban:['AnswerID','ExamID','StudentID','QuestionID','Jawaban','Waktu'],
    Nilai:['ResultID','ExamID','StudentID','Benar','Salah','Nilai','Status','Waktu'],
    Pengingat:['ReminderID','ExamID','Pesan','Target','Waktu']
  };
  Object.keys(schema).forEach(name=>{
    let s=sh_(name); if(!s) s=ss_().insertSheet(name);
    if(s.getLastRow()===0) s.appendRow(schema[name]);
  });
  return 'OK';
}

// Run once from GAS editor after setup. Change these credentials first.
function createInitialAdmin(){
  return createAdmin_('Administrator','admin@example.com','admin123','ADMIN');
}
function hash_(value){
  const raw=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(value));
  return raw.map(b=>('0'+(b&0xFF).toString(16)).slice(-2)).join('');
}
function createAdmin_(nama,email,password,role){
  const existing=rows_('Admin').find(x=>String(x.Email).toLowerCase()===String(email).toLowerCase());
  if(existing) throw new Error('Email admin sudah ada');
  append_('Admin',{AdminID:id_('ADM'),Nama:nama,Email:String(email).toLowerCase(),
    PasswordHash:hash_(password),Role:role||'GURU',Status:'ACTIVE',CreatedAt:now_()});
  return true;
}
function createSession_(admin){
  const token=Utilities.getUuid()+Utilities.getUuid();
  CacheService.getScriptCache().put(SESSION_PREFIX+token,JSON.stringify({
    AdminID:admin.AdminID,Nama:admin.Nama,Email:admin.Email,Role:admin.Role
  }),SESSION_SECONDS);
  return token;
}
function requireAdmin_(token){
  const raw=CacheService.getScriptCache().get(SESSION_PREFIX+token);
  if(!raw) throw new Error('Sesi berakhir. Silakan login kembali.');
  return JSON.parse(raw);
}
function loginAdmin(email,password){
  const admin=rows_('Admin').find(x=>String(x.Email).toLowerCase()===String(email).toLowerCase()
    && x.PasswordHash===hash_(password) && String(x.Status).toUpperCase()==='ACTIVE');
  if(!admin) throw new Error('Email atau password salah');
  return {token:createSession_(admin),admin:{Nama:admin.Nama,Role:admin.Role}};
}
function logoutAdmin(token){ if(token) CacheService.getScriptCache().remove(SESSION_PREFIX+token); return true; }

function rows_(sheet){
  const values=sh_(sheet).getDataRange().getValues();
  const headers=values.shift()||[];
  return values.filter(r=>r.some(v=>v!=='' && v!==null)).map((r,index)=>{
    const o={__row:index+2}; headers.forEach((h,i)=>o[h]=r[i]); return o;
  });
}
function append_(sheet,obj){
  const s=sh_(sheet), headers=s.getRange(1,1,1,s.getLastColumn()).getValues()[0];
  s.appendRow(headers.map(h=>obj[h]??''));
  return obj;
}
function updateById_(sheet,idField,id,data){
  const list=rows_(sheet), row=list.find(x=>String(x[idField])===String(id));
  if(!row) throw new Error('Data tidak ditemukan');
  const s=sh_(sheet), headers=s.getRange(1,1,1,s.getLastColumn()).getValues()[0];
  headers.forEach((h,i)=>{ if(Object.prototype.hasOwnProperty.call(data,h)) s.getRange(row.__row,i+1).setValue(data[h]); });
  return true;
}
function deleteById_(sheet,idField,id){
  const row=rows_(sheet).find(x=>String(x[idField])===String(id));
  if(!row) throw new Error('Data tidak ditemukan');
  sh_(sheet).deleteRow(row.__row); return true;
}

// Dashboard
function getDashboard(token){
  requireAdmin_(token);
  return {students:rows_('Siswa').length,exams:rows_('Ujian').length,
    questions:rows_('Soal').length,results:rows_('Nilai').length};
}

// Students
function getStudents(token){ requireAdmin_(token); return rows_('Siswa'); }
function addStudent(token,data){
  requireAdmin_(token);
  return append_('Siswa',{StudentID:id_('STD'),Nama:data.Nama,Email:data.Email,
    PasswordHash:data.PasswordHash?hash_(data.PasswordHash):'',Kelas:data.Kelas,
    Status:data.Status||'ACTIVE',CreatedAt:now_()});
}

// Exams
function getExams(token){ requireAdmin_(token); return rows_('Ujian'); }
function createExam(token,data){
  requireAdmin_(token);
  return append_('Ujian',{ExamID:id_('EXM'),NamaUjian:data.NamaUjian,Mapel:data.Mapel,
    DurasiMenit:data.DurasiMenit,Tanggal:data.Tanggal,JamMulai:data.JamMulai,
    JamSelesai:data.JamSelesai,Status:data.Status||'DRAFT',CreatedAt:now_()});
}

// Questions CRUD
function getQuestions(token,examId){ requireAdmin_(token); return rows_('Soal').filter(x=>!examId||String(x.ExamID)===String(examId)); }
function addQuestion(token,data){
  requireAdmin_(token);
  return append_('Soal',{QuestionID:id_('Q'),ExamID:data.ExamID,Pertanyaan:data.Pertanyaan,
    PilihanA:data.PilihanA,PilihanB:data.PilihanB,PilihanC:data.PilihanC,PilihanD:data.PilihanD,
    JawabanBenar:data.JawabanBenar,Bobot:data.Bobot||1,CreatedAt:now_()});
}
function updateQuestion(token,id,data){
  requireAdmin_(token);
  const clean={ExamID:data.ExamID,Pertanyaan:data.Pertanyaan,PilihanA:data.PilihanA,
    PilihanB:data.PilihanB,PilihanC:data.PilihanC,PilihanD:data.PilihanD,
    JawabanBenar:data.JawabanBenar,Bobot:data.Bobot};
  return updateById_('Soal','QuestionID',id,clean);
}
function deleteQuestion(token,id){ requireAdmin_(token); return deleteById_('Soal','QuestionID',id); }

// Invitations
function getInvitations(token,examId){ requireAdmin_(token); return rows_('Undangan').filter(x=>!examId||String(x.ExamID)===String(examId)); }
function sendInvitation(token,examId,studentIds){
  requireAdmin_(token);
  const lock=LockService.getScriptLock(); lock.waitLock(10000);
  try{
    const students=rows_('Siswa').filter(s=>studentIds.includes(String(s.StudentID)));
    let sent=0;
    students.forEach(s=>{
      append_('Undangan',{InviteID:id_('INV'),ExamID:examId,StudentID:s.StudentID,Status:'INVITED',SentAt:now_()});
      if(s.Email){
        MailApp.sendEmail({to:s.Email,subject:'Undangan Ujian',
          htmlBody:'<h2>Undangan Ujian</h2><p>Anda mendapatkan undangan ujian. Silakan buka aplikasi Ujian GAS sesuai jadwal.</p>'});
        sent++;
      }
    });
    return {success:true,total:students.length,emailSent:sent};
  } finally { lock.releaseLock(); }
}

// Results
function getResults(token,examId){
  requireAdmin_(token);
  const students=Object.fromEntries(rows_('Siswa').map(s=>[s.StudentID,s]));
  return rows_('Nilai').filter(x=>!examId||String(x.ExamID)===String(examId))
    .map(r=>Object.assign({},r,{Nama:students[r.StudentID]?.Nama||r.StudentID,Kelas:students[r.StudentID]?.Kelas||''}));
}
