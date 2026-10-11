package id.sahabatodhiv.sumut;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Menu;
import android.view.MenuItem;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public final class MainActivity extends Activity {
    private static final String DASHBOARD_URL = "https://sahabatodhiv-sumut.aryprayoga139.workers.dev/";
    private static final String DASHBOARD_HOST = "sahabatodhiv-sumut.aryprayoga139.workers.dev";
    private WebView webView;
    private boolean showingOfflineShell = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(android.graphics.Color.rgb(6, 58, 125));
        getWindow().setNavigationBarColor(android.graphics.Color.rgb(6, 58, 125));
        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
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
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equalsIgnoreCase(uri.getScheme()) && DASHBOARD_HOST.equalsIgnoreCase(uri.getHost())) {
                    return false;
                }
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
                if (request.isForMainFrame() && !showingOfflineShell && !hasInternet()) {
                    showOfflineShell();
                }
            }
        });

        if (hasInternet()) {
            webView.loadUrl(DASHBOARD_URL);
        } else {
            showOfflineShell();
        }
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

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        menu.add(0, 1, 0, "Aktifkan push di browser");
        menu.add(0, 2, 1, "Buka dashboard di browser");
        menu.add(0, 3, 2, "Tentang aplikasi");
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        if (item.getItemId() == 1) {
            openExternal(DASHBOARD_URL);
            new AlertDialog.Builder(this)
                .setTitle("Aktifkan notifikasi push")
                .setMessage("Push latar belakang menggunakan layanan Web Push yang sudah ada. Di browser Chrome, masuk ke dashboard, buka Notifikasi, lalu pilih Aktifkan notifikasi HP. Izin notifikasi situs harus diizinkan.")
                .setPositiveButton("Mengerti", (dialog, which) -> {})
                .show();
            return true;
        }
        if (item.getItemId() == 2) {
            openExternal(DASHBOARD_URL);
            return true;
        }
        if (item.getItemId() == 3) {
            new AlertDialog.Builder(this)
                .setTitle("Sahabat ODHIV Sumut")
                .setMessage("Aplikasi Android untuk mengakses dashboard yang ada. Sinkronisasi data memerlukan internet. Data responden tidak disimpan oleh layar offline aplikasi.")
                .setPositiveButton("Tutup", (dialog, which) -> {})
                .show();
            return true;
        }
        return super.onOptionsItemSelected(item);
    }

    private void openExternal(String url) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); }
        catch (Exception ignored) { Toast.makeText(this, "Browser tidak tersedia.", Toast.LENGTH_LONG).show(); }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack() && !showingOfflineShell) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
        }
        super.onDestroy();
    }
}
