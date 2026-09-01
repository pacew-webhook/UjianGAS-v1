package com.example.ujian_gas.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Palet Ujian GAS — versi modern dari navy/biru lama, dibuat lebih lembut
 * (soft indigo/navy, kontras lebih nyaman) tapi tetap terasa sama.
 */
object UjianColors {
    val Navy = Color(0xFF16213E)
    val NavySoft = Color(0xFF29365C)
    val Blue = Color(0xFF3B6DF6)
    val BlueDark = Color(0xFF2E56D6)
    val BlueSoft = Color(0xFFEAF0FF)
    val Background = Color(0xFFF6F8FD)
    val Surface = Color(0xFFFFFFFF)
    val TextPrimary = Color(0xFF1B2438)
    val TextMuted = Color(0xFF6B7690)
    val Border = Color(0xFFE6EAF3)
    val Danger = Color(0xFFE0384D)
    val DangerSoft = Color(0xFFFDEDEF)
    val Success = Color(0xFF16A34A)
    val Warning = Color(0xFFD97706)
}

private val LightColors = lightColorScheme(
    primary = UjianColors.Blue,
    onPrimary = Color.White,
    primaryContainer = UjianColors.BlueSoft,
    onPrimaryContainer = UjianColors.BlueDark,
    secondary = UjianColors.Navy,
    background = UjianColors.Background,
    onBackground = UjianColors.TextPrimary,
    surface = UjianColors.Surface,
    onSurface = UjianColors.TextPrimary,
    surfaceVariant = UjianColors.BlueSoft,
    onSurfaceVariant = UjianColors.TextMuted,
    outline = UjianColors.Border,
    error = UjianColors.Danger,
    errorContainer = UjianColors.DangerSoft
)

private val DarkColors = darkColorScheme(
    primary = UjianColors.Blue,
    onPrimary = Color.White,
    primaryContainer = UjianColors.NavySoft,
    onPrimaryContainer = Color.White,
    secondary = UjianColors.BlueSoft,
    background = Color(0xFF0F1626),
    onBackground = Color(0xFFE7EBF5),
    surface = Color(0xFF171F33),
    onSurface = Color(0xFFE7EBF5),
    surfaceVariant = Color(0xFF232E4A),
    onSurfaceVariant = Color(0xFFA9B3CC),
    outline = Color(0xFF2E3956),
    error = UjianColors.Danger,
    errorContainer = Color(0xFF3A1620)
)

val UjianShapes = Shapes(
    extraSmall = androidx.compose.foundation.shape.RoundedCornerShape(8.dp),
    small = androidx.compose.foundation.shape.RoundedCornerShape(12.dp),
    medium = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
    large = androidx.compose.foundation.shape.RoundedCornerShape(22.dp),
    extraLarge = androidx.compose.foundation.shape.RoundedCornerShape(28.dp)
)

val UjianTypography = Typography(
    headlineLarge = TextStyle(fontWeight = FontWeight.Bold, fontSize = 30.sp, lineHeight = 36.sp),
    headlineMedium = TextStyle(fontWeight = FontWeight.Bold, fontSize = 24.sp, lineHeight = 30.sp),
    titleLarge = TextStyle(fontWeight = FontWeight.Bold, fontSize = 20.sp, lineHeight = 26.sp),
    titleMedium = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 22.sp),
    bodyLarge = TextStyle(fontWeight = FontWeight.Normal, fontSize = 16.sp, lineHeight = 24.sp),
    bodyMedium = TextStyle(fontWeight = FontWeight.Normal, fontSize = 14.sp, lineHeight = 20.sp),
    labelLarge = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 14.sp, lineHeight = 20.sp),
    labelSmall = TextStyle(fontWeight = FontWeight.Bold, fontSize = 12.sp, lineHeight = 16.sp)
)

@Composable
fun UjianGasTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colors = if (darkTheme) DarkColors else LightColors
    MaterialTheme(
        colorScheme = colors,
        typography = UjianTypography,
        shapes = UjianShapes,
        content = content
    )
}
