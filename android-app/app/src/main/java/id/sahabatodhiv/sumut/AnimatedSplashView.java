package id.sahabatodhiv.sumut;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.LinearGradient;
import android.graphics.Shader;
import android.view.View;

public final class AnimatedSplashView extends View {
    private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final long started = System.currentTimeMillis();
    private final int green = Color.rgb(56,75,56);
    private final int blue = Color.rgb(17,112,192);
    private final int cyan = Color.rgb(83,203,235);
    private final int red = Color.rgb(255,29,37);

    public AnimatedSplashView(Context context) { super(context); setLayerType(View.LAYER_TYPE_SOFTWARE, null); }

    private void fill(Canvas c, int color) { p.setColor(color); p.setStyle(Paint.Style.FILL); p.setShader(null); }
    private void line(Canvas c, int color, float width) { p.setColor(color); p.setStrokeWidth(width); p.setStyle(Paint.Style.STROKE); p.setStrokeCap(Paint.Cap.ROUND); p.setShader(null); }

    @Override protected void onDraw(Canvas c) {
        super.onDraw(c);
        float w=getWidth(), h=getHeight();
        p.setShader(new LinearGradient(0,0,w,h, new int[]{Color.rgb(12,69,130),cyan,blue}, null, Shader.TileMode.CLAMP));
        c.drawRect(0,0,w,h,p); p.setShader(null);
        float t=((System.currentTimeMillis()-started)%2400L)/2400f;
        float cx=w*(0.55f+0.06f*(float)Math.sin(t*Math.PI*2));
        float ky=h*0.27f+ (float)Math.sin(t*Math.PI*2)*h*0.018f;
        Path kite=new Path(); kite.moveTo(cx,ky-h*.055f); kite.lineTo(cx+h*.045f,ky); kite.lineTo(cx,ky+h*.055f); kite.lineTo(cx-h*.045f,ky); kite.close();
        fill(c,red); c.drawPath(kite,p);
        line(c,Color.WHITE,dp(1.4f)); c.drawLine(cx,ky+h*.055f,cx-h*.06f,ky+h*.11f,p);
        Path tail=new Path(); tail.moveTo(cx-h*.06f,ky+h*.11f); tail.cubicTo(cx-h*.11f,ky+h*.16f,cx+h*.05f,ky+h*.17f,cx-h*.04f,ky+h*.22f); c.drawPath(tail,p);
        fill(c,Color.rgb(255,219,120)); c.drawCircle(cx-h*.06f,ky+h*.12f,dp(3),p); c.drawCircle(cx-h*.04f,ky+h*.22f,dp(3),p);

        float ground=h*.72f; fill(c,Color.rgb(24,94,94)); c.drawRect(0,ground,w,h,p);
        float scale=Math.min(w/380f,h/720f);
        float y=ground-h*.02f;
        // Taller child leads while holding the smaller child's hand.
        drawChild(c,w*.43f,y,scale*1.02f,green,true);
        drawChild(c,w*.60f,y+dp(9),scale*.83f,blue,false);
        line(c,Color.rgb(255,219,120),dp(2.5f));
        c.drawLine(w*.44f,y-dp(35)*scale,w*.60f,y-dp(28)*scale,p);
        fill(c,Color.WHITE);
        p.setTextAlign(Paint.Align.CENTER); p.setTypeface(android.graphics.Typeface.create("sans-serif",android.graphics.Typeface.BOLD));
        p.setTextSize(Math.min(dp(30),w*.075f)); c.drawText("Sahabat ODHIV Sumut",w/2,h*.83f,p);
        p.setTypeface(android.graphics.Typeface.create("sans-serif",android.graphics.Typeface.NORMAL)); p.setTextSize(Math.min(dp(14),w*.038f)); p.setColor(cyan);
        c.drawText("To help people, to help themselves and others",w/2,h*.87f,p);
        p.setColor(Color.WHITE); p.setTextSize(dp(11)); c.drawText("Memuat aplikasi…",w/2,h*.92f,p);
        postInvalidateDelayed(40);
    }

    private void drawChild(Canvas c,float x,float ground,float s,int shirt,boolean taller) {
        float head=taller?dp(13)*s:dp(12)*s;
        float torso=taller?dp(43)*s:dp(37)*s;
        fill(c,Color.rgb(226,174,132)); c.drawCircle(x,ground-torso-head,head,p);
        fill(c,shirt); c.drawRoundRect(x-dp(12)*s,ground-torso,x+dp(12)*s,ground-dp(7)*s,dp(6)*s,dp(6)*s,p);
        line(c,Color.rgb(226,174,132),dp(5)*s);
        c.drawLine(x-dp(8)*s,ground-torso+dp(7)*s,x-dp(17)*s,ground-torso-dp(7)*s,p);
        c.drawLine(x+dp(8)*s,ground-torso+dp(7)*s,x+dp(13)*s,ground-torso+dp(14)*s,p);
        line(c,Color.rgb(35,42,51),dp(6)*s);
        c.drawLine(x-dp(5)*s,ground-dp(7)*s,x-dp(12)*s,ground+dp(10)*s,p);
        c.drawLine(x+dp(5)*s,ground-dp(7)*s,x+dp(13)*s,ground+dp(7)*s,p);
        fill(c,Color.rgb(255,255,255)); c.drawOval(x-dp(8)*s,ground+dp(5)*s,x-dp(1)*s,ground+dp(10)*s,p); c.drawOval(x+dp(9)*s,ground+dp(3)*s,x+dp(16)*s,ground+dp(8)*s,p);
    }
    private float dp(float n) { return n*getResources().getDisplayMetrics().density; }
}
