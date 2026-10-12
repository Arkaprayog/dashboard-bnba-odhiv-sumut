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
        long elapsed = System.currentTimeMillis() - started;

        // The original supplied portrait illustration replaces the old hand-drawn kite scene.
        if (illustration != null) {
            Rect src = new Rect(0, 0, illustration.getWidth(), illustration.getHeight());
            float sourceRatio = (float) illustration.getWidth() / illustration.getHeight();
            float targetRatio = w / h;
            if (sourceRatio > targetRatio) {
                int cropWidth = (int) (illustration.getHeight() * targetRatio);
                int left = (illustration.getWidth() - cropWidth) / 2;
                src.set(left, 0, left + cropWidth, illustration.getHeight());
            } else if (sourceRatio < targetRatio) {
                int cropHeight = (int) (illustration.getWidth() / targetRatio);
                int top = (illustration.getHeight() - cropHeight) / 2;
                src.set(0, top, illustration.getWidth(), top + cropHeight);
            }
            canvas.drawBitmap(illustration, src, new Rect(0, 0, getWidth(), getHeight()), paint);
        } else {
            canvas.drawColor(Color.rgb(20, 110, 170));
        }

        // A gentle dark footer keeps the title readable over the full-screen artwork.
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

        // Fade the artwork smoothly as the dashboard opens.
        setAlpha(Math.max(0f, Math.min(1f, (4000f - elapsed) / 350f)));
        if (elapsed < 4000L) postInvalidateDelayed(40L);
    }
}