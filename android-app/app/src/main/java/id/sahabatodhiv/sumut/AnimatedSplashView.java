package id.sahabatodhiv.sumut;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.Shader;
import android.view.View;

public final class AnimatedSplashView extends View {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
    private final Bitmap illustration;
    private final long started = System.currentTimeMillis();
    private static final long DURATION_MS = 4000L;

    public AnimatedSplashView(Context context) {
        super(context);
        illustration = BitmapFactory.decodeResource(getResources(), R.drawable.splash_illustration);
        setLayerType(View.LAYER_TYPE_HARDWARE, null);
    }

    private float dp(float value) {
        return value * getResources().getDisplayMetrics().density;
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float w = getWidth();
        float h = getHeight();
        long elapsed = Math.max(0L, System.currentTimeMillis() - started);
        float progress = Math.min(1f, elapsed / (float) DURATION_MS);

        // Use the current supplied portrait artwork, not the obsolete red-kite vector scene.
        if (illustration != null && w > 0 && h > 0) {
            float sourceRatio = (float) illustration.getWidth() / illustration.getHeight();
            float targetRatio = w / h;
            int cropW = illustration.getWidth();
            int cropH = illustration.getHeight();
            if (sourceRatio > targetRatio) {
                cropW = Math.max(1, Math.round(illustration.getHeight() * targetRatio));
            } else if (sourceRatio < targetRatio) {
                cropH = Math.max(1, Math.round(illustration.getWidth() / targetRatio));
            }
            // Gentle Ken Burns motion keeps the supplied illustration alive during loading.
            float zoom = 1f + 0.045f * progress;
            int drawW = Math.max(1, Math.round(cropW / zoom));
            int drawH = Math.max(1, Math.round(cropH / zoom));
            float drift = (float) Math.sin(progress * Math.PI) * cropH * 0.012f;
            int left = Math.max(0, (illustration.getWidth() - drawW) / 2);
            int top = Math.max(0, Math.min(illustration.getHeight() - drawH,
                    Math.round((illustration.getHeight() - drawH) / 2f + drift)));
            Rect src = new Rect(left, top, left + drawW, top + drawH);
            canvas.drawBitmap(illustration, src, new Rect(0, 0, getWidth(), getHeight()), paint);
        } else {
            canvas.drawColor(Color.rgb(20, 110, 170));
        }

        paint.setShader(new LinearGradient(0, h * 0.68f, 0, h,
                new int[]{Color.TRANSPARENT, Color.rgb(17, 83, 83), Color.rgb(17, 83, 83)},
                new float[]{0f, 0.45f, 1f}, Shader.TileMode.CLAMP));
        canvas.drawRect(0, h * 0.68f, w, h, paint);
        paint.setShader(null);
        paint.setColor(Color.WHITE);
        paint.setTextAlign(Paint.Align.CENTER);
        paint.setTypeface(android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.BOLD));
        paint.setTextSize(Math.min(dp(30), w * 0.075f));
        canvas.drawText("Sahabat ODHIV Sumut", w / 2f, h * 0.83f, paint);
        paint.setTypeface(android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.NORMAL));
        paint.setTextSize(Math.min(dp(14), w * 0.038f));
        paint.setColor(Color.rgb(125, 220, 239));
        canvas.drawText("To help people, to help themselves and others", w / 2f, h * 0.87f, paint);
        paint.setColor(Color.WHITE);
        paint.setTextSize(dp(11));
        canvas.drawText("Memuat aplikasi…", w / 2f, h * 0.92f, paint);

        // Fade only at the end of the four-second splash.
        setAlpha(Math.max(0f, Math.min(1f, (DURATION_MS - elapsed) / 350f)));
        if (elapsed < DURATION_MS) postInvalidateDelayed(40L);
    }
}