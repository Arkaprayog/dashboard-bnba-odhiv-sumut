package id.sahabatodhiv.sumut;

import android.Manifest;
import android.app.AlertDialog;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.biometric.BiometricManager;
import androidx.fragment.app.FragmentActivity;
import androidx.biometric.BiometricPrompt;
import androidx.core.app.NotificationCompat;
import androidx.core.content.FileProvider;

import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.Executor;

public final class MainActivity extends FragmentActivity {
    private static final String DASHBOARD_URL = "https://sahabatodhiv-sumut.aryprayoga139.workers.dev/";
    private static final String DASHBOARD_HOST = "sahabatodhiv-sumut.aryprayoga139.workers.dev";
    private static final String PREFS = "sahabat_odhiv_preferences";
    private static final String CHANNEL_ID = "sahabat_odhiv_notifications";
    private static final int REQUEST_IMAGE_CHOOSER = 4107;
    private static final int REQUEST_CAMERA_TEST = 4108;
    private static final int REQUEST_GALLERY_TEST = 4109;

    private WebView webView;
    private boolean showingOfflineShell = false;
    private boolean started = false;
    private boolean authInProgress = false;
    private boolean waitingForBiometric = false;
    private boolean needsReauth = false;
    private boolean startupPending = false;
    private ValueCallback<Uri[]> pendingFileCallback;
    private Uri cameraOutputUri;

