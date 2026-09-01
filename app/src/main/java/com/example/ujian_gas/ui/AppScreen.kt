package com.example.ujian_gas.ui

import org.json.JSONObject

/** Representasi layar aktif aplikasi (menggantikan setContentView manual). */
sealed class AppScreen {
    data object Login : AppScreen()
    data object Register : AppScreen()
    data object Home : AppScreen()
    data class SimpleList(val header: String, val action: String, val icon: String, val emptyText: String) : AppScreen()
    data object ExamList : AppScreen()
    data object ExamQuestion : AppScreen()
    data object Submitting : AppScreen()
    data class Terminated(val message: String) : AppScreen()
}

data class ExamListItem(
    val raw: JSONObject,
    val id: String,
    val title: String,
    val durationMinutes: String,
    val completed: Boolean,
    val nilai: String
)
