package com.example.ujian_gas

import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.setPadding
import androidx.lifecycle.lifecycleScope
import com.google.android.material.button.MaterialButton
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

class MainActivity : AppCompatActivity() {
    private lateinit var root: LinearLayout
    private var currentEmail = ""
    private var currentName = ""

    private val navy = Color.parseColor("#14213D")
    private val blue = Color.parseColor("#2563EB")
    private val blueSoft = Color.parseColor("#EFF6FF")
    private val bg = Color.parseColor("#F6F8FC")
    private val appTextColor = Color.parseColor("#172033")
    private val muted = Color.parseColor("#64748B")
    private val border = Color.parseColor("#E2E8F0")
    private val white = Color.WHITE

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        showLogin()
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
                val r = GasApi.post("exams")
                val arr = r.optJSONArray("data") ?: JSONArray()
                val (scroll, box) = screen()
                box.addView(sectionTitle("Daftar Ujian", "Pilih ujian yang ingin dikerjakan"))
                if (arr.length() == 0) emptyState(box, "📝", "Belum ada ujian", "Ujian akan muncul di sini saat tersedia.")
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    box.addView(infoCard("📝", o.optString("title"), "Durasi ${o.optString("duration")} menit") { showExam(o) }, lp(top = 14))
                }
                box.addView(secondaryButton("Kembali") { showHome() }, lp(top = 22))
                setScreen(scroll, box)
            } catch (e: Exception) { toast(e.message ?: "Gagal") }
        }
    }

    private fun showExam(exam: JSONObject) {
        lifecycleScope.launch {
            try {
                val r = GasApi.post("questions", mapOf("examId" to exam.optString("id")))
                val qs = r.optJSONArray("data") ?: JSONArray()
                val answers = mutableMapOf<String, String>()
                val (scroll, box) = screen()
                box.addView(sectionTitle(exam.optString("title"), "Jawab semua pertanyaan sebelum mengirim"))

                for (i in 0 until qs.length()) {
                    val q = qs.getJSONObject(i)
                    val card = LinearLayout(this@MainActivity).apply {
                        orientation = LinearLayout.VERTICAL
                        background = shape(white, 20, border)
                        setPadding(dp(16), dp(16), dp(16), dp(16))
                    }
                    card.addView(TextView(this@MainActivity).apply {
                        text = "SOAL ${i + 1}"
                        textSize = 12f
                        typeface = Typeface.DEFAULT_BOLD
                        letterSpacing = 0.08f
                        setTextColor(blue)
                    })
                    card.addView(TextView(this@MainActivity).apply {
                        text = q.optString("question")
                        textSize = 17f
                        typeface = Typeface.DEFAULT_BOLD
                        setTextColor(appTextColor)
                    }, lp(top = 7, bottom = 10))

                    val group = RadioGroup(this@MainActivity)
                    for (letter in listOf("A", "B", "C", "D")) {
                        val rb = RadioButton(this@MainActivity).apply {
                            text = "$letter. ${q.optString("option$letter")}" 
                            tag = letter
                            textSize = 15f
                            setTextColor(appTextColor)
                            setPadding(dp(4), dp(6), 0, dp(6))
                        }
                        group.addView(rb)
                    }
                    group.setOnCheckedChangeListener { g, checkedId ->
                        val rb = g.findViewById<RadioButton>(checkedId)
                        if (rb != null) answers[q.optString("id")] = rb.tag.toString()
                    }
                    card.addView(group)
                    box.addView(card, lp(top = 16))
                }
                box.addView(primaryButton("Kirim Jawaban") {
                    lifecycleScope.launch {
                        try {
                            val payload = JSONObject(answers as Map<*, *>).toString()
                            val res = GasApi.post("submit", mapOf(
                                "email" to currentEmail, "examId" to exam.optString("id"), "answers" to payload
                            ))
                            toast(res.optString("message", "Jawaban terkirim"))
                            if (res.optBoolean("ok")) showHome()
                        } catch (e: Exception) { toast(e.message ?: "Gagal mengirim") }
                    }
                }, lp(top = 24))
                box.addView(secondaryButton("Kembali") { showExams() }, lp(top = 10))
                setScreen(scroll, box)
            } catch (e: Exception) { toast(e.message ?: "Gagal") }
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
