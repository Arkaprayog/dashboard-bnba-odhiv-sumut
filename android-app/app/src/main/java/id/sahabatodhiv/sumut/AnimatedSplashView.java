package id.sahabatodhiv.sumut;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.view.View;

/** New kite-and-friends loading scene. Does not load or display the obsolete splash bitmap. */
public final class AnimatedSplashView extends View {
    private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final long started = System.currentTimeMillis();
    private static final long DURATION_MS = 4000L;

    public AnimatedSplashView(Context context) {
        super(context);
        setLayerType(View.LAYER_TYPE_HARDWARE, null);
        setFocusable(false);
    }

    private float dp(float v) { return v * getResources().getDisplayMetrics().density; }
    private void color(Canvas c, int color) { p.setColor(color); p.setStyle(Paint.Style.FILL); p.setShader(null); }
    private void circle(Canvas c, float x, float y, float r, int color) {
        color(c, color); c.drawCircle(x, y, r, p);
    }
    private void line(Canvas c, float x1, float y1, float x2, float y2, float width, int color) {
        color(c, color); p.setStyle(Paint.Style.STROKE); p.setStrokeWidth(width); p.setStrokeCap(Paint.Cap.ROUND);
        c.drawLine(x1, y1, x2, y2, p); p.setStyle(Paint.Style.FILL);
    }
    private void rounded(Canvas c, float l, float t, float r, float b, float radius, int color) {
        color(c, color); c.drawRoundRect(new RectF(l,t,r,b),radius,radius,p);
    }
    private void text(Canvas c, String s, float x, float y, float size, int color, boolean bold) {
        color(c,color); p.setTextAlign(Paint.Align.CENTER); p.setTextSize(size);
        p.setTypeface(android.graphics.Typeface.create("sans-serif", bold ?  android.graphics.Typeface.BOLD : android.graphics.Typeface.NORMAL));
        c.drawText(s,x,y,p);
    }
    private void cloud(Canvas c,float x,float y,float scale) {
        int white=Color.rgb(225,249,255);
        line(c,x-18*scale,y+5*scale,x+19*scale,y+5*scale,2.0f*scale,white);
        p.setStyle(Paint.Style.STROKE); p.setStrokeWidth(2.0f*scale); p.setStrokeCap(Paint.Cap.ROUND);
        p.setColor(white); p.setShader(null);
        Path path=new Path(); path.moveTo(x-18*scale,y+5*scale); path.cubicTo(x-24*scale,y-4*scale,x-14*scale,y-11*scale,x-8*scale,y-5*scale);
        path.cubicTo(x-7*scale,y-18*scale,x+7*scale,y-17*scale,x+8*scale,y-6*scale);
        path.cubicTo(x+18*scale,y-12*scale,x+24*scale,y-3*scale,x+19*scale,y+5*scale);
        c.drawPath(path,p); p.setStyle(Paint.Style.FILL);
    }
    private void child(Canvas c,float x,float ground,float scale,boolean older) {
        int skin=Color.rgb(224,160,119), hair=Color.rgb(48,32,30), shirt=older?Color.rgb(43,79,55):Color.rgb(23,112,193);
        // Legs and shoes
        line(c,x-7*scale,ground-40*scale,x-17*scale,ground-7*scale,7*scale,Color.rgb(26,43,66));
        line(c,x+8*scale,ground-40*scale,x+22*scale,ground-9*scale,7*scale,Color.rgb(26,43,66));
        line(c,x-17*scale,ground-7*scale,x-28*scale,ground-5*scale,5*scale,Color.WHITE);
        line(c,x+22*scale,ground-9*scale,x+33*scale,ground-7*scale,5*scale,Color.WHITE);
        rounded(c,x-17*scale,ground-88*scale,x+18*scale,ground-35*scale,8*scale,shirt);
        // Arms
        line(c,x-12*scale,ground-78*scale,x-35*scale,ground-62*scale,7*scale,skin);
        line(c,x+12*scale,ground-78*scale,x+34*scale,ground-63*scale,7*scale,skin);
        circle(c,x,ground-103*scale,17*scale,skin);
        // Hair cap
        color(c,hair); Path cap=new Path(); cap.moveTo(x-17*scale,ground-106*scale);
        cap.quadTo(x-15*scale,ground-127*scale,x+2*scale,ground-120*scale);
        cap.quadTo(x+18*scale,ground-119*scale,x+17*scale,ground-103*scale);
        cap.quadTo(x,ground-108*scale,x-17*scale,ground-106*scale); c.drawPath(cap,p);
        circle(c,x-6*scale,ground-102*scale,1.1f*scale,hair); circle(c,x+6*scale,ground-102*scale,1.1f*scale,hair);
        line(c,x-4*scale,ground-95*scale,x+4*scale,ground-95*scale,1.2f*scale,hair);
    }