    private void setSplashImmersiveMode() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    private void restoreSystemBars() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
        getWindow().setStatusBarColor(android.graphics.Color.rgb(6, 58, 125));
        getWindow().setNavigationBarColor(android.graphics.Color.rgb(6, 58, 125));
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getActionBar() != null) getActionBar().hide();
        setSplashImmersiveMode();
        setContentView(new AnimatedSplashView(this));
        createNotificationChannel();

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(false);
        settings.setTextZoom(100);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setLoadsImagesAutomatically(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> filePathCallback,
                                             FileChooserParams fileChooserParams) {
                if (pendingFileCallback != null) pendingFileCallback.onReceiveValue(null);
                pendingFileCallback = filePathCallback;
                launchImagePicker();
                return true;
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equalsIgnoreCase(uri.getScheme()) && DASHBOARD_HOST.equalsIgnoreCase(uri.getHost())) return false;
                if ("https".equalsIgnoreCase(uri.getScheme()) || "mailto".equalsIgnoreCase(uri.getScheme()) || "tel".equalsIgnoreCase(uri.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
                    catch (Exception ignored) { Toast.makeText(MainActivity.this, "Tautan tidak dapat dibuka.", Toast.LENGTH_SHORT).show(); }
                }
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                showingOfflineShell = false;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame() && !showingOfflineShell && !hasInternet()) showOfflineShell();
            }
        });

        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (isFinishing()) return;
            if (getSharedPreferences(PREFS, MODE_PRIVATE).getBoolean("biometric_enabled", false)) {
                startupPending = true;
                authenticateBiometric(false);
            } else {
                initializeDashboard();
            }
        }, 4000L);
    }

    private void initializeDashboard() {
        if (isFinishing() || webView == null) return;
        startupPending = false;
        started = true;
        needsReauth = false;
        restoreSystemBars();
        if (getActionBar() != null) getActionBar().show();
        setTitle(R.string.app_name);
        setContentView(webView);
        if (hasInternet()) webView.loadUrl(DASHBOARD_URL);
        else showOfflineShell();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (started && needsReauth && !authInProgress &&
                getSharedPreferences(PREFS, MODE_PRIVATE).getBoolean("biometric_enabled", false)) {
            needsReauth = false;
            authenticateBiometric(false);
        }
    }

    @Override
    protected void onPause() {
        if (started && !authInProgress &&
                getSharedPreferences(PREFS, MODE_PRIVATE).getBoolean("biometric_enabled", false)) {
            needsReauth = true;
        }
        super.onPause();
    }

    private void launchImagePicker() {
        Intent galleryIntent = new Intent(Intent.ACTION_GET_CONTENT);
        galleryIntent.setType("image/*");
        galleryIntent.addCategory(Intent.CATEGORY_OPENABLE);

        Intent cameraIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (cameraIntent.resolveActivity(getPackageManager()) != null) {
            try {
                File photoFile = createTemporaryPhoto();
                cameraOutputUri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", photoFile);
                cameraIntent.putExtra(MediaStore.EXTRA_OUTPUT, cameraOutputUri);
                cameraIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            } catch (IOException exception) {
                cameraOutputUri = null;
                cameraIntent = null;
            }
        } else cameraIntent = null;

        Intent chooser = Intent.createChooser(galleryIntent, "Pilih foto atau ambil foto");
        if (cameraIntent != null) chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cameraIntent});
        try { startActivityForResult(chooser, REQUEST_IMAGE_CHOOSER); }
        catch (Exception exception) {
            finishFileChooser(null);
            Toast.makeText(this, "Kamera atau galeri tidak dapat dibuka.", Toast.LENGTH_LONG).show();
        }
    }

    private File createTemporaryPhoto() throws IOException {
        String timestamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date());
        File directory = new File(getCacheDir(), "selected-photos");
        if (!directory.exists() && !directory.mkdirs()) throw new IOException("Tidak dapat membuat folder foto sementara");
        return File.createTempFile("IMG_" + timestamp + "_", ".jpg", directory);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_IMAGE_CHOOSER) {
            Uri selected = null;
            if (resultCode == RESULT_OK) {
                if (data != null && data.getData() != null) selected = data.getData();
                else selected = cameraOutputUri;
            }
            finishFileChooser(selected == null ? null : new Uri[]{selected});
            return;
        }
        if (requestCode == REQUEST_CAMERA_TEST) {
            Uri capturedPhoto = cameraOutputUri;
            cameraOutputUri = null;
            if (resultCode == RESULT_OK && capturedPhoto != null) {
                File photoDirectory = new File(getCacheDir(), "selected-photos");
                File[] candidates = photoDirectory.listFiles((dir, name) -> name.startsWith("IMG_") && name.endsWith(".jpg"));
                boolean foundPhoto = false;
                if (candidates != null) {
                    for (File candidate : candidates) {
                        if (candidate.isFile() && candidate.length() > 0) { foundPhoto = true; break; }
                    }
                }
                Toast.makeText(this, foundPhoto
                        ? "Uji kamera berhasil: foto tersimpan sementara."
                        : "Kamera selesai, tetapi berkas foto belum terverifikasi.", Toast.LENGTH_LONG).show();
            } else {
                Toast.makeText(this, "Uji kamera dibatalkan.", Toast.LENGTH_SHORT).show();
            }
            return;
        }
        if (requestCode == REQUEST_GALLERY_TEST) {
            Toast.makeText(this,
                    resultCode == RESULT_OK && data != null && data.getData() != null
                            ? "Uji galeri berhasil: foto dipilih."
                            : "Uji galeri dibatalkan.",
                    resultCode == RESULT_OK ? Toast.LENGTH_LONG : Toast.LENGTH_SHORT).show();
        }
    }

    private void finishFileChooser(Uri[] results) {
        if (pendingFileCallback != null) {
            pendingFileCallback.onReceiveValue(results);
            pendingFileCallback = null;
        }
        cameraOutputUri = null;
    }

    private boolean hasInternet() {
        ConnectivityManager manager = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        if (manager == null) return false;
        Network network = manager.getActiveNetwork();
        if (network == null) return false;
        NetworkCapabilities caps = manager.getNetworkCapabilities(network);
        return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }

    private void showOfflineShell() {
        showingOfflineShell = true;
        webView.loadUrl("file:///android_asset/offline.html");
    }

    private int allowedAuthenticators() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            return BiometricManager.Authenticators.BIOMETRIC_WEAK | BiometricManager.Authenticators.DEVICE_CREDENTIAL;
        }
        return BiometricManager.Authenticators.BIOMETRIC_WEAK;
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        boolean enabled = getSharedPreferences(PREFS, MODE_PRIVATE).getBoolean("biometric_enabled", false);
        menu.add(0, 1, 0, enabled ? "Nonaktifkan kunci sidik jari/wajah" : "Aktifkan kunci sidik jari/wajah");
        menu.add(0, 2, 1, "Uji notifikasi perangkat");
        menu.add(0, 3, 2, "Status notifikasi push native");
        menu.add(0, 4, 3, "Buka dashboard di browser");
        menu.add(0, 5, 4, "Tentang aplikasi");
        menu.add(0, 6, 5, "Uji kamera");
        menu.add(0, 7, 6, "Uji galeri foto");
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        if (item.getItemId() == 1) {
            SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
            if (prefs.getBoolean("biometric_enabled", false)) {
                prefs.edit().putBoolean("biometric_enabled", false).apply();
                needsReauth = false;
                Toast.makeText(this, "Kunci biometrik dinonaktifkan.", Toast.LENGTH_LONG).show();
                invalidateOptionsMenu();
            } else {
                waitingForBiometric = true;
                authenticateBiometric(true);
            }
            return true;
        }
        if (item.getItemId() == 2) { showTestNotification(); return true; }
        if (item.getItemId() == 6) { launchCameraTest(); return true; }
        if (item.getItemId() == 7) { launchGalleryTest(); return true; }
        if (item.getItemId() == 3) {
            new AlertDialog.Builder(this).setTitle("Status notifikasi push native")
                .setMessage("Notifikasi lokal perangkat tersedia. Pengiriman push otomatis belum aktif karena Firebase Cloud Messaging dan kredensial server belum dikonfigurasi.")
                .setPositiveButton("Mengerti", (dialog, which) -> {}).show();
            return true;
        }
        if (item.getItemId() == 4) { openExternal(DASHBOARD_URL); return true; }
        if (item.getItemId() == 5) {
            new AlertDialog.Builder(this).setTitle("Sahabat ODHIV Sumut")
                .setMessage("Aplikasi Android untuk mengakses dashboard. Sinkronisasi data memerlukan internet.")
                .setPositiveButton("Tutup", (dialog, which) -> {}).show();
            return true;
        }
        return super.onOptionsItemSelected(item);
    }

    private void authenticateBiometric(boolean enabling) {
        if (authInProgress) return;
        int authenticators = allowedAuthenticators();
        int status = BiometricManager.from(this).canAuthenticate(authenticators);
        if (status != BiometricManager.BIOMETRIC_SUCCESS) {
            if (enabling) {
                waitingForBiometric = false;
                Toast.makeText(this, "Perangkat belum memiliki biometrik yang siap digunakan. Periksa Pengaturan Android.", Toast.LENGTH_LONG).show();
            } else if (startupPending) {
                new AlertDialog.Builder(this).setTitle("Kunci biometrik tidak tersedia")
                    .setMessage("Biometrik tidak dapat digunakan saat ini. Aktifkan kembali sidik jari/wajah di Pengaturan Android, atau hapus data aplikasi untuk menonaktifkan kunci.")
                    .setPositiveButton("Tutup aplikasi", (d, w) -> finish()).setCancelable(false).show();
            } else {
                Toast.makeText(this, "Biometrik tidak tersedia. Aplikasi tetap terkunci.", Toast.LENGTH_LONG).show();
                finish();
            }
            return;
        }

        authInProgress = true;
        Executor executor = command -> new Handler(Looper.getMainLooper()).post(command);
        BiometricPrompt prompt = new BiometricPrompt(this, executor, new BiometricPrompt.AuthenticationCallback() {
            @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                super.onAuthenticationSucceeded(result);
                authInProgress = false;
                if (waitingForBiometric) {
                    getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean("biometric_enabled", true).apply();
                    waitingForBiometric = false;
                    invalidateOptionsMenu();
                    Toast.makeText(MainActivity.this, "Kunci sidik jari/wajah berhasil diaktifkan.", Toast.LENGTH_LONG).show();
                }
                if (startupPending || !started) initializeDashboard();
                else needsReauth = false;
            }

            @Override public void onAuthenticationError(int errorCode, CharSequence errString) {
                super.onAuthenticationError(errorCode, errString);
                authInProgress = false;
                if (waitingForBiometric) {
                    waitingForBiometric = false;
                    Toast.makeText(MainActivity.this, "Aktivasi biometrik dibatalkan.", Toast.LENGTH_LONG).show();
                } else {
                    Toast.makeText(MainActivity.this, "Autentikasi tidak berhasil. Aplikasi tetap terkunci.", Toast.LENGTH_LONG).show();
                    finish();
                }
            }
        });
        BiometricPrompt.PromptInfo.Builder builder = new BiometricPrompt.PromptInfo.Builder()
            .setTitle(enabling ? "Aktifkan kunci biometrik" : "Buka Sahabat ODHIV")
            .setSubtitle("Gunakan sidik jari, wajah, atau kunci layar perangkat");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) builder.setAllowedAuthenticators(authenticators);
        else builder.setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK);
        prompt.authenticate(builder.build());
    }

    private void launchCameraTest() {
        Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (camera.resolveActivity(getPackageManager()) == null) {
            new AlertDialog.Builder(this).setTitle("Kamera tidak tersedia")
                .setMessage("Tidak ditemukan aplikasi kamera yang dapat dibuka pada perangkat ini.")
                .setPositiveButton("Tutup", (d, w) -> {}).show();
            return;
        }
        try {
            File photoFile = createTemporaryPhoto();
            cameraOutputUri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", photoFile);
            camera.putExtra(MediaStore.EXTRA_OUTPUT, cameraOutputUri);
            camera.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            startActivityForResult(camera, REQUEST_CAMERA_TEST);
        } catch (Exception exception) {
            cameraOutputUri = null;
            Toast.makeText(this, "Kamera gagal dibuka: " + exception.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private void launchGalleryTest() {
        Intent gallery = new Intent(Intent.ACTION_GET_CONTENT);
        gallery.setType("image/*");
        gallery.addCategory(Intent.CATEGORY_OPENABLE);
        try {
            startActivityForResult(Intent.createChooser(gallery, "Pilih foto untuk menguji galeri"), REQUEST_GALLERY_TEST);
        } catch (Exception exception) {
            Toast.makeText(this, "Galeri tidak dapat dibuka.", Toast.LENGTH_LONG).show();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == 701) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                showTestNotification();
            } else {
                Toast.makeText(this, "Izin notifikasi ditolak; notifikasi uji tidak dapat ditampilkan.", Toast.LENGTH_LONG).show();
            }
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Notifikasi Sahabat ODHIV", NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("Pemberitahuan aplikasi Sahabat ODHIV Sumut");
            channel.enableVibration(true);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    private void showTestNotification() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 701);
            Toast.makeText(this, "Izinkan notifikasi; notifikasi uji akan ditampilkan setelah izin diberikan.", Toast.LENGTH_LONG).show();
            return;
        }
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager == null) return;
        NotificationCompat.Builder notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Sahabat ODHIV Sumut")
            .setContentText("Notifikasi perangkat berhasil diuji.")
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true);
        manager.notify(701, notification.build());
    }

    private void openExternal(String url) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); }
        catch (Exception ignored) { Toast.makeText(this, "Browser tidak tersedia.", Toast.LENGTH_LONG).show(); }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack() && !showingOfflineShell) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (pendingFileCallback != null) {
            pendingFileCallback.onReceiveValue(null);
            pendingFileCallback = null;
        }
        if (webView != null) {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
        }
        super.onDestroy();
    }
}
