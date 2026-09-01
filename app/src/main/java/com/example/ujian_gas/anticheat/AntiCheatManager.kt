package com.example.ujian_gas.anticheat

import android.app.Activity
import android.app.ActivityManager
import android.content.Context
import android.os.Build
import android.view.View
import android.view.WindowManager
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.example.ujian_gas.GasApi
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

/**
 * Implementasi PRD_UjianGAS_AntiCheat_Exam_Proctoring.md, bagian Android (3.1).
 *
 * Anti-Cheat TIDAK dianggap satu-satunya sumber kebenaran: setiap event yang
 * dikirim ke server (lihat bagian 17 PRD) divalidasi ulang oleh backend dan
 * status sesi (ACTIVE/WARNING/LOCKED/TERMINATED) yang berlaku adalah status
 * yang dikembalikan server, bukan hitungan lokal semata.
 */

/** Konfigurasi Anti-Cheat per ujian (bagian 9 PRD), dikirim server bersama soal. */
data class AntiCheatConfig(
    val antiCheatOn: Boolean = true,
    val examLockOn: Boolean = true,
    val preventScreenshot: Boolean = true,
    val preventScreenRecording: Boolean = true,
    val preventCopyPaste: Boolean = true,
    val detectBackground: Boolean = true,
    val detectSplitScreen: Boolean = true,
    val maxViolations: Int = 3,
    val actionAfterLimit: String = "LOCK",
    val requireSupervisorPin: Boolean = true
) {
    companion object {
        fun fromJson(o: JSONObject?): AntiCheatConfig {
            if (o == null) return AntiCheatConfig()
            return AntiCheatConfig(
                antiCheatOn = o.optBoolean("antiCheatOn", true),
                examLockOn = o.optBoolean("examLockOn", true),
                preventScreenshot = o.optBoolean("preventScreenshot", true),
                preventScreenRecording = o.optBoolean("preventScreenRecording", true),
                preventCopyPaste = o.optBoolean("preventCopyPaste", true),
                detectBackground = o.optBoolean("detectBackground", true),
                detectSplitScreen = o.optBoolean("detectSplitScreen", true),
                maxViolations = o.optInt("maxViolations", 3),
                actionAfterLimit = o.optString("actionAfterLimit", "LOCK"),
                requireSupervisorPin = o.optBoolean("requireSupervisorPin", true)
            )
        }
    }
}

/** Tipe event sesuai bagian 6 & 7 PRD. */
object ViolationType {
    const val APP_BACKGROUND = "APP_BACKGROUND"
    const val SPLIT_SCREEN = "SPLIT_SCREEN"
    const val MULTI_WINDOW = "MULTI_WINDOW"
    const val SCREEN_CAPTURE_ATTEMPT = "SCREEN_CAPTURE_ATTEMPT"
}

interface AntiCheatListener {
    /** Pelanggaran ringan tercatat, ujian TETAP berjalan. */
    fun onExamWarning(violationType: String, count: Int, max: Int)

    /** Batas pelanggaran tercapai / dikunci pengawas -> tampilkan layar PIN. */
    fun onExamLocked()

    /** Ujian dihentikan permanen (pelanggaran berat / force submit / dikunci server). */
    fun onExamTerminated(message: String)

    /** Sesi berhasil dibuka kembali dengan PIN Pengawas. */
    fun onExamUnlocked()
}

/**
 * Antrian pelanggaran offline (bagian 16 PRD): event penting tidak boleh
 * hilang hanya karena koneksi sementara terputus. Disimpan di SharedPreferences
 * sebagai array JSON sederhana lalu dikirim ulang lewat action `violation_batch`
 * begitu koneksi pulih (dicoba setiap heartbeat).
 */
private class OfflineViolationQueue(context: Context) {
    private val prefs = context.getSharedPreferences("anticheat_queue", Context.MODE_PRIVATE)
    private val key = "pending_violations"

    @Synchronized
    fun enqueue(item: JSONObject) {
        val arr = readAll()
        arr.put(item)
        prefs.edit().putString(key, arr.toString()).apply()
    }

    @Synchronized
    fun readAll(): JSONArray {
        val raw = prefs.getString(key, "[]") ?: "[]"
        return try { JSONArray(raw) } catch (e: Exception) { JSONArray() }
    }

