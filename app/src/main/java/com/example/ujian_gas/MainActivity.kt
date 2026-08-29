package com.example.ujian_gas

import android.os.Bundle
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

class MainActivity : AppCompatActivity() {
    private lateinit var root: LinearLayout
    private var currentEmail = ""
    private var currentName = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        showLogin()
    }

    private fun base(): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(32, 28, 32, 24)
        setBackgroundColor(getColor(R.color.bg))
    }

    private fun title(text: String): TextView = TextView(this).apply {
        this.text = text
        textSize = 28f
        setTextColor(getColor(R.color.navy))
        setTypeface(null, 1)
        setPadding(0, 0, 0, 16)
    }

    private fun button(text: String, onClick: () -> Unit) = Button(this).apply {
        this.text = text
        setOnClickListener { onClick() }
        isAllCaps = false
    }

    private fun showLogin() {
        root = base()
        root.addView(title("Ujian GAS"))
        root.addView(TextView(this).apply {
            text = "Aplikasi ujian siswa • Google Apps Script"
            textSize = 16f
            setTextColor(getColor(R.color.muted))
        })
        val email = EditText(this).apply { hint = "Email"; inputType = 33 }
        val password = EditText(this).apply { hint = "Password"; inputType = 129 }
        root.addView(email)
        root.addView(password)
        root.addView(button("Masuk") {
            if (email.text.isBlank() || password.text.isBlank()) {
                toast("Email dan password wajib diisi"); return@button
            }
            loading(true)
            lifecycleScope.launch {
                try {
                    val r = GasApi.post("login", mapOf(
                        "email" to email.text.toString().trim(),
                        "password" to password.text.toString()
                    ))
                    loading(false)
                    if (r.optBoolean("ok")) {
                        currentEmail = email.text.toString().trim()
                        currentName = r.optString("name", currentEmail)
                        showHome()
                    } else toast(r.optString("message", "Login gagal"))
                } catch (e: Exception) {
                    loading(false); toast(e.message ?: "Gagal terhubung")
                }
            }
        })
        root.addView(button("Daftar akun") { showRegister() })
        setContentView(root)
    }

    private fun showRegister() {
        root = base()
        root.addView(title("Daftar Akun"))
        val name = EditText(this).apply { hint = "Nama lengkap" }
        val email = EditText(this).apply { hint = "Email"; inputType = 33 }
        val password = EditText(this).apply { hint = "Password"; inputType = 129 }
        root.addView(name); root.addView(email); root.addView(password)
        root.addView(button("Daftar") {
            lifecycleScope.launch {
                try {
                    val r = GasApi.post("register", mapOf(
                        "name" to name.text.toString(),
                        "email" to email.text.toString().trim(),
                        "password" to password.text.toString()
                    ))
                    toast(r.optString("message", "Selesai"))
                    if (r.optBoolean("ok")) showLogin()
                } catch (e: Exception) { toast(e.message ?: "Gagal") }
            }
        })
        root.addView(button("Kembali") { showLogin() })
        setContentView(root)
    }

    private fun showHome() {
        root = base()
        root.addView(title("Halo, $currentName"))
        root.addView(TextView(this).apply {
            text = "Menu utama"
            textSize = 18f
        })
        root.addView(button("📨 Undangan Ujian") { showInvitations() })
        root.addView(button("📝 Kerjakan Ujian") { showExams() })
        root.addView(button("📊 Nilai Otomatis") { showResults() })
        root.addView(button("🔔 Pengingat Ujian") { showReminders() })
        root.addView(button("Keluar") { currentEmail = ""; showLogin() })
        setContentView(root)
    }

    private fun showInvitations() {
        simpleList("Undangan Ujian", "invitations", "Belum ada undangan.")
    }

    private fun showExams() {
        loading(true)
        lifecycleScope.launch {
            try {
                val r = GasApi.post("exams")
                loading(false)
                val arr = r.optJSONArray("data") ?: JSONArray()
                val list = base()
                list.addView(title("Daftar Ujian"))
                if (arr.length() == 0) list.addView(TextView(this@MainActivity).apply {
                    text = "Belum ada ujian."
                })
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    list.addView(button("${o.optString("title")} • ${o.optString("duration")} menit") {
                        showExam(o)
                    })
                }
                list.addView(button("Kembali") { showHome() })
                setContentView(list)
            } catch (e: Exception) { loading(false); toast(e.message ?: "Gagal") }
        }
    }

    private fun showExam(exam: JSONObject) {
        loading(true)
        lifecycleScope.launch {
            try {
                val r = GasApi.post("questions", mapOf("examId" to exam.optString("id")))
                loading(false)
                val qs = r.optJSONArray("data") ?: JSONArray()
                val answers = mutableMapOf<String, String>()
                val view = ScrollView(this@MainActivity)
                val box = base()
                box.addView(title(exam.optString("title")))
                for (i in 0 until qs.length()) {
                    val q = qs.getJSONObject(i)
                    val group = RadioGroup(this@MainActivity)
                    val question = TextView(this@MainActivity).apply {
                        text = "${i + 1}. ${q.optString("question")}"
                        textSize = 17f
                        setPadding(0, 14, 0, 6)
                    }
                    box.addView(question)
                    val opts = listOf("A","B","C","D")
                    for (letter in opts) {
                        val key = "option$letter"
                        val rb = RadioButton(this@MainActivity).apply {
                            text = "$letter. ${q.optString(key)}"
                            tag = letter
                        }
                        group.addView(rb)
                    }
                    group.setOnCheckedChangeListener { g, checkedId ->
                        val rb = g.findViewById<RadioButton>(checkedId)
                        if (rb != null) answers[q.optString("id")] = rb.tag.toString()
                    }
                    box.addView(group)
                }
                box.addView(button("Kirim Jawaban") {
                    val payload = JSONObject(answers as Map<*, *>).toString()
                    lifecycleScope.launch {
                        try {
                            val res = GasApi.post("submit", mapOf(
                                "email" to currentEmail,
                                "examId" to exam.optString("id"),
                                "answers" to payload
                            ))
                            toast(res.optString("message", "Jawaban terkirim"))
                            if (res.optBoolean("ok")) showHome()
                        } catch (e: Exception) { toast(e.message ?: "Gagal mengirim") }
                    }
                })
                box.addView(button("Kembali") { showExams() })
                view.addView(box)
                setContentView(view)
            } catch (e: Exception) { loading(false); toast(e.message ?: "Gagal") }
        }
    }

    private fun showResults() = simpleList("Hasil & Nilai", "results", "Belum ada hasil.")
    private fun showReminders() = simpleList("Pengingat Ujian", "reminders", "Belum ada pengingat.")

    private fun simpleList(header: String, action: String, empty: String) {
        loading(true)
        lifecycleScope.launch {
            try {
                val r = GasApi.post(action, mapOf("email" to currentEmail))
                loading(false)
                val arr = r.optJSONArray("data") ?: JSONArray()
                val v = base()
                v.addView(title(header))
                if (arr.length() == 0) v.addView(TextView(this@MainActivity).apply { text = empty })
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    v.addView(TextView(this@MainActivity).apply {
                        text = o.optString("text", o.toString())
                        textSize = 16f
                        setPadding(0, 14, 0, 14)
                    })
                }
                v.addView(button("Kembali") { showHome() })
                setContentView(v)
            } catch (e: Exception) { loading(false); toast(e.message ?: "Gagal") }
        }
    }

    private fun loading(show: Boolean) {
        // MVP: toast status; UI tetap sederhana agar mudah dibuild di GitHub.
    }

    private fun toast(s: String) = Toast.makeText(this, s, Toast.LENGTH_LONG).show()
}
