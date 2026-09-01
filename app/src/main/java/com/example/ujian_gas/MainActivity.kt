package com.example.ujian_gas

import android.os.Bundle
import android.os.CountDownTimer
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.lifecycleScope
import com.example.ujian_gas.anticheat.AntiCheatConfig
import com.example.ujian_gas.anticheat.AntiCheatListener
import com.example.ujian_gas.anticheat.AntiCheatManager
import com.example.ujian_gas.ui.AppScreen
import com.example.ujian_gas.ui.ExamListItem
import com.example.ujian_gas.ui.components.*
import com.example.ujian_gas.ui.theme.UjianColors
import com.example.ujian_gas.ui.theme.UjianGasTheme
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

class MainActivity : ComponentActivity(), AntiCheatListener {

    // ------------------------------------------------------------------
    // State inti (dibaca langsung oleh Compose lewat mutableStateOf).
    // ------------------------------------------------------------------
    private var screen by mutableStateOf<AppScreen>(AppScreen.Login)
    private var currentEmail = ""
    private var currentName by mutableStateOf("")

    // Ujian aktif.
    private var activeExam: JSONObject? = null
    private var examQuestions = JSONArray()
    private val examAnswers = mutableStateMapOf<String, String>()
    private var examQuestionIndex by mutableStateOf(0)
    private var examSubmitting = false
    private var examActive = false
    private var examTimer: CountDownTimer? = null
    private var examRemainingMillis by mutableStateOf(0L)

    // Daftar untuk layar-layar list.
    private var listItems by mutableStateOf<List<JSONObject>>(emptyList())
    private var examListItems by mutableStateOf<List<ExamListItem>>(emptyList())
    private var listLoading by mutableStateOf(false)

    // Dialog Anti-Cheat.
    private var warningInfo by mutableStateOf<Triple<String, Int, Int>?>(null)
    private var lockDialogVisible by mutableStateOf(false)
    private var lockPinValue by mutableStateOf("")
    private var lockPinError by mutableStateOf<String?>(null)
    private var lockChecking by mutableStateOf(false)

    // Dialog konfirmasi kirim jawaban.
    private var unansweredDialog by mutableStateOf<List<Int>?>(null)
    private var confirmSubmitVisible by mutableStateOf(false)

    private var terminatedShown = false