    @Override protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float w=getWidth(), h=getHeight(); if(w<=0||h<=0)return;
        float elapsed=Math.max(0,System.currentTimeMillis()-started);
        float progress=Math.min(1f,elapsed/(float)DURATION_MS);
        canvas.drawColor(Color.rgb(8,34,83));
        float pad=w*0.04f, top=h*0.18f, bottom=h*0.70f;
        rounded(canvas,pad,top,w-pad,bottom,dp(26),Color.rgb(103,207,236));
        canvas.save(); Path clip=new Path(); clip.addRoundRect(new RectF(pad,top,w-pad,bottom),dp(26),dp(26),Path.Direction.CW); canvas.clipPath(clip);
        // Bright sky and horizon
        color(canvas,Color.rgb(143,224,246)); canvas.drawRect(pad,top,w-pad,bottom,p);
        color(canvas,Color.rgb(227,249,249)); canvas.drawRect(pad,top+(bottom-top)*0.68f,w-pad,bottom,p);
        circle(canvas,w*0.80f,top+(bottom-top)*0.15f,dp(20),Color.rgb(255,238,143));
        cloud(canvas,w*0.15f,top+(bottom-top)*0.22f,0.72f); cloud(canvas,w*0.85f,top+(bottom-top)*0.34f,0.65f);
        // Green rounded hill
        color(canvas,Color.rgb(128,185,108)); Path hill=new Path(); hill.moveTo(pad,bottom-(bottom-top)*0.12f);
        hill.quadTo(w*0.48f,bottom-(bottom-top)*0.54f,w-pad,bottom-(bottom-top)*0.12f);
        hill.lineTo(w-pad,bottom); hill.lineTo(pad,bottom); hill.close(); canvas.drawPath(hill,p);
        // Kite drifts gently, with a visible string
        float kx=w*0.72f+(float)Math.sin(progress*Math.PI*2)*w*0.025f;
        float ky=top+(bottom-top)*0.20f+(float)Math.sin(progress*Math.PI*2)*dp(5);
        Path string=new Path(); string.moveTo(kx,ky+dp(22)); string.cubicTo(kx-dp(16),ky+dp(43),kx+dp(18),ky+dp(48),kx-dp(4),ky+dp(62));
        line(canvas,kx,ky+dp(20),kx-dp(3),ky+dp(31),dp(1.3f),Color.WHITE);
        p.setStyle(Paint.Style.STROKE); p.setStrokeWidth(dp(1.3f)); p.setColor(Color.WHITE); canvas.drawPath(string,p); p.setStyle(Paint.Style.FILL);
        Path kite=new Path(); kite.moveTo(kx,ky-dp(23)); kite.lineTo(kx+dp(17),ky); kite.lineTo(kx,ky+dp(23)); kite.lineTo(kx-dp(17),ky); kite.close();
        color(canvas,Color.rgb(250,39,57)); canvas.drawPath(kite,p);
        line(canvas,kx-dp(17),ky,kx+dp(17),ky,dp(1.2f),Color.WHITE);
        line(canvas,kx,ky-dp(23),kx,ky+dp(23),dp(1.2f),Color.WHITE);
        // Two friends running together
        float ground=bottom-(bottom-top)*0.16f;
        child(canvas,w*0.39f,ground,Math.min(1.0f,w/400f),true);
        child(canvas,w*0.61f,ground+dp(4),Math.min(0.78f,w/480f),false);
        canvas.restore();
        // Brand message on a clean dark-blue field, matching the new reference screen.
        text(canvas,"Sahabat ODHIV Sumut",w/2f,h*0.79f,Math.min(dp(25),w*0.057f),Color.WHITE,true);
        text(canvas,"To help people, to help themselves and others",w/2f,h*0.825f,Math.min(dp(13),w*0.031f),Color.rgb(190,225,242),false);
        text(canvas,"Membuka kuisioner responden...",w/2f,h*0.91f,Math.min(dp(14),w*0.034f),Color.rgb(224,239,250),false);
        setAlpha(Math.max(0f,Math.min(1f,(DURATION_MS-elapsed)/350f)));
        if(elapsed<DURATION_MS)postInvalidateDelayed(40L);
    }
}