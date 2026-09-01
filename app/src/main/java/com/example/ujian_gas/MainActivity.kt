package com.example.ujian_gas

import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.CountDownTimer
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.setPadding
import androidx.lifecycle.lifecycleScope
import com.example.ujian_gas.anticheat.AntiCheatConfig
import com.example.ujian_gas.anticheat.AntiCheatListener
import com.example.ujian_gas.anticheat.AntiCheatManager
import com.google.android.material.button.MaterialButton
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

class MainActivity : AppCompatActivity(), AntiCheatListener {
    private lateinit var root: LinearLayout
    private var currentEmail = ""
    private var currentName = ""

    // State ujian dipertahankan selama sesi ujian.
    private var activeExam: JSONObject? = null
    private var examQuestions = JSONArray()
    private val examAnswers = mutableMapOf<String, String>()
    private var examQuestionIndex = 0
    private var examSubmitting = false
    private var examActive = false
    private var examTimer: CountDownTimer? = null
    private var examRemainingMillis = 0L
    private var examTimerText: TextView? = null

    // Anti-Cheat & Exam Proctoring (PRD_UjianGAS_AntiCheat_Exam_Proctoring.md).
    private val antiCheat by lazy { AntiCheatManager(this, lifecycleScope, this) }
    private var examSessionId = ""
    private var examAntiCheatConfig = AntiCheatConfig()
    private var lockDialog: AlertDialog? = null
    private var terminatedShown = false

    private val navy = Color.parseColor("#14213D")
    private val blue = Color.parseColor("#2563EB")
    private val blueSoft = Color.parseColor("#EFF6FF")
    private val bg = Color.parseColor("#F6F8FC")
    private val appTextColor = Color.parseColor("#172033")
    private val muted = Color.parseColor("#64748B")
    private val border = Color.parseColor("#E2E8F0")
    private val white = Color.WHITE

    @Deprecated("Use OnBackInvokedDispatcher on newer Android versions")
    override fun onBackPressed() {
        if (examActive) {
            toast("Selesaikan ujian dengan tombol Sebelumnya, Berikutnya, atau Kirim Jawaban.")
            return
        }
        super.onBackPressed()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        showLogin()
    }

    override fun onDestroy() {
        examTimer?.cancel()
        examTimer = null
        examTimerText = null
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
        if (!examActive || lockDialog != null) return
        runOnUiThread {
            AlertDialog.Builder(this)
                .setTitle("⚠️ PERINGATAN")
                .setMessage(
                    "Anda terdeteksi melakukan pelanggaran ujian ($violationType).\n\n" +
                        "Pelanggaran: $count / $max\n\n" +
                        "Tetap berada di aplikasi ujian."
                )
                .setPositiveButton("LANJUTKAN", null)
                .setCancelable(false)
                .show()
        }
    }

    override fun onExamLocked() {
        runOnUiThread { showExamLockedDialog() }
    }

    override fun onExamTerminated(message: String) {
        runOnUiThread { showExamTerminated(message) }
    }

    override fun onExamUnlocked() {
        runOnUiThread {
            lockDialog?.dismiss()
            lockDialog = null
            toast("Ujian dibuka kembali. Silakan lanjutkan mengerjakan.")
        }
    }