    // Anti-Cheat & Exam Proctoring.
    private val antiCheat by lazy { AntiCheatManager(this, lifecycleScope, this) }
    private var examSessionId = ""
    private var examAntiCheatConfig = AntiCheatConfig()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (examActive) {
                    toast("Selesaikan ujian dengan tombol Sebelumnya, Berikutnya, atau Kirim Jawaban.")
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                    isEnabled = true
                }
            }
        })

        setContent {
            UjianGasTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = UjianColors.Background) {
                    AppRoot()
                }
            }
        }
    }

    override fun onDestroy() {
        examTimer?.cancel()
        examTimer = null
        antiCheat.stopSession()
        super.onDestroy()
    }

    override fun onPause() {
        super.onPause()
        antiCheat.onActivityPaused()
    }

    override fun onResume() {
        super.onResume()
        antiCheat.onActivityResumed()
        antiCheat.checkMultiWindowNow()
    }

    override fun onMultiWindowModeChanged(isInMultiWindowMode: Boolean) {
        super.onMultiWindowModeChanged(isInMultiWindowMode)
        antiCheat.onMultiWindowModeChanged(isInMultiWindowMode)
    }

    /* =========================
       AntiCheatListener — reaksi UI terhadap status Anti-Cheat (bagian 18 PRD)
       ========================= */

    override fun onExamWarning(violationType: String, count: Int, max: Int) {
        if (!examActive || lockDialogVisible) return
        runOnUiThread { warningInfo = Triple(violationType, count, max) }
    }

    override fun onExamLocked() {
        runOnUiThread {
            lockPinValue = ""
            lockPinError = null
            lockDialogVisible = true
        }
    }

    override fun onExamTerminated(message: String) {
        runOnUiThread { showExamTerminated(message) }
    }

    override fun onExamUnlocked() {
        runOnUiThread {
            lockDialogVisible = false
            toast("Ujian dibuka kembali. Silakan lanjutkan mengerjakan.")
        }
    }

    // ------------------------------------------------------------------
    // Root composable: mengatur transisi antar layar.
    // ------------------------------------------------------------------
    @Composable
    private fun AppRoot() {
        Box(modifier = Modifier.fillMaxSize()) {
            AnimatedContent(
                targetState = screen,
                transitionSpec = { fadeIn() togetherWith fadeOut() },
                label = "screen"
            ) { s ->
                when (s) {
                    is AppScreen.Login -> LoginScreen()
                    is AppScreen.Register -> RegisterScreen()
                    is AppScreen.Home -> HomeScreen()
                    is AppScreen.SimpleList -> SimpleListScreen(s.header, s.icon, s.emptyText)
                    is AppScreen.ExamList -> ExamListScreen()
                    is AppScreen.ExamQuestion -> ExamQuestionScreen()
                    is AppScreen.Submitting -> SubmittingScreen()
                    is AppScreen.Terminated -> TerminatedScreen(s.message)
                }
            }

            warningInfo?.let { (type, count, max) ->
                WarningDialog(type, count, max)
            }
            if (lockDialogVisible) {
                LockDialog()
            }
            unansweredDialog?.let { indexes ->
                UnansweredDialog(indexes)
            }
            if (confirmSubmitVisible) {
                ConfirmSubmitDialog()
            }
        }
    }

    @Composable
    private fun screenPadding() = Modifier
        .fillMaxSize()
        .verticalScroll(rememberScrollState())
        .padding(horizontal = 20.dp, vertical = 28.dp)

    // ------------------------------------------------------------------
    // LOGIN
    // ------------------------------------------------------------------
    @Composable
    private fun LoginScreen() {
        var email by remember { mutableStateOf("") }
        var password by remember { mutableStateOf("") }
        var loading by remember { mutableStateOf(false) }
        val scope = rememberCoroutineScope()

        Column(modifier = screenPadding()) {
            AppBrand("Masuk untuk mengakses ujian dan hasil belajar")
            Spacer(Modifier.height(28.dp))
            SoftCard {
                Text("Selamat datang \uD83D\uDC4B", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = UjianColors.TextPrimary)
                Spacer(Modifier.height(4.dp))
                Text("Gunakan akun yang sudah terdaftar.", fontSize = 14.sp, color = UjianColors.TextMuted)
                Spacer(Modifier.height(16.dp))
                ModernTextField(email, { email = it }, "Email", keyboardType = KeyboardType.Email)
                Spacer(Modifier.height(12.dp))
                ModernTextField(password, { password = it }, "Password", isPassword = true)
                Spacer(Modifier.height(16.dp))
                PrimaryButton("Masuk", loading = loading) {
                    if (email.isBlank() || password.isBlank()) {
                        toast("Email dan password wajib diisi")
                    } else {
                        loading = true
                        scope.launch {
                            try {
                                val r = GasApi.post("login", mapOf("email" to email.trim(), "password" to password))
                                if (r.optBoolean("ok")) {
                                    currentEmail = email.trim()
                                    currentName = r.optString("name", currentEmail)
                                    screen = AppScreen.Home
                                } else {
                                    toast(r.optString("message", "Login gagal"))
                                }
                            } catch (e: Exception) {
                                toast(e.message ?: "Gagal terhubung")
                            } finally {
                                loading = false
                            }
                        }
                    }
                }
                Spacer(Modifier.height(10.dp))
                SecondaryButton("Buat akun baru") { screen = AppScreen.Register }
            }
            Spacer(Modifier.height(22.dp))
            Text(
                "Ujian GAS \u2022 Google Apps Script",
                fontSize = 13.sp,
                color = UjianColors.TextMuted,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }

    @Composable
    private fun RegisterScreen() {
        var name by remember { mutableStateOf("") }
        var email by remember { mutableStateOf("") }
        var password by remember { mutableStateOf("") }
        var loading by remember { mutableStateOf(false) }
        val scope = rememberCoroutineScope()

        Column(modifier = screenPadding()) {
            SectionTitle("Buat akun", "Daftar untuk mengikuti ujian")
            Spacer(Modifier.height(24.dp))
            SoftCard {
                ModernTextField(name, { name = it }, "Nama lengkap")
                Spacer(Modifier.height(12.dp))
                ModernTextField(email, { email = it }, "Email", keyboardType = KeyboardType.Email)
                Spacer(Modifier.height(12.dp))
                ModernTextField(password, { password = it }, "Password", isPassword = true)
                Spacer(Modifier.height(16.dp))
                PrimaryButton("Daftar", loading = loading) {
                    loading = true
                    scope.launch {
                        try {
                            val r = GasApi.post("register", mapOf("name" to name, "email" to email.trim(), "password" to password))
                            toast(r.optString("message", "Selesai"))
                            if (r.optBoolean("ok")) screen = AppScreen.Login
                        } catch (e: Exception) {
                            toast(e.message ?: "Gagal")
                        } finally {
                            loading = false
                        }
                    }
                }
                Spacer(Modifier.height(10.dp))
                SecondaryButton("Kembali ke login") { screen = AppScreen.Login }
            }
        }
    }

    // ------------------------------------------------------------------
    // HOME
    // ------------------------------------------------------------------
    @Composable
    private fun HomeScreen() {
        Column(modifier = screenPadding()) {
            Text("Halo,", fontSize = 16.sp, color = UjianColors.TextMuted)
            Text(
                currentName.ifBlank { currentEmail },
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = UjianColors.Navy,
                maxLines = 1
            )
            Spacer(Modifier.height(4.dp))
            Text("Apa yang ingin kamu lakukan hari ini?", fontSize = 15.sp, color = UjianColors.TextMuted)
            Spacer(Modifier.height(22.dp))

            InfoCard("\u2709\uFE0F", "Undangan Ujian", "Lihat undangan dan jadwal ujian") {
                openSimpleList("Undangan Ujian", "invitations", "\uD83D\uDCED", "Belum ada undangan untuk saat ini.")
            }
            Spacer(Modifier.height(12.dp))
            InfoCard("\uD83D\uDCDD", "Kerjakan Ujian", "Mulai ujian yang tersedia") { openExamList() }
            Spacer(Modifier.height(12.dp))
            InfoCard("\uD83D\uDCCA", "Nilai Otomatis", "Lihat hasil dan nilai ujian") {
                openSimpleList("Hasil & Nilai", "results", "\uD83D\uDCCA", "Belum ada hasil ujian.")
            }
            Spacer(Modifier.height(12.dp))
            InfoCard("\uD83D\uDD14", "Pengingat", "Cek pengingat ujian mendatang") {
                openSimpleList("Pengingat Ujian", "reminders", "\uD83D\uDD14", "Belum ada pengingat.")
            }
            Spacer(Modifier.height(22.dp))
            SecondaryButton("Keluar") {
                currentEmail = ""
                currentName = ""
                screen = AppScreen.Login
            }
        }
    }

    private fun openSimpleList(header: String, action: String, icon: String, empty: String) {
        screen = AppScreen.SimpleList(header, action, icon, empty)
        listLoading = true
        lifecycleScope.launch {
            try {
                val r = GasApi.post(action, mapOf("email" to currentEmail))
                val arr = r.optJSONArray("data") ?: JSONArray()
                listItems = (0 until arr.length()).map { arr.getJSONObject(it) }
            } catch (e: Exception) {
                toast(e.message ?: "Gagal")
            } finally {
                listLoading = false
            }
        }
    }

    @Composable
    private fun SimpleListScreen(header: String, icon: String, emptyText: String) {
        Column(modifier = screenPadding()) {
            SectionTitle(header)
            Spacer(Modifier.height(18.dp))
            if (listLoading) {
                Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = UjianColors.Blue)
                }
            } else if (listItems.isEmpty()) {
                EmptyState(icon, emptyText, "Silakan cek kembali nanti.")
            } else {
                listItems.forEach { o ->
                    SoftCard(modifier = Modifier.padding(top = 12.dp), padding = 16) {
                        Text(o.optString("text", o.toString()), fontSize = 16.sp, color = UjianColors.TextPrimary)
                    }
                }
            }
            Spacer(Modifier.height(22.dp))
            SecondaryButton("Kembali ke menu") { screen = AppScreen.Home }
        }
    }

    // ------------------------------------------------------------------
    // DAFTAR UJIAN
    // ------------------------------------------------------------------
    private fun openExamList() {
        screen = AppScreen.ExamList
        listLoading = true
        lifecycleScope.launch {
            try {
                val r = GasApi.post("exams", mapOf("email" to currentEmail))
                val arr = r.optJSONArray("data") ?: JSONArray()
                examListItems = (0 until arr.length()).map { i ->
                    val o = arr.getJSONObject(i)
                    ExamListItem(
                        raw = o,
                        id = o.optString("id"),
                        title = o.optString("title"),
                        durationMinutes = o.optString("duration"),
                        completed = o.optBoolean("completed"),
                        nilai = if (o.isNull("nilai")) "-" else o.optString("nilai")
                    )
                }
            } catch (e: Exception) {
                toast(e.message ?: "Gagal")
            } finally {
                listLoading = false
            }
        }
    }

    @Composable
    private fun ExamListScreen() {
        Column(modifier = screenPadding()) {
            SectionTitle("Daftar Ujian", "Pilih ujian yang ingin dikerjakan")
            Spacer(Modifier.height(18.dp))
            if (listLoading) {
                Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = UjianColors.Blue)
                }
            } else if (examListItems.isEmpty()) {
                EmptyState("\uD83D\uDCDD", "Belum ada ujian", "Ujian akan muncul di sini saat tersedia.")
            } else {
                examListItems.forEach { item ->
                    Spacer(Modifier.height(14.dp))
                    if (item.completed) {
                        InfoCard("\u2705", item.title, "Sudah dikumpulkan \u2022 Nilai: ${item.nilai}", accent = UjianColors.Success.copy(alpha = 0.12f)) {
                            toast("Ujian ini sudah dikumpulkan, tidak bisa dikerjakan ulang.")
                            openSimpleList("Hasil & Nilai", "results", "\uD83D\uDCCA", "Belum ada hasil ujian.")
                        }
                    } else {
                        InfoCard("\uD83D\uDCDD", item.title, "Durasi ${item.durationMinutes} menit") {
                            startExam(item.raw)
                        }
                    }
                }
            }
            Spacer(Modifier.height(22.dp))
            SecondaryButton("Kembali") { screen = AppScreen.Home }
        }
    }

    // ------------------------------------------------------------------
    // AMBIL SOAL & MULAI SESI
    // ------------------------------------------------------------------
    private fun startExam(exam: JSONObject) {
        lifecycleScope.launch {
            try {
                val r = GasApi.post("questions", mapOf("examId" to exam.optString("id"), "email" to currentEmail))

                if (!r.optBoolean("ok", true)) {
                    if (r.optString("sessionStatus") == "TERMINATED") {
                        showExamTerminated(r.optString("message", "Ujian ini telah dihentikan."))
                        return@launch
                    }
                    toast(r.optString("message", "Ujian tidak dapat diakses"))
                    return@launch
                }

                val qs = r.optJSONArray("data") ?: JSONArray()
                if (qs.length() == 0) {
                    toast("Belum ada soal untuk ujian ini")
                    return@launch
                }

                val requestedExamId = exam.optString("id")
                val sameActiveExam = examActive &&
                    activeExam?.optString("id") == requestedExamId &&
                    examQuestions.length() > 0

                if (!sameActiveExam) {
                    activeExam = exam
                    examQuestions = qs
                    examAnswers.clear()
                    examQuestionIndex = 0
                    examSubmitting = false
                }

                startExamTimerFromServer(r.optLong("remainingSeconds", -1L))

                examActive = true
                terminatedShown = false

                examSessionId = r.optString("sessionId")
                examAntiCheatConfig = AntiCheatConfig.fromJson(r.optJSONObject("antiCheat"))
                if (examSessionId.isNotBlank()) {
                    antiCheat.startSession(
                        email = currentEmail,
                        examId = requestedExamId,
                        sessionId = examSessionId,
                        config = examAntiCheatConfig,
                        initialViolationCount = r.optInt("violationCount", 0),
                        initialStatus = r.optString("sessionStatus", "ACTIVE"),
                        remainingSecondsProvider = { examRemainingMillis / 1000L }
                    )
                }

                screen = AppScreen.ExamQuestion
            } catch (e: Exception) {
                toast(e.message ?: "Gagal memuat ujian")
            }
        }
    }

    private fun startExamTimerFromServer(remainingSeconds: Long) {
        examTimer?.cancel()

        if (remainingSeconds <= 0L) {
            examRemainingMillis = 0L
            if (examActive && !examSubmitting) {
                toast("Waktu ujian habis. Jawaban akan dikirim otomatis.")
                submitExam(autoSubmit = true)
            }
            return
        }

        examRemainingMillis = remainingSeconds * 1_000L

        examTimer = object : CountDownTimer(examRemainingMillis, 1_000L) {
            override fun onTick(millisUntilFinished: Long) {
                examRemainingMillis = millisUntilFinished
            }

            override fun onFinish() {
                examRemainingMillis = 0L
                if (examActive && !examSubmitting) {
                    toast("Waktu ujian habis. Jawaban akan dikirim otomatis.")
                    submitExam(autoSubmit = true)
                }
            }
        }.start()
    }

    private fun formatTimer(millis: Long): String {
        val totalSeconds = (millis / 1_000L).coerceAtLeast(0L)
        val hours = totalSeconds / 3600L
        val minutes = (totalSeconds % 3600L) / 60L
        val seconds = totalSeconds % 60L
        return if (hours > 0L) {
            String.format(java.util.Locale.getDefault(), "Sisa waktu %02d:%02d:%02d", hours, minutes, seconds)
        } else {
            String.format(java.util.Locale.getDefault(), "Sisa waktu %02d:%02d", minutes, seconds)
        }
    }

    // ------------------------------------------------------------------
    // LAYAR SOAL UJIAN
    // ------------------------------------------------------------------
    @Composable
    private fun ExamQuestionScreen() {
        val exam = activeExam ?: return
        if (examQuestions.length() == 0) return
        val index = examQuestionIndex.coerceIn(0, examQuestions.length() - 1)
        val q = remember(index) { examQuestions.getJSONObject(index) }
        val questionId = q.optString("id")
        val selectedAnswer = examAnswers[questionId]

        Column(modifier = screenPadding()) {
            SectionTitle(exam.optString("title"), "Soal ${index + 1} dari ${examQuestions.length()}")
            Spacer(Modifier.height(14.dp))
            SoftPill(formatTimer(examRemainingMillis), modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(16.dp))

            SoftCard {
                Text(
                    "SOAL ${index + 1}",
                    color = UjianColors.Blue,
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp,
                    letterSpacing = 1.sp
                )
                Spacer(Modifier.height(7.dp))
                // Text Compose biasa TIDAK bisa di-select/copy tanpa SelectionContainer,
                // jadi soal & opsi jawaban otomatis terlindungi dari copy-paste
                // (bagian 6.8 PRD) tanpa perlu kode tambahan.
                Text(
                    q.optString("question"),
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = UjianColors.TextPrimary
                )
                Spacer(Modifier.height(14.dp))

                Column(modifier = Modifier.selectableGroup()) {
                    listOf("A", "B", "C", "D").forEach { letter ->
                        val optionText = q.optString("option$letter")
                        val selected = selectedAnswer == letter
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .selectable(
                                    selected = selected,
                                    onClick = { examAnswers[questionId] = letter }
                                )
                                .padding(vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            RadioButton(
                                selected = selected,
                                onClick = { examAnswers[questionId] = letter },
                                colors = RadioButtonDefaults.colors(selectedColor = UjianColors.Blue)
                            )
                            Spacer(Modifier.width(6.dp))
                            Text("$letter. $optionText", fontSize = 15.sp, color = UjianColors.TextPrimary)
                        }
                    }
                }
            }

            Spacer(Modifier.height(20.dp))
            Row {
                if (index > 0) {
                    SecondaryButton("Sebelumnya", modifier = Modifier.weight(1f)) {
                        if (!examSubmitting) examQuestionIndex--
                    }
                    Spacer(Modifier.width(12.dp))
                }
                if (index < examQuestions.length() - 1) {
                    PrimaryButton("Berikutnya", modifier = Modifier.weight(1f)) {
                        if (!examSubmitting) examQuestionIndex++
                    }
                } else {
                    PrimaryButton("Kirim Jawaban", modifier = Modifier.weight(1f)) {
                        if (!examSubmitting) confirmSubmitExam()
                    }
                }
            }
        }
    }

    private fun confirmSubmitExam() {
        val total = examQuestions.length()
        val unansweredIndexes = (0 until total).filter { idx ->
            val questionId = examQuestions.getJSONObject(idx).optString("id")
            !examAnswers.containsKey(questionId)
        }
        if (unansweredIndexes.isNotEmpty()) {
            unansweredDialog = unansweredIndexes
        } else {
            confirmSubmitVisible = true
        }
    }

    @Composable
    private fun UnansweredDialog(unansweredIndexes: List<Int>) {
        val total = examQuestions.length()
        val nomorSoal = unansweredIndexes.joinToString(", ") { (it + 1).toString() }
        AlertDialog(
            onDismissRequest = { unansweredDialog = null },
            title = { Text("Masih Ada Soal Belum Dijawab", fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    "Ada ${unansweredIndexes.size} dari $total soal yang belum dijawab (nomor $nomorSoal).\n\n" +
                        "Jawaban belum bisa dikirim. Jawab dulu semua soal, baru kirim."
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    examQuestionIndex = unansweredIndexes.first()
                    unansweredDialog = null
                }) { Text("Periksa Soal") }
            }
        )
    }

    @Composable
    private fun ConfirmSubmitDialog() {
        val total = examQuestions.length()
        AlertDialog(
            onDismissRequest = { confirmSubmitVisible = false },
            title = { Text("Kirim Jawaban Ujian?", fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    "Semua $total soal sudah dijawab. Setelah dikirim, jawaban tidak bisa diubah lagi.\n\n" +
                        "Yakin ingin mengirim jawaban sekarang?"
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    confirmSubmitVisible = false
                    submitExam()
                }) { Text("Kirim") }
            },
            dismissButton = {
                TextButton(onClick = { confirmSubmitVisible = false }) { Text("Batal, cek lagi") }
            }
        )
    }

    @Composable
    private fun SubmittingScreen() {
        Column(
            modifier = screenPadding(),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            CircularProgressIndicator(color = UjianColors.Blue)
            Spacer(Modifier.height(20.dp))
            Text("Mengirim jawaban...", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = UjianColors.TextPrimary, textAlign = TextAlign.Center)
            Spacer(Modifier.height(8.dp))
            Text("Mohon tunggu sampai hasil pengiriman diterima.", fontSize = 14.sp, color = UjianColors.TextMuted, textAlign = TextAlign.Center)
        }
    }

    private fun submitExam(autoSubmit: Boolean = false) {
        if (examSubmitting) return
        val exam = activeExam ?: return
        examSubmitting = true
        screen = AppScreen.Submitting

        lifecycleScope.launch {
            try {
                val answersJson = JSONObject()
                examAnswers.forEach { (questionId, answer) -> answersJson.put(questionId, answer) }
                val res = GasApi.post(
                    "submit",
                    mapOf(
                        "email" to currentEmail,
                        "examId" to exam.optString("id"),
                        "answers" to answersJson.toString()
                    )
                )
                if (res.optBoolean("ok")) {
                    examTimer?.cancel()
                    examTimer = null
                    examRemainingMillis = 0L
                    examActive = false
                    activeExam = null
                    examQuestions = JSONArray()
                    examAnswers.clear()
                    examQuestionIndex = 0
                    examSubmitting = false
                    antiCheat.stopSession()
                    toast(res.optString("message", "Jawaban berhasil dikirim"))
                    screen = AppScreen.Home
                } else {
                    examSubmitting = false
                    toast(res.optString("message", "Gagal mengirim jawaban"))
                    screen = AppScreen.ExamQuestion
                }
            } catch (e: Exception) {
                examSubmitting = false
                toast(e.message ?: "Gagal mengirim jawaban")
                // Jawaban tetap berada di examAnswers agar siswa tidak mengulang.
                screen = AppScreen.ExamQuestion
            }
        }
    }

    // ------------------------------------------------------------------
    // TERMINATED
    // ------------------------------------------------------------------
    private fun showExamTerminated(message: String) {
        if (terminatedShown) return
        terminatedShown = true
        lockDialogVisible = false
        examTimer?.cancel()
        examTimer = null
        examActive = false
        antiCheat.stopSession()
        screen = AppScreen.Terminated(message)
    }

    @Composable
    private fun TerminatedScreen(message: String) {
        Column(
            modifier = screenPadding(),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(Icons.Default.Warning, contentDescription = null, tint = UjianColors.Danger, modifier = Modifier.size(48.dp))
            Spacer(Modifier.height(12.dp))
            Text("UJIAN DIHENTIKAN", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = UjianColors.Danger, textAlign = TextAlign.Center)
            Spacer(Modifier.height(10.dp))
            Text(
                "$message\n\nJawaban terakhir yang sempat tersimpan telah diamankan. Hubungi pengawas untuk informasi lebih lanjut.",
                fontSize = 14.sp,
                color = UjianColors.TextMuted,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(20.dp))
            PrimaryButton("Kembali ke Menu") {
                terminatedShown = false
                activeExam = null
                examQuestions = JSONArray()
                examAnswers.clear()
                examQuestionIndex = 0
                screen = AppScreen.Home
            }
        }
    }

    // ------------------------------------------------------------------
    // DIALOG ANTI-CHEAT
    // ------------------------------------------------------------------
    @Composable
    private fun WarningDialog(type: String, count: Int, max: Int) {
        AlertDialog(
            onDismissRequest = { },
            icon = { Icon(Icons.Default.Warning, contentDescription = null, tint = UjianColors.Warning) },
            title = { Text("PERINGATAN", fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    "Anda terdeteksi melakukan pelanggaran ujian ($type).\n\n" +
                        "Pelanggaran: $count / $max\n\n" +
                        "Tetap berada di aplikasi ujian."
                )
            },
            confirmButton = {
                TextButton(onClick = { warningInfo = null }) { Text("LANJUTKAN") }
            }
        )
    }

    @Composable
    private fun LockDialog() {
        AlertDialog(
            onDismissRequest = { },
            icon = { Icon(Icons.Default.Lock, contentDescription = null, tint = UjianColors.Danger) },
            title = { Text("UJIAN DIKUNCI", fontWeight = FontWeight.Bold, color = UjianColors.Danger) },
            text = {
                Column {
                    Text(
                        "Batas pelanggaran telah tercapai.\n\nHubungi pengawas untuk melanjutkan ujian, lalu masukkan PIN Pengawas di bawah ini.",
                        color = UjianColors.TextMuted,
                        fontSize = 14.sp
                    )
                    Spacer(Modifier.height(14.dp))
                    ModernTextField(
                        value = lockPinValue,
                        onValueChange = { lockPinValue = it; lockPinError = null },
                        label = "PIN Pengawas",
                        isPassword = true,
                        keyboardType = KeyboardType.NumberPassword
                    )
                    lockPinError?.let {
                        Spacer(Modifier.height(8.dp))
                        Text(it, color = UjianColors.Danger, fontSize = 13.sp)
                    }
                }
            },
            confirmButton = {
                TextButton(
                    enabled = !lockChecking,
                    onClick = {
                        val pin = lockPinValue.trim()
                        if (pin.isBlank()) {
                            lockPinError = "PIN Pengawas wajib diisi."
                            return@TextButton
                        }
                        lockChecking = true
                        lockPinError = "Memeriksa PIN..."
                        antiCheat.attemptUnlock(pin) { success, message ->
                            runOnUiThread {
                                lockChecking = false
                                if (success) {
                                    lockDialogVisible = false
                                } else {
                                    lockPinError = message
                                }
                            }
                        }
                    }
                ) { Text("BUKA UJIAN") }
            }
        )
    }

    private fun toast(s: String) = Toast.makeText(this, s, Toast.LENGTH_LONG).show()
}
