package id.sahabatodhiv.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.content.ActivityNotFoundException;
import android.provider.MediaStore;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.IOException;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final String DASHBOARD = "https://dashboard-bnba-odhiv-sumut.aryprayoga139.workers.dev/";
    private static final String QUESTIONNAIRE = "https://sahabatodhiv-sumut.aryprayoga139.workers.dev/kuisioner-responden.html";
    private static final int FILE_CHOOSER_REQUEST = 2401;
    private WebView webView;
    private ValueCallback<Uri[]> uploadCallback;
    private Uri cameraOutputUri;
    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(56,75,56));
        getWindow().setNavigationBarColor(Color.rgb(11,45,107));
        showSplash();
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1001);
    }
    private int dp(float v) { return (int)(v * getResources().getDisplayMetrics().density + 0.5f); }
    private void showSplash() {
        FrameLayout root = new FrameLayout(this); root.setBackgroundColor(Color.rgb(56,75,56));
        LinearLayout center = new LinearLayout(this); center.setGravity(Gravity.CENTER); center.setOrientation(LinearLayout.VERTICAL); center.setPadding(dp(28),dp(24),dp(28),dp(24));
        TextView mark = new TextView(this); mark.setText("A"); mark.setTextColor(Color.WHITE); mark.setTextSize(64); mark.setTypeface(Typeface.DEFAULT_BOLD); mark.setGravity(Gravity.CENTER); mark.setBackgroundColor(Color.rgb(17,112,192));
        LinearLayout.LayoutParams mlp = new LinearLayout.LayoutParams(dp(112),dp(112)); mlp.bottomMargin=dp(24); center.addView(mark,mlp);
        TextView title = new TextView(this); title.setText("Sahabat ODHIV"); title.setTextColor(Color.WHITE); title.setTextSize(28); title.setTypeface(Typeface.DEFAULT_BOLD); title.setGravity(Gravity.CENTER); center.addView(title);
        TextView slogan = new TextView(this); slogan.setText("To help people, to help themselves and others"); slogan.setTextColor(Color.rgb(83,203,235)); slogan.setTextSize(15); slogan.setGravity(Gravity.CENTER); slogan.setPadding(0,dp(12),0,dp(24)); center.addView(slogan);
        ProgressBar progress = new ProgressBar(this); center.addView(progress,new LinearLayout.LayoutParams(dp(36),dp(36)));
        root.addView(center,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT)); setContentView(root); center.setAlpha(0f); center.animate().alpha(1f).setDuration(900).start(); root.postDelayed(this::showDashboard,3000);
    }
    private void showDashboard() {
        LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setBackgroundColor(Color.WHITE);
        LinearLayout bar = new LinearLayout(this); bar.setGravity(Gravity.CENTER_VERTICAL); bar.setPadding(dp(14),dp(8),dp(10),dp(8)); bar.setBackgroundColor(Color.rgb(56,75,56));
        TextView title = new TextView(this); title.setText("Sahabat ODHIV"); title.setTextColor(Color.WHITE); title.setTextSize(18); title.setTypeface(Typeface.DEFAULT_BOLD); bar.addView(title,new LinearLayout.LayoutParams(0,dp(48),1));
        Button form = new Button(this); form.setText("Kuisioner"); form.setTextColor(Color.WHITE); form.setTextSize(12); form.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(17,112,192))); bar.addView(form); form.setOnClickListener(v -> webView.loadUrl(QUESTIONNAIRE));
        Button refresh = new Button(this); refresh.setText("↻"); refresh.setTextSize(20); refresh.setTextColor(Color.WHITE); refresh.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(56,75,56))); bar.addView(refresh); refresh.setOnClickListener(v -> webView.reload());
        root.addView(bar,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT));
        webView = new WebView(this); WebSettings settings=webView.getSettings(); settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true); settings.setAllowFileAccess(false); settings.setAllowContentAccess(true); settings.setJavaScriptCanOpenWindowsAutomatically(false); settings.setSupportMultipleWindows(false);
        webView.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request){ Uri uri=request.getUrl(); String host=uri.getHost(); if(host!=null&&(host.equals("dashboard-bnba-odhiv-sumut.aryprayoga139.workers.dev")||host.equals("sahabatodhiv-sumut.aryprayoga139.workers.dev")||host.equals("docs.google.com")||host.equals("forms.gle")||host.equals("accounts.google.com")||host.endsWith("googleusercontent.com")||host.endsWith("google.com"))) return false; startActivity(new Intent(Intent.ACTION_VIEW,uri)); return true; }
            @Override public void onReceivedError(WebView view,WebResourceRequest request,android.webkit.WebResourceError error){ if(request.isForMainFrame()) Toast.makeText(MainActivity.this,"Koneksi bermasalah. Periksa internet lalu muat ulang.",Toast.LENGTH_LONG).show(); }
        });
        webView.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
                if(uploadCallback!=null) uploadCallback.onReceiveValue(null);
                uploadCallback=callback;
                cameraOutputUri=null;
                Intent picker=params.createIntent();
                try {
                    if(acceptsImagesOnly(params)) {
                        Intent camera=new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                        if(camera.resolveActivity(getPackageManager())!=null) {
                            File directory=new File(getCacheDir(),"selected-photos");
                            if(!directory.exists()&&!directory.mkdirs()) throw new IOException("Tidak dapat menyiapkan cache foto.");
                            File photo=File.createTempFile("upload_photo_",".jpg",directory);
                            cameraOutputUri=FileProvider.getUriForFile(MainActivity.this,getPackageName()+".fileprovider",photo);
                            camera.putExtra(MediaStore.EXTRA_OUTPUT,cameraOutputUri);
                            camera.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                            Intent chooser=Intent.createChooser(picker,"Pilih foto");
                            chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS,new Intent[]{camera});
                            startActivityForResult(chooser,FILE_CHOOSER_REQUEST);
                        } else {
                            startActivityForResult(picker,FILE_CHOOSER_REQUEST);
                        }
                    } else {
                        startActivityForResult(picker,FILE_CHOOSER_REQUEST);
                    }
                    return true;
                } catch(ActivityNotFoundException e) {
                    if(uploadCallback!=null) uploadCallback.onReceiveValue(null);
                    uploadCallback=null; cameraOutputUri=null;
                    Toast.makeText(MainActivity.this,"Pemilih foto/berkas tidak tersedia.",Toast.LENGTH_SHORT).show();
                    return false;
                } catch(IOException|IllegalArgumentException e) {
                    if(uploadCallback!=null) uploadCallback.onReceiveValue(null);
                    uploadCallback=null; cameraOutputUri=null;
                    Toast.makeText(MainActivity.this,"Kamera tidak dapat disiapkan. Coba pilih foto dari galeri.",Toast.LENGTH_LONG).show();
                    return false;
                }
            }
        });
        root.addView(webView,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,0,1)); setContentView(root); webView.loadUrl(DASHBOARD);
    }
    private boolean acceptsImagesOnly(WebChromeClient.FileChooserParams params) {
        String[] types=params.getAcceptTypes();
        if(types==null||types.length==0) return false;
        boolean found=false;
        for(String type:types) {
            if(type==null||type.trim().isEmpty()) continue;
            for(String part:type.split(",")) {
                String normalized=part.trim().toLowerCase(java.util.Locale.ROOT);
                if(normalized.isEmpty()) continue;
                found=true;
                if(!normalized.startsWith("image/")&&!normalized.equals(".jpg")&&!normalized.equals(".jpeg")&&!normalized.equals(".png")&&!normalized.equals(".webp")) return false;
            }
        }
        return found;
    }
    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){
        super.onActivityResult(requestCode,resultCode,data);
        if(requestCode==FILE_CHOOSER_REQUEST&&uploadCallback!=null){
            Uri[] results=null;
            if(resultCode==RESULT_OK&&cameraOutputUri!=null&&data!=null&&data.getData()!=null) {
                results=WebChromeClient.FileChooserParams.parseResult(resultCode,data);
            } else if(resultCode==RESULT_OK&&cameraOutputUri!=null) {
                results=new Uri[]{cameraOutputUri};
            } else if(resultCode==RESULT_OK) {
                results=WebChromeClient.FileChooserParams.parseResult(resultCode,data);
            }
            uploadCallback.onReceiveValue(results);
            uploadCallback=null;
            cameraOutputUri=null;
        }
    }
    @Override public void onBackPressed(){ if(webView!=null&&webView.canGoBack()) webView.goBack(); else new AlertDialog.Builder(this).setMessage("Keluar dari Sahabat ODHIV?").setNegativeButton("Batal",(d,w)->{}).setPositiveButton("Keluar",(d,w)->finish()).show(); }
}