    private fun showExamLockedDialog() {
        if (lockDialog?.isShowing == true) return

        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(24), dp(20), dp(24), dp(4))
        }
        box.addView(TextView(this).apply {
            text = "🔒 UJIAN DIKUNCI"
            textSize = 20f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.parseColor("#DC2626"))
        })
        box.addView(TextView(this).apply {
            text = "Batas pelanggaran telah tercapai.\n\nHubungi pengawas untuk melanjutkan ujian, lalu masukkan PIN Pengawas di bawah ini."
            textSize = 14f
            setTextColor(muted)
        }, lp(top = 10, bottom = 16))
        val pinInput = modernInput("PIN Pengawas", InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_VARIATION_PASSWORD)
        box.addView(pinInput)
        val statusText = TextView(this).apply {
            textSize = 13f
            setTextColor(Color.parseColor("#DC2626"))
        }
        box.addView(statusText, lp(top = 8))

        val dialog = AlertDialog.Builder(this)
            .setView(box)
            .setCancelable(false)
            .setPositiveButton("BUKA UJIAN", null)
            .create()

        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val pin = pinInput.text.toString().trim()
                if (pin.isBlank()) {
                    statusText.text = "PIN Pengawas wajib diisi."
                    return@setOnClickListener
                }
                statusText.text = "Memeriksa PIN..."
                antiCheat.attemptUnlock(pin) { success, message ->
                    runOnUiThread {
                        if (success) {
                            dialog.dismiss()
                            lockDialog = null
                        } else {
                            statusText.text = message
                        }
                    }
                }
            }
        }

        lockDialog = dialog
        dialog.show()
    }

    private fun showExamTerminated(message: String) {
        if (terminatedShown) return
        terminatedShown = true
        lockDialog?.dismiss()
        lockDialog = null
        examTimer?.cancel()
        examTimer = null
        examActive = false
        antiCheat.stopSession()

        val (scroll, box) = screen()
        box.gravity = Gravity.CENTER
        box.addView(TextView(this).apply {
            text = "⛔ UJIAN DIHENTIKAN"
            textSize = 22f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            setTextColor(Color.parseColor("#DC2626"))
        })
        box.addView(TextView(this).apply {
            text = "$message\n\nJawaban terakhir yang sempat tersimpan telah diamankan. Hubungi pengawas untuk informasi lebih lanjut."
            textSize = 14f
            gravity = Gravity.CENTER
            setTextColor(muted)
        }, lp(top = 10, bottom = 20))
        box.addView(primaryButton("Kembali ke Menu") {
            terminatedShown = false
            activeExam = null
            examQuestions = JSONArray()
            examAnswers.clear()
            examQuestionIndex = 0
            showHome()
        })
        setScreen(scroll, box)
    }

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    private fun lp(w: Int = LinearLayout.LayoutParams.MATCH_PARENT, h: Int = LinearLayout.LayoutParams.WRAP_CONTENT,
                   top: Int = 0, bottom: Int = 0): LinearLayout.LayoutParams {
        return LinearLayout.LayoutParams(w, h).apply {
            topMargin = dp(top)
            bottomMargin = dp(bottom)
        }
    }

    private fun shape(color: Int, radius: Int = 18, strokeColor: Int? = null, stroke: Int = 1): GradientDrawable =
        GradientDrawable().apply {
            setColor(color)
            cornerRadius = dp(radius).toFloat()
            if (strokeColor != null) setStroke(dp(stroke), strokeColor)
        }

    private fun screen(): Pair<ScrollView, LinearLayout> {
        val scroll = ScrollView(this).apply {
            setBackgroundColor(bg)
            isFillViewport = true
        }
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(28), dp(20), dp(28))
        }
        scroll.addView(box)
        return scroll to box
    }

    private fun setScreen(scroll: ScrollView, box: LinearLayout) {
        root = box
        setContentView(scroll)
    }

    private fun appBrand(box: LinearLayout, subtitle: String) {
        box.addView(TextView(this).apply {
            text = "UJIAN"
            textSize = 13f
            letterSpacing = 0.12f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(blue)
        })
        box.addView(TextView(this).apply {
            text = "Ujian GAS"
            textSize = 30f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(navy)
        }, lp(top = 2))
        box.addView(TextView(this).apply {
            text = subtitle
            textSize = 15f
            setTextColor(muted)
            setPadding(0, dp(4), 0, 0)
        })
    }

    private fun sectionTitle(value: String, subtitle: String? = null): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        addView(TextView(this@MainActivity).apply {
            text = value
            textSize = 28f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(appTextColor)
        })
        if (subtitle != null) addView(TextView(this@MainActivity).apply {
            text = subtitle
            textSize = 15f
            setTextColor(muted)
        }, lp(top = 4))
    }

    private fun modernInput(hint: String, type: Int = InputType.TYPE_CLASS_TEXT): EditText = EditText(this).apply {
        this.hint = hint
        inputType = type
        textSize = 16f
        setTextColor(appTextColor)
        setHintTextColor(Color.parseColor("#94A3B8"))
        setPadding(dp(16), dp(2), dp(16), dp(2))
        minHeight = dp(58)
        background = shape(white, 16, border)
    }

    private fun primaryButton(label: String, onClick: () -> Unit): MaterialButton = MaterialButton(this).apply {
        text = label
        isAllCaps = false
        textSize = 16f
        typeface = Typeface.DEFAULT_BOLD
        setTextColor(white)
        minHeight = dp(54)
        cornerRadius = dp(16)
        setBackgroundColor(blue)
        setOnClickListener { onClick() }
    }

    private fun secondaryButton(label: String, onClick: () -> Unit): MaterialButton = MaterialButton(this).apply {
        text = label
        isAllCaps = false
        textSize = 16f
        setTextColor(blue)
        minHeight = dp(52)
        cornerRadius = dp(16)
        strokeWidth = dp(1)
        strokeColor = android.content.res.ColorStateList.valueOf(border)
        setBackgroundColor(white)
        setOnClickListener { onClick() }
    }

    private fun infoCard(icon: String, title: String, subtitle: String, onClick: () -> Unit): LinearLayout {
        return LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            background = shape(white, 20, border)
            setPadding(dp(16), dp(16), dp(16), dp(16))
            isClickable = true
            isFocusable = true
            setOnClickListener { onClick() }

            addView(TextView(this@MainActivity).apply {
                text = icon
                textSize = 25f
                gravity = Gravity.CENTER
                background = shape(blueSoft, 15)
            }, LinearLayout.LayoutParams(dp(54), dp(54)))

            addView(LinearLayout(this@MainActivity).apply {
                orientation = LinearLayout.VERTICAL
                addView(TextView(this@MainActivity).apply {
                    text = title
                    textSize = 16f
                    typeface = Typeface.DEFAULT_BOLD
                    setTextColor(appTextColor)
                })
                addView(TextView(this@MainActivity).apply {
                    text = subtitle
                    textSize = 13f
                    setTextColor(muted)
                    maxLines = 2
                }, lp(top = 3))
            }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                leftMargin = dp(14)
            })

            addView(TextView(this@MainActivity).apply {
                text = "›"
                textSize = 30f
                setTextColor(Color.parseColor("#94A3B8"))
            })
        }
    }

    private fun showLogin() {
        val (scroll, box) = screen()
        appBrand(box, "Masuk untuk mengakses ujian dan hasil belajar")

        box.addView(LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = shape(white, 24, border)
            setPadding(dp(18), dp(20), dp(18), dp(20))

            addView(TextView(this@MainActivity).apply {
                text = "Selamat datang 👋"
                textSize = 20f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(appTextColor)
            })
            addView(TextView(this@MainActivity).apply {
                text = "Gunakan akun yang sudah terdaftar."
                textSize = 14f
                setTextColor(muted)
            }, lp(top = 4, bottom = 16))

            val email = modernInput("Email", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS)
            val password = modernInput("Password", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD)
            addView(email, lp(bottom = 12))
            addView(password, lp(bottom = 16))
            addView(primaryButton("Masuk") {
                if (email.text.isBlank() || password.text.isBlank()) {
                    toast("Email dan password wajib diisi")
                } else {
                    lifecycleScope.launch {
                        try {
                            val r = GasApi.post("login", mapOf(
                                "email" to email.text.toString().trim(),
                                "password" to password.text.toString()
                            ))
                            if (r.optBoolean("ok")) {
                                currentEmail = email.text.toString().trim()
                                currentName = r.optString("name", currentEmail)
                                showHome()
                            } else {
                                toast(r.optString("message", "Login gagal"))
                            }
                        } catch (e: Exception) {
                            toast(e.message ?: "Gagal terhubung")
                        }
                    }
                }
            })
            addView(secondaryButton("Buat akun baru") { showRegister() }, lp(top = 10))
        }, lp(top = 28))

        box.addView(TextView(this).apply {
            text = "Ujian GAS • Google Apps Script"
            textSize = 13f
            gravity = Gravity.CENTER
            setTextColor(muted)
        }, lp(top = 22))
        setScreen(scroll, box)
    }

    private fun showRegister() {
        val (scroll, box) = screen()
        box.addView(sectionTitle("Buat akun", "Daftar untuk mengikuti ujian"))
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = shape(white, 24, border)
            setPadding(dp(18), dp(20), dp(18), dp(20))
        }
        val name = modernInput("Nama lengkap")
        val email = modernInput("Email", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS)
        val password = modernInput("Password", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD)
        card.addView(name, lp(bottom = 12)); card.addView(email, lp(bottom = 12)); card.addView(password, lp(bottom = 16))
        card.addView(primaryButton("Daftar") {
            lifecycleScope.launch {
                try {
                    val r = GasApi.post("register", mapOf(
                        "name" to name.text.toString(), "email" to email.text.toString().trim(), "password" to password.text.toString()
                    ))
                    toast(r.optString("message", "Selesai"))
                    if (r.optBoolean("ok")) showLogin()
                } catch (e: Exception) { toast(e.message ?: "Gagal") }
            }
        })
        card.addView(secondaryButton("Kembali ke login") { showLogin() }, lp(top = 10))
        box.addView(card, lp(top = 24))
        setScreen(scroll, box)
    }

    private fun showHome() {
        val (scroll, box) = screen()
        box.addView(TextView(this).apply {
            text = "Halo,"
            textSize = 16f
            setTextColor(muted)
        })
        box.addView(TextView(this).apply {
            text = currentName.ifBlank { currentEmail }
            textSize = 28f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(navy)
            maxLines = 1
        }, lp(top = 2))
        box.addView(TextView(this).apply {
            text = "Apa yang ingin kamu lakukan hari ini?"
            textSize = 15f
            setTextColor(muted)
        }, lp(top = 4, bottom = 22))

        box.addView(infoCard("✉️", "Undangan Ujian", "Lihat undangan dan jadwal ujian", ::showInvitations), lp(bottom = 12))
        box.addView(infoCard("📝", "Kerjakan Ujian", "Mulai ujian yang tersedia", ::showExams), lp(bottom = 12))
        box.addView(infoCard("📊", "Nilai Otomatis", "Lihat hasil dan nilai ujian", ::showResults), lp(bottom = 12))
        box.addView(infoCard("🔔", "Pengingat", "Cek pengingat ujian mendatang", ::showReminders), lp(bottom = 22))
        box.addView(secondaryButton("Keluar") { currentEmail = ""; currentName = ""; showLogin() })
        setScreen(scroll, box)
    }

    private fun showInvitations() = simpleList("Undangan Ujian", "invitations", "📭", "Belum ada undangan untuk saat ini.")

    private fun showExams() {
        lifecycleScope.launch {
            try {
                val r = GasApi.post("exams", mapOf("email" to currentEmail))
                val arr = r.optJSONArray("data") ?: JSONArray()
                val (scroll, box) = screen()
                box.addView(sectionTitle("Daftar Ujian", "Pilih ujian yang ingin dikerjakan"))
                if (arr.length() == 0) emptyState(box, "📝", "Belum ada ujian", "Ujian akan muncul di sini saat tersedia.")
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    if (o.optBoolean("completed")) {
                        val nilai = if (o.isNull("nilai")) "-" else o.optString("nilai")
                        box.addView(
                            infoCard("✅", o.optString("title"), "Sudah dikumpulkan • Nilai: $nilai") {
                                toast("Ujian ini sudah dikumpulkan, tidak bisa dikerjakan ulang.")
                                showResults()
                            },
                            lp(top = 14)
                        )
                    } else {
                        box.addView(
                            infoCard("📝", o.optString("title"), "Durasi ${o.optString("duration")} menit") { showExam(o) },
                            lp(top = 14)
                        )
                    }
                }
                box.addView(secondaryButton("Kembali") { showHome() }, lp(top = 22))
                setScreen(scroll, box)
            } catch (e: Exception) { toast(e.message ?: "Gagal") }
        }
    }

    private fun showExam(exam: JSONObject) {
        lifecycleScope.launch {
            try {
                // Ambil soal sekali untuk sesi ini. Jawaban disimpan berdasarkan QuestionID.
                // "email" disertakan agar server bisa memvalidasi undangan, mengacak
                // urutan soal per siswa, dan melacak/mengembalikan sisa waktu pengerjaan
                // yang sesungguhnya (dihitung di server, bukan di HP).
                val r = GasApi.post(
                    "questions",
                    mapOf("examId" to exam.optString("id"), "email" to currentEmail)
                )

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

                // Sisa waktu SELALU disinkronkan dari server setiap soal dimuat,
                // supaya menutup lalu membuka ulang aplikasi tidak mereset timer.
                startExamTimerFromServer(r.optLong("remainingSeconds", -1L))

                examActive = true
                terminatedShown = false

                // Anti-Cheat & Exam Proctoring: aktifkan sesi memakai konfigurasi
                // yang ditentukan Guru untuk ujian ini (bagian 9 PRD).
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

                renderExamQuestion()
            } catch (e: Exception) {
                toast(e.message ?: "Gagal memuat ujian")
            }
        }
    }

    private fun startExamTimerFromServer(remainingSeconds: Long) {
        examTimer?.cancel()

        if (remainingSeconds <= 0L) {
            examRemainingMillis = 0L
            updateExamTimerText()
            if (examActive && !examSubmitting) {
                toast("Waktu ujian habis. Jawaban akan dikirim otomatis.")
                submitExam(autoSubmit = true)
            }
            return
        }

        examRemainingMillis = remainingSeconds * 1_000L
        updateExamTimerText()

        examTimer = object : CountDownTimer(examRemainingMillis, 1_000L) {
            override fun onTick(millisUntilFinished: Long) {
                examRemainingMillis = millisUntilFinished
                updateExamTimerText()
            }

            override fun onFinish() {
                examRemainingMillis = 0L
                updateExamTimerText()
                if (examActive && !examSubmitting) {
                    toast("Waktu ujian habis. Jawaban akan dikirim otomatis.")
                    submitExam(autoSubmit = true)
                }
            }
        }.start()
    }

    private fun updateExamTimerText() {
        val totalSeconds = (examRemainingMillis / 1_000L).coerceAtLeast(0L)
        val hours = totalSeconds / 3600L
        val minutes = (totalSeconds % 3600L) / 60L
        val seconds = totalSeconds % 60L
        val text = if (hours > 0L) {
            String.format(java.util.Locale.getDefault(), "Sisa waktu %02d:%02d:%02d", hours, minutes, seconds)
        } else {
            String.format(java.util.Locale.getDefault(), "Sisa waktu %02d:%02d", minutes, seconds)
        }
        examTimerText?.text = text
    }

    private fun renderExamQuestion() {
        val exam = activeExam ?: return
        if (examQuestions.length() == 0) return
        val index = examQuestionIndex.coerceIn(0, examQuestions.length() - 1)
        examQuestionIndex = index
        val q = examQuestions.getJSONObject(index)

        val (scroll, box) = screen()
        box.addView(sectionTitle(
            exam.optString("title"),
            "Soal ${index + 1} dari ${examQuestions.length()}"
        ))

        examTimerText = TextView(this).apply {
            textSize = 16f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            setTextColor(blue)
            background = shape(blueSoft, 14)
            setPadding(dp(12), dp(10), dp(12), dp(10))
        }
        box.addView(examTimerText, lp(top = 14))
        updateExamTimerText()

        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = shape(white, 20, border)
            setPadding(dp(16), dp(16), dp(16), dp(16))
        }
        card.addView(TextView(this).apply {
            text = "SOAL ${index + 1}"
            textSize = 12f
            typeface = Typeface.DEFAULT_BOLD
            letterSpacing = 0.08f
            setTextColor(blue)
        })
        card.addView(TextView(this).apply {
            text = q.optString("question")
            textSize = 17f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(appTextColor)
            antiCheat.protectFromCopyPaste(this)
        }, lp(top = 7, bottom = 10))

        val group = RadioGroup(this)
        val questionId = q.optString("id")
        val savedAnswer = examAnswers[questionId]
        for (letter in listOf("A", "B", "C", "D")) {
            val rb = RadioButton(this).apply {
                text = "$letter. ${q.optString("option$letter")}"
                tag = letter
                textSize = 15f
                setTextColor(appTextColor)
                setPadding(dp(4), dp(6), 0, dp(6))
                isChecked = savedAnswer == letter
                antiCheat.protectFromCopyPaste(this)
            }
            group.addView(rb)
        }
        group.setOnCheckedChangeListener { g, checkedId ->
            if (checkedId != -1) {
                val rb = g.findViewById<RadioButton>(checkedId)
                if (rb != null) examAnswers[questionId] = rb.tag.toString()
            }
        }
        card.addView(group)
        box.addView(card, lp(top = 16))

        val nav = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }

        if (index > 0) {
            nav.addView(secondaryButton("Sebelumnya") {
                if (!examSubmitting) {
                    examQuestionIndex--
                    renderExamQuestion()
                }
            }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                rightMargin = dp(6)
            })
        }

        if (index < examQuestions.length() - 1) {
            nav.addView(primaryButton("Berikutnya") {
                if (!examSubmitting) {
                    examQuestionIndex++
                    renderExamQuestion()
                }
            }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                leftMargin = if (index > 0) dp(6) else 0
            })
        } else {
            nav.addView(primaryButton("Kirim Jawaban") {
                if (!examSubmitting) confirmSubmitExam()
            }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                leftMargin = if (index > 0) dp(6) else 0
            })
        }
        box.addView(nav, lp(top = 20))

        setScreen(scroll, box)
    }

    /**
     * Dialog sebelum benar-benar mengirim jawaban.
     *
     * Kalau masih ada soal yang belum dijawab, kirim jawaban DIBLOKIR —
     * siswa diarahkan kembali ke soal pertama yang belum dijawab supaya
     * diperiksa dulu, bukan ditawari opsi "kirim saja walau belum lengkap".
     */
    private fun confirmSubmitExam() {
        val total = examQuestions.length()
        val unansweredIndexes = (0 until total).filter { idx ->
            val questionId = examQuestions.getJSONObject(idx).optString("id")
            !examAnswers.containsKey(questionId)
        }

        if (unansweredIndexes.isNotEmpty()) {
            val nomorSoal = unansweredIndexes.joinToString(", ") { (it + 1).toString() }
            AlertDialog.Builder(this)
                .setTitle("Masih Ada Soal Belum Dijawab")
                .setMessage(
                    "Ada ${unansweredIndexes.size} dari $total soal yang belum dijawab " +
                        "(nomor $nomorSoal).\n\nJawaban belum bisa dikirim. Jawab dulu semua " +
                        "soal, baru kirim."
                )
                .setPositiveButton("Periksa Soal") { _, _ ->
                    examQuestionIndex = unansweredIndexes.first()
                    renderExamQuestion()
                }
                .setCancelable(true)
                .show()
            return
        }

        AlertDialog.Builder(this)
            .setTitle("Kirim Jawaban Ujian?")
            .setMessage(
                "Semua $total soal sudah dijawab. Setelah dikirim, jawaban tidak bisa diubah lagi.\n\n" +
                    "Yakin ingin mengirim jawaban sekarang?"
            )
            .setPositiveButton("Kirim") { _, _ -> submitExam() }
            .setNegativeButton("Batal, cek lagi", null)
            .setCancelable(true)
            .show()
    }

    private fun submitExam(autoSubmit: Boolean = false) {
        if (examSubmitting) return
        val exam = activeExam ?: return
        examSubmitting = true

        // Tampilkan layar proses sehingga tombol tidak bisa ditekan berulang.
        val (scroll, box) = screen()
        box.gravity = Gravity.CENTER
        box.addView(TextView(this).apply {
            text = "Mengirim jawaban..."
            textSize = 20f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            setTextColor(appTextColor)
        })
        box.addView(TextView(this).apply {
            text = "Mohon tunggu sampai hasil pengiriman diterima."
            textSize = 14f
            gravity = Gravity.CENTER
            setTextColor(muted)
        }, lp(top = 8))
        setScreen(scroll, box)

        lifecycleScope.launch {
            try {
                val answersJson = JSONObject()
                examAnswers.forEach { (questionId, answer) -> answersJson.put(questionId, answer) }
                val res = GasApi.post("submit", mapOf(
                    "email" to currentEmail,
                    "examId" to exam.optString("id"),
                    "answers" to answersJson.toString()
                ))
                if (res.optBoolean("ok")) {
                    examTimer?.cancel()
                    examTimer = null
                    examTimerText = null
                    examRemainingMillis = 0L
                    examActive = false
                    activeExam = null
                    examQuestions = JSONArray()
                    examAnswers.clear()
                    examQuestionIndex = 0
                    examSubmitting = false
                    antiCheat.stopSession()
                    toast(res.optString("message", "Jawaban berhasil dikirim"))
                    showHome()
                } else {
                    examSubmitting = false
                    toast(res.optString("message", "Gagal mengirim jawaban"))
                    renderExamQuestion()
                }
            } catch (e: Exception) {
                examSubmitting = false
                toast(e.message ?: "Gagal mengirim jawaban")
                // Jawaban tetap berada di examAnswers agar siswa tidak mengulang.
                renderExamQuestion()
            }
        }
    }

    private fun emptyState(box: LinearLayout, icon: String, title: String, subtitle: String) {
        box.addView(LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            background = shape(white, 22, border)
            setPadding(dp(24), dp(30), dp(24), dp(30))
            addView(TextView(this@MainActivity).apply { text = icon; textSize = 42f; gravity = Gravity.CENTER })
            addView(TextView(this@MainActivity).apply {
                text = title; textSize = 18f; typeface = Typeface.DEFAULT_BOLD; gravity = Gravity.CENTER; setTextColor(appTextColor)
            }, lp(top = 8))
            addView(TextView(this@MainActivity).apply {
                text = subtitle; textSize = 14f; gravity = Gravity.CENTER; setTextColor(muted)
            }, lp(top = 4))
        }, lp(top = 22))
    }

    private fun showResults() = simpleList("Hasil & Nilai", "results", "📊", "Belum ada hasil ujian.")
    private fun showReminders() = simpleList("Pengingat Ujian", "reminders", "🔔", "Belum ada pengingat.")

    private fun simpleList(header: String, action: String, icon: String, empty: String) {
        lifecycleScope.launch {
            try {
                val r = GasApi.post(action, mapOf("email" to currentEmail))
                val arr = r.optJSONArray("data") ?: JSONArray()
                val (scroll, box) = screen()
                box.addView(sectionTitle(header))
                if (arr.length() == 0) emptyState(box, icon, empty, "Silakan cek kembali nanti.")
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    box.addView(LinearLayout(this@MainActivity).apply {
                        orientation = LinearLayout.VERTICAL
                        background = shape(white, 18, border)
                        setPadding(dp(16), dp(16), dp(16), dp(16))
                        addView(TextView(this@MainActivity).apply {
                            text = o.optString("text", o.toString())
                            textSize = 16f
                            setTextColor(appTextColor)
                        })
                    }, lp(top = 14))
                }
                box.addView(secondaryButton("Kembali ke menu") { showHome() }, lp(top = 22))
                setScreen(scroll, box)
            } catch (e: Exception) { toast(e.message ?: "Gagal") }
        }
    }

    private fun toast(s: String) = Toast.makeText(this, s, Toast.LENGTH_LONG).show()
}
