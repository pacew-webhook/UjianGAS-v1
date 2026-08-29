package com.example.ujian_gas

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.FormBody
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject

/**
 * Ganti GAS_WEB_APP_URL dengan URL Deploy as Web App dari Google Apps Script.
 */
object GasApi {
    private const val GAS_WEB_APP_URL = "PASTE_GAS_WEB_APP_URL_HERE"
    private val client = OkHttpClient()

    suspend fun post(action: String, params: Map<String, String> = emptyMap()): JSONObject =
        withContext(Dispatchers.IO) {
            require(GAS_WEB_APP_URL.startsWith("https://")) {
                "GAS_WEB_APP_URL belum diisi."
            }
            val body = FormBody.Builder().apply {
                add("action", action)
                params.forEach { (k, v) -> add(k, v) }
            }.build()

            val request = Request.Builder()
                .url(GAS_WEB_APP_URL)
                .post(body)
                .build()

            client.newCall(request).execute().use { response ->
                val raw = response.body?.string().orEmpty()
                if (!response.isSuccessful) error("HTTP ${response.code}: $raw")
                JSONObject(raw)
            }
        }
}
