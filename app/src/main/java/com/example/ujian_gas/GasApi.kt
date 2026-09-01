package com.example.ujian_gas

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.FormBody
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject

/**
 * API untuk menghubungkan aplikasi Android
 * dengan Google Apps Script Web App.
 */
object GasApi {

    // Backend utama Android: Admin Guru / Code.gs.
    // Login, register, daftar ujian, soal, submit, dan hasil memakai database Admin Guru.
    private const val GAS_WEB_APP_URL =
        "https://script.google.com/macros/s/AKfycbwZSv8kIzzKo9q0krkNruTkeF4r3mPd0bWek2CVd5kCPM1LU5JgfVhYmsCYh7rNfuyK/exec"

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
        .readTimeout(120, java.util.concurrent.TimeUnit.SECONDS)
        .writeTimeout(120, java.util.concurrent.TimeUnit.SECONDS)
        .callTimeout(150, java.util.concurrent.TimeUnit.SECONDS)
        .build()

    /**
     * Mengirim request POST ke Google Apps Script.
     *
     * @param action nama action yang diproses oleh GAS
     * @param params parameter tambahan
     * @return response JSON dari GAS
     */
    suspend fun post(
        action: String,
        params: Map<String, String> = emptyMap()
    ): JSONObject = withContext(Dispatchers.IO) {

        require(GAS_WEB_APP_URL.startsWith("https://")) {
            "GAS_WEB_APP_URL belum diisi."
        }

        val body = FormBody.Builder()
            .add("action", action)
            .apply {
                params.forEach { (key, value) ->
                    add(key, value)
                }
            }
            .build()

        val request = Request.Builder()
            .url(GAS_WEB_APP_URL)
            .post(body)
            .build()

        client.newCall(request).execute().use { response ->

            val raw = response.body?.string().orEmpty()

            if (!response.isSuccessful) {
                error("HTTP ${response.code}: $raw")
            }

            if (raw.isBlank()) {
                error("Response dari Google Apps Script kosong.")
            }

            try {
                JSONObject(raw)
            } catch (e: Exception) {
                error("Response GAS bukan JSON yang valid: $raw")
            }
        }
    }
}