    @Synchronized
    fun clear() {
        prefs.edit().remove(key).apply()
    }

    @Synchronized
    fun isEmpty(): Boolean = readAll().length() == 0
}

class AntiCheatManager(
    private val activity: Activity,
    private val scope: CoroutineScope,
    private val listener: AntiCheatListener
) {
    private var config: AntiCheatConfig = AntiCheatConfig()
    private var email: String = ""
    private var examId: String = ""
    private var sessionId: String = ""
    private var appVersion: String = "1.0"

    /** Status sesi terakhir yang diketahui dari SERVER (bukan hitungan lokal). */
    @Volatile var lastKnownStatus: String = "ACTIVE"
        private set

    @Volatile var lastKnownViolationCount: Int = 0
        private set

    @Volatile var examActive: Boolean = false
        private set

    private var heartbeatJob: Job? = null
    private var remainingSecondsProvider: () -> Long = { -1L }
    private val offlineQueue by lazy { OfflineViolationQueue(activity) }

    /** Dipanggil MainActivity saat soal ujian berhasil dimuat dan sesi dibuat di server. */
    fun startSession(
        email: String,
        examId: String,
        sessionId: String,
        config: AntiCheatConfig,
        initialViolationCount: Int,
        initialStatus: String,
        remainingSecondsProvider: () -> Long
    ) {
        this.email = email
        this.examId = examId
        this.sessionId = sessionId
        this.config = config
        this.lastKnownViolationCount = initialViolationCount
        this.lastKnownStatus = initialStatus.ifBlank { "ACTIVE" }
        this.remainingSecondsProvider = remainingSecondsProvider
        this.examActive = config.antiCheatOn

        applyWindowProtections()
        tryEnterLockTask()
        startHeartbeatLoop()
        flushOfflineQueue()

        if (lastKnownStatus == "LOCKED") {
            listener.onExamLocked()
        } else if (lastKnownStatus == "TERMINATED") {
            listener.onExamTerminated("Ujian ini telah dihentikan oleh sistem/pengawas.")
        }
    }

    /** Dipanggil saat ujian selesai (submit sukses) atau siswa keluar dari layar ujian. */
    fun stopSession() {
        examActive = false
        stopHeartbeatLoop()
        tryExitLockTask()
        removeWindowProtections()
    }

    // ---------------------------------------------------------------------
    // Deteksi App Background (bagian 6.3 PRD)
    // ---------------------------------------------------------------------

    /** Panggil dari Activity.onPause(). */
    fun onActivityPaused() {
        if (!examActive || !config.detectBackground) return
        if (activity.isChangingConfigurations) return
        reportViolation(ViolationType.APP_BACKGROUND, "WARNING", "Aplikasi ujian kehilangan fokus / masuk background.")
    }

    fun onActivityResumed() {
        if (!examActive) return
        // Selalu sinkron ulang status begitu kembali ke foreground, siapa tahu
        // Guru mengunci/force-submit dari dashboard saat siswa tidak aktif.
        scope.launch { syncStatus() }
    }

    // ---------------------------------------------------------------------
    // Deteksi Split Screen / Multi-Window (bagian 6.4 & 6.5 PRD)
    // ---------------------------------------------------------------------

    fun onMultiWindowModeChanged(isInMultiWindowMode: Boolean) {
        if (!examActive || !config.detectSplitScreen) return
        if (isInMultiWindowMode) {
            reportViolation(ViolationType.SPLIT_SCREEN, "WARNING", "Perangkat masuk mode split-screen/multi-window.")
        }
    }

    fun checkMultiWindowNow() {
        if (!examActive || !config.detectSplitScreen) return
        if (activity.isInMultiWindowMode) {
            reportViolation(ViolationType.MULTI_WINDOW, "WARNING", "Aplikasi berjalan dalam mode multi-window.")
        }
    }

    // ---------------------------------------------------------------------
    // Screenshot / Screen Recording Protection (bagian 6.6 & 6.7 PRD)
    // Exam Full Screen (bagian 6.1 PRD)
    // ---------------------------------------------------------------------

    fun applyWindowProtections() {
        if (config.preventScreenshot || config.preventScreenRecording) {
            // FLAG_SECURE mencegah screenshot, screen recording, DAN thumbnail
            // di Recent Apps sekaligus -- ini mekanisme resmi Android untuk
            // "layar sensitif" (bagian 6.6/6.7 PRD).
            activity.window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
        }
        if (config.examLockOn) enterFullScreen()
    }

    fun removeWindowProtections() {
        activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        exitFullScreen()
    }

    private fun enterFullScreen() {
        val window = activity.window
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val controller = WindowCompat.getInsetsController(window, window.decorView)
        controller.hide(WindowInsetsCompat.Type.systemBars())
        controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }

    private fun exitFullScreen() {
        val window = activity.window
        WindowCompat.setDecorFitsSystemWindows(window, true)
        val controller = WindowCompat.getInsetsController(window, window.decorView)
        controller.show(WindowInsetsCompat.Type.systemBars())
    }

    // ---------------------------------------------------------------------
    // Lock Task / Kiosk Mode (bagian 6.2 PRD)
    // CATATAN PRD: tidak semua perangkat Android dapat dikunci secara absolut
    // tanpa Device Owner/Profile Owner. Ini best-effort "screen pinning" biasa,
    // dibungkus try-catch supaya tidak pernah meng-crash aplikasi.
    // ---------------------------------------------------------------------

    private fun tryEnterLockTask() {
        if (!config.examLockOn) return
        try {
            val am = activity.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
            val locked = am?.lockTaskModeState
            if (locked == ActivityManager.LOCK_TASK_MODE_NONE || locked == null) {
                activity.startLockTask()
            }
        } catch (e: Exception) {
            // Perangkat tidak mendukung / pengguna belum mengizinkan screen pinning.
            // Fitur lain (full screen, FLAG_SECURE, deteksi background) tetap aktif.
        }
    }

    private fun tryExitLockTask() {
        try {
            val am = activity.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
            if (am?.lockTaskModeState != ActivityManager.LOCK_TASK_MODE_NONE) {
                activity.stopLockTask()
            }
        } catch (e: Exception) {
            // Tidak sedang dalam lock task / tidak didukung. Aman diabaikan.
        }
    }

    // ---------------------------------------------------------------------
    // Copy / Paste Protection (bagian 6.8 PRD)
    // ---------------------------------------------------------------------

    /** Terapkan ke TextView soal/opsi jawaban supaya tidak bisa di-copy. */
    fun protectFromCopyPaste(view: View) {
        if (!config.preventCopyPaste) return
        view.isLongClickable = false
        view.setOnLongClickListener { true } // konsumsi long-press, blokir menu copy
        if (view is android.widget.TextView) {
            view.setTextIsSelectable(false)
            view.customSelectionActionModeCallback = NO_OP_ACTION_MODE
        }
    }

    private val NO_OP_ACTION_MODE = object : android.view.ActionMode.Callback {
        override fun onCreateActionMode(mode: android.view.ActionMode?, menu: android.view.Menu?) = false
        override fun onPrepareActionMode(mode: android.view.ActionMode?, menu: android.view.Menu?) = false
        override fun onActionItemClicked(mode: android.view.ActionMode?, item: android.view.MenuItem?) = false
        override fun onDestroyActionMode(mode: android.view.ActionMode?) {}
    }

    // ---------------------------------------------------------------------
    // Sistem Pelanggaran (bagian 7, 8, 19 PRD)
    // ---------------------------------------------------------------------

    private fun reportViolation(type: String, severity: String, description: String) {
        if (sessionId.isBlank() || examId.isBlank() || email.isBlank()) return

        val payload = JSONObject().apply {
            put("examId", examId)
            put("sessionId", sessionId)
            put("type", type)
            put("severity", severity)
            put("description", description)
            put("device", Build.MANUFACTURER + " " + Build.MODEL)
            put("appVersion", appVersion)
        }

        scope.launch {
            try {
                val r = GasApi.post(
                    "violation",
                    mapOf(
                        "email" to email,
                        "examId" to examId,
                        "sessionId" to sessionId,
                        "type" to type,
                        "severity" to severity,
                        "description" to description,
                        "device" to (Build.MANUFACTURER + " " + Build.MODEL),
                        "appVersion" to appVersion
                    )
                )
                if (r.optBoolean("ok")) {
                    applyServerViolationResult(type, r.optInt("violationCount", lastKnownViolationCount + 1), r.optString("status", lastKnownStatus))
                } else {
                    offlineQueue.enqueue(payload)
                }
            } catch (e: Exception) {
                // Koneksi terputus sementara: simpan di ViolationQueue lokal,
                // JANGAN hilangkan event (bagian 16 PRD).
                offlineQueue.enqueue(payload)
                // Tetap beri peringatan lokal supaya siswa tahu ada pelanggaran
                // walau server belum bisa dihubungi; jumlah final tetap dari server.
                listener.onExamWarning(type, lastKnownViolationCount + 1, config.maxViolations)
            }
        }
    }

    private fun applyServerViolationResult(type: String, count: Int, status: String) {
        lastKnownViolationCount = count
        val upper = status.uppercase()
        lastKnownStatus = upper
        when (upper) {
            "LOCKED" -> listener.onExamLocked()
            "TERMINATED" -> listener.onExamTerminated("Batas pelanggaran berat tercapai. Jawaban terakhir telah disimpan.")
            "WARNING", "ACTIVE" -> listener.onExamWarning(type, count, config.maxViolations)
        }
    }

    // ---------------------------------------------------------------------
    // PIN Pengawas (bagian 10 PRD)
    // ---------------------------------------------------------------------

    fun attemptUnlock(pin: String, onResult: (success: Boolean, message: String) -> Unit) {
        scope.launch {
            try {
                val r = GasApi.post(
                    "unlock",
                    mapOf("email" to email, "examId" to examId, "sessionId" to sessionId, "pin" to pin)
                )
                if (r.optBoolean("ok")) {
                    lastKnownStatus = r.optString("status", "ACTIVE")
                    if (lastKnownStatus == "ACTIVE") listener.onExamUnlocked()
                    onResult(true, r.optString("message", "Ujian dibuka kembali."))
                } else {
                    onResult(false, r.optString("message", "PIN Pengawas salah."))
                }
            } catch (e: Exception) {
                onResult(false, e.message ?: "Gagal terhubung ke server.")
            }
        }
    }

    // ---------------------------------------------------------------------
    // Heartbeat (bagian 15 PRD) + flush offline queue
    // ---------------------------------------------------------------------

    private fun startHeartbeatLoop() {
        stopHeartbeatLoop()
        heartbeatJob = scope.launch {
            while (isActive && examActive) {
                delay(15_000L)
                if (!examActive) break
                syncStatus()
                flushOfflineQueue()
            }
        }
    }

    private fun stopHeartbeatLoop() {
        heartbeatJob?.cancel()
        heartbeatJob = null
    }

    private suspend fun syncStatus() {
        if (sessionId.isBlank()) return
        try {
            val r = GasApi.post(
                "heartbeat",
                mapOf(
                    "email" to email,
                    "examId" to examId,
                    "sessionId" to sessionId,
                    "remainingSeconds" to remainingSecondsProvider().toString(),
                    "appState" to if (examActive) "FOREGROUND" else "BACKGROUND"
                )
            )
            if (r.optBoolean("ok")) {
                val status = r.optString("status", lastKnownStatus).uppercase()
                val count = r.optInt("violationCount", lastKnownViolationCount)
                val statusChangedToLocked = status == "LOCKED" && lastKnownStatus != "LOCKED"
                val statusChangedToTerminated = status == "TERMINATED" && lastKnownStatus != "TERMINATED"
                lastKnownStatus = status
                lastKnownViolationCount = count
                if (statusChangedToLocked) listener.onExamLocked()
                if (statusChangedToTerminated) listener.onExamTerminated("Ujian dihentikan oleh pengawas.")
            }
        } catch (e: Exception) {
            // Heartbeat gagal karena koneksi -> bukan bukti kecurangan (bagian 15 PRD),
            // cukup dicoba lagi pada interval berikutnya.
        }
    }

    private fun flushOfflineQueue() {
        if (offlineQueue.isEmpty()) return
        scope.launch {
            try {
                val items = offlineQueue.readAll()
                val r = GasApi.post(
                    "violation_batch",
                    mapOf("email" to email, "items" to items.toString())
                )
                if (r.optBoolean("ok")) {
                    offlineQueue.clear()
                    applyServerViolationResult(
                        "OFFLINE_BATCH",
                        r.optInt("violationCount", lastKnownViolationCount),
                        r.optString("status", lastKnownStatus)
                    )
                }
            } catch (e: Exception) {
                // Coba lagi pada heartbeat berikutnya.
            }
        }
    }
}
