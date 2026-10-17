package id.sahabatodhiv.sumut;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;
import android.text.TextUtils;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Receives FCM token refreshes and foreground/data messages.
 * Server-side event dispatch must be configured separately.
 */
public final class SahabatFirebaseMessagingService extends FirebaseMessagingService {
    private static final String CHANNEL_ID = "sahabat_odhiv_fcm_v1";
    private static final String PREFS = "sahabat_odhiv_preferences";

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        if (token != null && !token.trim().isEmpty()) {
            getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                .putString("fcm_registration_token", token)
                .putBoolean("fcm_token_available", true)
                .apply();
        }
        // Do not log the registration token. It must be sent to a trusted backend
        // before targeted notifications can be delivered by the application's server.
    }

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        String title = null;
        String body = null;

        if (remoteMessage.getNotification() != null) {
            title = remoteMessage.getNotification().getTitle();
            body = remoteMessage.getNotification().getBody();
        }
        Map<String, String> data = remoteMessage.getData();
        if (TextUtils.isEmpty(title)) title = data.get("title");
        if (TextUtils.isEmpty(body)) body = data.get("body");
        if (TextUtils.isEmpty(title)) title = "Sahabat ODHIV Sumut";
        if (TextUtils.isEmpty(body)) body = "Ada pemberitahuan baru.";

        showNotification(title, body);
    }

    private void showNotification(String title, String body) {
        if (Build.VERSION.SDK_INT >= 33 &&
                ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        createNotificationChannel();
        Intent openApp = new Intent(this, MainActivity.class);
        openApp.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 802, openApp,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build();

        try {
            NotificationManagerCompat.from(this).notify((int) (System.currentTimeMillis() & 0x7fffffff), notification);
        } catch (SecurityException ignored) {
            // Android may revoke notification permission while the message is being handled.
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID, "Notifikasi Sahabat ODHIV", NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Pemberitahuan aplikasi Sahabat ODHIV Sumut");
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[]{0, 300, 150, 300});
        channel.setShowBadge(true);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
        channel.setSound(
            RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
            new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build()
        );
        manager.createNotificationChannel(channel);
    }
}
