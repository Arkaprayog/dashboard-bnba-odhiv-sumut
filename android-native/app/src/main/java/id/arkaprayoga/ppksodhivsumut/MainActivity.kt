package id.arkaprayoga.ppksodhivsumut

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Assignment
import androidx.compose.material.icons.outlined.Dashboard
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.browser.customtabs.CustomTabsIntent

private const val DASHBOARD_URL = "https://dashboard-bnba-odhiv-sumut.aryprayoga139.workers.dev"
private const val QUESTIONNAIRE_URL = "https://sahabatodhiv-sumut.aryprayoga139.workers.dev/kuisioner-responden.html"

private val Forest = Color(0xFF145A43)
private val Mist = Color(0xFFF3F7F4)
private val Ink = Color(0xFF17342B)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = lightColorScheme(
                primary = Forest,
                onPrimary = Color.White,
                background = Mist,
                surface = Color.White,
                onSurface = Ink
            )) {
                Surface(modifier = Modifier.fillMaxSize(), color = Mist) {
                    HomeScreen(
                        openDashboard = { openSecureLink(DASHBOARD_URL) },
                        openQuestionnaire = { openSecureLink(QUESTIONNAIRE_URL) }
                    )
                }
            }
        }
    }

    private fun openSecureLink(url: String) {
        // Use the system browser/Custom Tab so web authentication is not copied into app storage.
        CustomTabsIntent.Builder().setShowTitle(true).build()
            .launchUrl(this, Uri.parse(url))
    }
}

@Composable
private fun HomeScreen(openDashboard: () -> Unit, openQuestionnaire: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().background(Mist).padding(horizontal = 20.dp, vertical = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(Modifier.height(18.dp))
        Box(
            modifier = Modifier.background(Forest, RoundedCornerShape(22.dp)).padding(20.dp),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Outlined.Dashboard, contentDescription = null, tint = Color.White)
        }
        Spacer(Modifier.height(16.dp))
        Text("BNBA ODHIV SUMUT", fontSize = 23.sp, fontWeight = FontWeight.Bold, color = Ink)
        Text("Pendampingan dan layanan responden", color = Color(0xFF557267), fontSize = 14.sp)
        Spacer(Modifier.height(28.dp))

        NativeFeatureCard(
            title = "Dashboard Petugas",
            description = "Buka dashboard aman untuk login, data PPKS, dan pengelolaan responden.",
            buttonLabel = "Buka Dashboard",
            icon = { Icon(Icons.Outlined.Dashboard, contentDescription = null, tint = Forest) },
            onClick = openDashboard
        )
        Spacer(Modifier.height(14.dp))
        NativeFeatureCard(
            title = "Kuisioner Responden",
            description = "Buka halaman kuisioner resmi yang terhubung ke Google Forms.",
            buttonLabel = "Buka Kuisioner",
            icon = { Icon(Icons.Outlined.Assignment, contentDescription = null, tint = Forest) },
            onClick = openQuestionnaire
        )
        Spacer(Modifier.height(18.dp))
        Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(Icons.Outlined.Info, contentDescription = null, tint = Forest)
            Text(
                "Aplikasi native versi awal 0.1.0. Data sensitif tetap diakses melalui layanan web yang memeriksa hak akses.",
                color = Color(0xFF557267),
                fontSize = 12.sp,
                lineHeight = 17.sp
            )
        }
        Spacer(Modifier.weight(1f))
        Text("© Deny Arifin Martyon • Pendamping ODHIV", color = Color(0xFF6E817A), fontSize = 11.sp)
    }
}

@Composable
private fun NativeFeatureCard(
    title: String,
    description: String,
    buttonLabel: String,
    icon: @Composable () -> Unit,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(Modifier.padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                icon()
                Text(title, fontWeight = FontWeight.SemiBold, fontSize = 17.sp, color = Ink)
            }
            Spacer(Modifier.height(8.dp))
            Text(description, color = Color(0xFF557267), fontSize = 13.sp, lineHeight = 19.sp)
            Spacer(Modifier.height(14.dp))
            Button(onClick = onClick, modifier = Modifier.fillMaxWidth()) { Text(buttonLabel) }
        }
    }
}
