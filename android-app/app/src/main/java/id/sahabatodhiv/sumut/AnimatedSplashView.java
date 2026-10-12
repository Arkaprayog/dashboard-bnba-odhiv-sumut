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
        android.graphics.drawable.Drawable logo = getResources().getDrawable(R.drawable.ic_atensi_symbol, getContext().getTheme());
        int logoSize = (int)Math.min(w * 0.22f, dp(88));
        logo.setBounds((int)(w/2-logoSize/2), (int)(h*0.035f), (int)(w/2+logoSize/2), (int)(h*0.035f)+logoSize);
        logo.draw(c);
        p.setShader(null);
        p.setColor(Color.rgb(48,53,140));
        p.setTextAlign(Paint.Align.CENTER);
        p.setTypeface(android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.BOLD));
        p.setTextSize(dp(12));
        c.drawText("ATENSI", w/2, h*0.035f+logoSize+dp(13), p);
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
        float runPhase=(System.currentTimeMillis()-started)/150.0f;
        float stride=(float)Math.sin(runPhase);
        float bob=Math.abs((float)Math.sin(runPhase*2.0f))*dp(4)*scale;
        float y=ground-h*.02f-bob;
        // Both children visibly run: alternating arms and legs, bouncing bodies and forward movement.
        float travel=(float)Math.sin(t*Math.PI*2)*w*.018f;
        float leadX=w*.43f+travel;
        float smallX=w*.60f+travel;
        drawChild(c,leadX,y,scale*1.02f,green,true,runPhase);
        drawChild(c,smallX,y+dp(9),scale*.83f,blue,false,runPhase+1.1f);
        // Their joined hands move naturally with each running stride.
        line(c,Color.rgb(226,174,132),dp(3.2f)*scale);
        c.drawLine(leadX+dp(8)*scale,y-dp(35)*scale+dp(5)*scale*stride,
                   smallX-dp(8)*scale,y-dp(28)*scale-dp(4)*scale*stride,p);
        fill(c,Color.WHITE);
        p.setTextAlign(Paint.Align.CENTER); p.setTypeface(android.graphics.Typeface.create("sans-serif",android.graphics.Typeface.BOLD));
        p.setTextSize(Math.min(dp(30),w*.075f)); c.drawText("Sahabat ODHIV Sumut",w/2,h*.83f,p);
        p.setTypeface(android.graphics.Typeface.create("sans-serif",android.graphics.Typeface.NORMAL)); p.setTextSize(Math.min(dp(14),w*.038f)); p.setColor(cyan);
        c.drawText("To help people, to help themselves and others",w/2,h*.87f,p);
        p.setColor(Color.WHITE); p.setTextSize(dp(11)); c.drawText("Memuat aplikasi…",w/2,h*.92f,p);
        postInvalidateDelayed(40);
    }

    private void drawChild(Canvas c,float x,float ground,float s,int shirt,boolean taller,float phase) {
        float head=taller?dp(13)*s:dp(12)*s;
        float torso=taller?dp(43)*s:dp(37)*s;
        float swing=(float)Math.sin(phase);
        float opposite=(float)Math.sin(phase+Math.PI);
        float bounce=Math.abs((float)Math.sin(phase*2))*dp(2.8f)*s;
        float bodyTop=ground-torso+bounce;
        float headY=ground-torso-head+bounce;
        fill(c,Color.rgb(226,174,132));
        c.drawCircle(x,headY,head,p);
        // Hair and face details keep the two children distinct.
        fill(c,Color.rgb(42,31,26));
        c.drawArc(x-head*1.08f,headY-head*1.05f,x+head*.95f,headY+head*.15f,190,175,true,p);
        fill(c,shirt);
        c.drawRoundRect(x-dp(12)*s,bodyTop,x+dp(12)*s,ground-dp(7)*s+bounce,dp(6)*s,dp(6)*s,p);
        // Arms alternate forward/back as they run.
        line(c,Color.rgb(226,174,132),dp(5)*s);
        c.drawLine(x-dp(8)*s,bodyTop+dp(7)*s,
                x-dp(14)*s-dp(8)*s*swing,bodyTop-dp(3)*s+dp(10)*s*swing,p);
        c.drawLine(x+dp(8)*s,bodyTop+dp(7)*s,
                x+dp(13)*s+dp(8)*s*swing,bodyTop+dp(12)*s-dp(8)*s*swing,p);
        // Legs switch between a forward stride and a trailing stride each frame.
        line(c,Color.rgb(35,42,51),dp(6)*s);
        c.drawLine(x-dp(5)*s,ground-dp(7)*s+bounce,
                x-dp(10)*s-dp(9)*s*opposite,ground+dp(3)*s+dp(8)*s*swing,p);
        c.drawLine(x+dp(5)*s,ground-dp(7)*s+bounce,
                x+dp(10)*s+dp(9)*s*opposite,ground+dp(3)*s-dp(8)*s*swing,p);
        fill(c,Color.WHITE);
        c.drawOval(x-dp(17)*s-dp(9)*s*opposite,ground+dp(1)*s+dp(8)*s*swing,
                x-dp(5)*s-dp(9)*s*opposite,ground+dp(7)*s+dp(8)*s*swing,p);
        c.drawOval(x+dp(5)*s+dp(9)*s*opposite,ground+dp(1)*s-dp(8)*s*swing,
                x+dp(17)*s+dp(9)*s*opposite,ground+dp(7)*s-dp(8)*s*swing,p);
    }
    private float dp(float n) { return n*getResources().getDisplayMetrics().density; }
}
