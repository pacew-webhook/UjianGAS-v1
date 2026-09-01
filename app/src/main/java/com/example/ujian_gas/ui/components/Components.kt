package com.example.ujian_gas.ui.components

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ujian_gas.ui.theme.UjianColors

/** Brand / header aplikasi (dipakai di layar Login). */
@Composable
fun AppBrand(subtitle: String) {
    Column {
        Text(
            "UJIAN",
            color = UjianColors.Blue,
            fontWeight = FontWeight.Bold,
            fontSize = 13.sp,
            letterSpacing = 1.5.sp
        )
        Spacer(Modifier.height(2.dp))
        Text(
            "Ujian GAS",
            color = UjianColors.Navy,
            fontWeight = FontWeight.Bold,
            fontSize = 30.sp
        )
        Spacer(Modifier.height(4.dp))
        Text(subtitle, color = UjianColors.TextMuted, fontSize = 15.sp)
    }
}

@Composable
fun SectionTitle(title: String, subtitle: String? = null) {
    Column {
        Text(title, color = UjianColors.TextPrimary, fontWeight = FontWeight.Bold, fontSize = 26.sp)
        if (subtitle != null) {
            Spacer(Modifier.height(4.dp))
            Text(subtitle, color = UjianColors.TextMuted, fontSize = 15.sp)
        }
    }
}

/** Kartu putih dengan bayangan halus — dasar dari hampir semua panel modern di app ini. */
@Composable
fun SoftCard(
    modifier: Modifier = Modifier,
    padding: Int = 20,
    content: @Composable ColumnScope.() -> Unit
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .shadow(elevation = 10.dp, shape = RoundedCornerShape(24.dp), ambientColor = UjianColors.Navy.copy(alpha = 0.08f), spotColor = UjianColors.Navy.copy(alpha = 0.10f))
            .clip(RoundedCornerShape(24.dp))
            .background(UjianColors.Surface)
            .border(BorderStroke(1.dp, UjianColors.Border), RoundedCornerShape(24.dp))
            .padding(padding.dp),
        content = content
    )
}

@Composable
fun ModernTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    isPassword: Boolean = false,
    keyboardType: androidx.compose.ui.text.input.KeyboardType = androidx.compose.ui.text.input.KeyboardType.Text
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        singleLine = true,
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        visualTransformation = if (isPassword) androidx.compose.ui.text.input.PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = keyboardType),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = UjianColors.Blue,
            unfocusedBorderColor = UjianColors.Border,
            focusedContainerColor = UjianColors.Surface,
            unfocusedContainerColor = UjianColors.Surface
        )
    )
}

@Composable
fun PrimaryButton(
    text: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    onClick: () -> Unit
) {
    Button(
        onClick = onClick,
        enabled = enabled && !loading,
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 54.dp),
        shape = RoundedCornerShape(16.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = UjianColors.Blue,
            contentColor = Color.White,
            disabledContainerColor = UjianColors.Blue.copy(alpha = 0.5f)
        )
    ) {
        if (loading) {
            CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
        } else {
            Text(text, fontWeight = FontWeight.Bold, fontSize = 16.sp)
        }
    }
}

@Composable
fun SecondaryButton(text: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 52.dp),
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, UjianColors.Border),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = UjianColors.Blue)
    ) {
        Text(text, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
    }
}

/** Kartu menu di Home / daftar item yang bisa diklik, dengan ikon bulat modern. */
@Composable
fun InfoCard(
    icon: String,
    title: String,
    subtitle: String,
    accent: Color = UjianColors.BlueSoft,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .shadow(elevation = 6.dp, shape = RoundedCornerShape(20.dp), ambientColor = UjianColors.Navy.copy(alpha = 0.06f))
            .clip(RoundedCornerShape(20.dp))
            .background(UjianColors.Surface)
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(54.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(accent),
            contentAlignment = Alignment.Center
        ) {
            Text(icon, fontSize = 24.sp)
        }
        Spacer(Modifier.width(14.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = UjianColors.TextPrimary)
            Spacer(Modifier.height(2.dp))
            Text(subtitle, fontSize = 13.sp, color = UjianColors.TextMuted, maxLines = 2)
        }
        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = UjianColors.TextMuted.copy(alpha = 0.6f))
    }
}

@Composable
fun EmptyState(icon: String, title: String, subtitle: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(22.dp))
            .background(UjianColors.Surface)
            .border(BorderStroke(1.dp, UjianColors.Border), RoundedCornerShape(22.dp))
            .padding(vertical = 30.dp, horizontal = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(icon, fontSize = 42.sp, textAlign = TextAlign.Center)
        Spacer(Modifier.height(8.dp))
        Text(title, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = UjianColors.TextPrimary, textAlign = TextAlign.Center)
        Spacer(Modifier.height(4.dp))
        Text(subtitle, fontSize = 14.sp, color = UjianColors.TextMuted, textAlign = TextAlign.Center)
    }
}

/** Pill status waktu / label kecil dengan latar lembut (dipakai untuk timer ujian). */
@Composable
fun SoftPill(text: String, background: Color = UjianColors.BlueSoft, contentColor: Color = UjianColors.Blue, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .background(background)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(text, color = contentColor, fontWeight = FontWeight.Bold, fontSize = 16.sp)
    }
}

@Composable
fun StatusBadge(text: String, color: Color) {
    Box(
        modifier = Modifier
            .clip(CircleShape)
            .background(color.copy(alpha = 0.12f))
            .padding(horizontal = 10.dp, vertical = 4.dp)
    ) {
        Text(text, color = color, fontSize = 11.sp, fontWeight = FontWeight.Bold)
    }
}
