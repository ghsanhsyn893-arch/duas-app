"""يعدّل مشروع الأندرويد بعد `npx cap add android`:
- يضيف صلاحيات الإشعارات
- ينسخ أيقونة الإشعار الصغيرة
"""
import os, re, shutil, sys

manifest = "android/app/src/main/AndroidManifest.xml"
perms = [
    "android.permission.POST_NOTIFICATIONS",
    "android.permission.RECEIVE_BOOT_COMPLETED",
    "android.permission.SCHEDULE_EXACT_ALARM",
    "android.permission.VIBRATE",
    "android.permission.WAKE_LOCK",
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
]
s = open(manifest, encoding="utf-8").read()
add = ""
for p in perms:
    if p not in s:
        add += f'    <uses-permission android:name="{p}" />\n'
if add:
    s = s.replace("</manifest>", add + "</manifest>")
# اتجاه RTL
if "android:supportsRtl" not in s:
    s = s.replace("<application", '<application android:supportsRtl="true"', 1)
if "AudioService" not in s:
    s = s.replace("</application>", '    <service android:name=".AudioService" android:foregroundServiceType="mediaPlayback" android:exported="false" />\n    </application>')
open(manifest, "w", encoding="utf-8").write(s)

drawable = "android/app/src/main/res/drawable"
os.makedirs(drawable, exist_ok=True)
for _src in ("scripts/ic_stat_dua.xml", "ic_stat_dua.xml", "../ic_stat_dua.xml"):
    if os.path.exists(_src):
        shutil.copy(_src, os.path.join(drawable, "ic_stat_dua.xml"))
        break

# أيقونة التطبيق من icon-only.png (احتياطي مضمون لو فشلت خطوة توليد الأيقونات)
def make_icons():
    src = None
    for c in ("icon-only.png", "assets/icon-only.png", "../icon-only.png"):
        if os.path.exists(c):
            src = c
            break
    if not src:
        print("icon-only.png not found")
        return
    try:
        from PIL import Image, ImageDraw
    except Exception:
        import subprocess
        subprocess.call([sys.executable, "-m", "pip", "install", "--break-system-packages", "-q", "pillow"])
        from PIL import Image, ImageDraw
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    m = min(w, h)
    im = im.crop(((w - m) // 2, (h - m) // 2, (w - m) // 2 + m, (h - m) // 2 + m))
    res = "android/app/src/main/res"
    legacy = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    for dens, px in legacy.items():
        d = os.path.join(res, "mipmap-" + dens)
        os.makedirs(d, exist_ok=True)
        sq = im.resize((px, px), Image.LANCZOS)
        sq.save(os.path.join(d, "ic_launcher.png"))
        mask = Image.new("L", (px * 4, px * 4), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, px * 4 - 1, px * 4 - 1), fill=255)
        mask = mask.resize((px, px), Image.LANCZOS)
        rd = Image.new("RGBA", (px, px), (0, 0, 0, 0))
        rd.paste(sq, (0, 0), mask)
        rd.save(os.path.join(d, "ic_launcher_round.png"))
        fpx = px * 108 // 48
        inner = int(fpx * 0.62)
        fg = Image.new("RGBA", (fpx, fpx), (0, 0, 0, 0))
        fg.paste(im.resize((inner, inner), Image.LANCZOS), ((fpx - inner) // 2, (fpx - inner) // 2))
        fg.save(os.path.join(d, "ic_launcher_foreground.png"))
    os.makedirs(os.path.join(res, "values"), exist_ok=True)
    open(os.path.join(res, "values", "ic_launcher_background.xml"), "w").write(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0F3D2E</color>\n</resources>\n')
    # أيقونة التكيّف (أندرويد 8+): نكتب ملفات XML صراحةً حتى لا تبقى أيقونة Capacitor الافتراضية
    ad = os.path.join(res, "mipmap-anydpi-v26")
    os.makedirs(ad, exist_ok=True)
    xml = ('<?xml version="1.0" encoding="utf-8"?>\n'
           '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
           '    <background android:drawable="@color/ic_launcher_background"/>\n'
           '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
           '</adaptive-icon>\n')
    for nm in ("ic_launcher.xml", "ic_launcher_round.xml"):
        open(os.path.join(ad, nm), "w", encoding="utf-8").write(xml)
    # نمنع خطوة @capacitor/assets من الكتابة فوق أيقونتنا
    for _p in ("assets/icon-only.png", "assets/icon-foreground.png", "assets/icon-background.png"):
        try:
            os.remove(_p)
        except Exception:
            pass
    print("app icons updated")

try:
    make_icons()
except Exception as e:
    print("icon step skipped:", e)

# غلاف القرآن لإشعار المشغّل
nodpi = "android/app/src/main/res/drawable-nodpi"
os.makedirs(nodpi, exist_ok=True)
for _c in ("covers/quran.jpg", "quran.jpg", "../covers/quran.jpg"):
    if os.path.exists(_c):
        shutil.copy(_c, os.path.join(nodpi, "quran_cover.jpg"))
        break

# تشغيل الصوت أثناء إطفاء الشاشة + خدمة مقدّمة لمشغّل الوسائط
java_dir = "android/app/src/main/java/com/duas/app"
os.makedirs(java_dir, exist_ok=True)
MAIN = r"""package com.duas.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.webkit.JavascriptInterface;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private PowerManager.WakeLock wl;
    private boolean hold = false;
    static final String ACT = "com.duas.app.MEDIA";

    private void js(final String cmd) {
        try {
            if (getBridge() == null || getBridge().getWebView() == null) return;
            final String code = "window.__mc&&window.__mc('" + cmd + "')";
            runOnUiThread(new Runnable() { public void run() {
                try { getBridge().getWebView().evaluateJavascript(code, null); } catch (Exception e) { }
            }});
        } catch (Exception e) { }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "duas:audio");
        wl.setReferenceCounted(false);
        try {
            BroadcastReceiver r = new BroadcastReceiver() {
                @Override public void onReceive(Context c, Intent i) {
                    String cmd = i.getStringExtra("c");
                    if (cmd != null) js(cmd);
                }
            };
            IntentFilter f = new IntentFilter(ACT);
            if (Build.VERSION.SDK_INT >= 33) registerReceiver(r, f, Context.RECEIVER_NOT_EXPORTED);
            else registerReceiver(r, f);
        } catch (Exception e) { }
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().addJavascriptInterface(new Object() {
                @JavascriptInterface
                public void hold(boolean on) {
                    hold = on;
                    try {
                        if (on && !wl.isHeld()) wl.acquire(6 * 60 * 60 * 1000L);
                        if (!on && wl.isHeld()) wl.release();
                    } catch (Exception e) { }
                }
                @JavascriptInterface
                public void media(String title, String artist, boolean playing, int posSec, int durSec) {
                    try {
                        Intent si = new Intent(MainActivity.this, AudioService.class);
                        si.putExtra("title", title == null ? "" : title);
                        si.putExtra("artist", artist == null ? "" : artist);
                        si.putExtra("playing", playing);
                        si.putExtra("pos", posSec * 1000L);
                        si.putExtra("dur", durSec * 1000L);
                        if (Build.VERSION.SDK_INT >= 26) startForegroundService(si); else startService(si);
                    } catch (Exception e) { }
                }
            }, "NativeAudio");
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        if (hold && getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().resumeTimers();
        }
    }

    @Override
    public void onDestroy() {
        try { if (wl != null && wl.isHeld()) wl.release(); } catch (Exception e) { }
        try { stopService(new Intent(this, AudioService.class)); } catch (Exception e) { }
        super.onDestroy();
    }
}
"""
SVC = r"""package com.duas.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.drawable.Icon;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.IBinder;

public class AudioService extends Service {
    private static final String CH = "duas_media";
    private static final int NID = 7731;
    private MediaSession ms;
    private Bitmap cover;

    private void cmd(String c) {
        try { sendBroadcast(new Intent(MainActivity.ACT).setPackage(getPackageName()).putExtra("c", c)); } catch (Exception e) { }
    }

    private PendingIntent pi(String c, int rc) {
        Intent i = new Intent(MainActivity.ACT).setPackage(getPackageName()).putExtra("c", c);
        return PendingIntent.getBroadcast(this, rc, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationChannel ch = new NotificationChannel(CH, "مشغّل الصوت", NotificationManager.IMPORTANCE_LOW);
                ch.setShowBadge(false);
                ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(ch);
            }
            ms = new MediaSession(this, "duas");
            ms.setCallback(new MediaSession.Callback() {
                @Override public void onPlay() { cmd("play"); }
                @Override public void onPause() { cmd("pause"); }
                @Override public void onSkipToNext() { cmd("next"); }
                @Override public void onSkipToPrevious() { cmd("prev"); }
                @Override public void onSeekTo(long pos) { cmd("seek:" + (pos / 1000)); }
            });
            ms.setActive(true);
            int cid = getResources().getIdentifier("quran_cover", "drawable", getPackageName());
            if (cid != 0) {
                BitmapFactory.Options o = new BitmapFactory.Options(); o.inSampleSize = 2;
                cover = BitmapFactory.decodeResource(getResources(), cid, o);
            }
        } catch (Exception e) { }
    }

    @Override
    public int onStartCommand(Intent in, int flags, int startId) {
        String title = in == null ? "" : in.getStringExtra("title");
        String artist = in == null ? "" : in.getStringExtra("artist");
        boolean playing = in != null && in.getBooleanExtra("playing", false);
        long pos = in == null ? 0 : in.getLongExtra("pos", 0);
        long dur = in == null ? 0 : in.getLongExtra("dur", 0);
        if (title == null || title.length() == 0) {
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }
        try {
            ms.setMetadata(new MediaMetadata.Builder()
                .putString(MediaMetadata.METADATA_KEY_TITLE, title)
                .putString(MediaMetadata.METADATA_KEY_ARTIST, artist)
                .putLong(MediaMetadata.METADATA_KEY_DURATION, dur)
                .putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, cover).build());
            long acts = PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_PLAY_PAUSE
                | PlaybackState.ACTION_SKIP_TO_NEXT | PlaybackState.ACTION_SKIP_TO_PREVIOUS | PlaybackState.ACTION_SEEK_TO;
            ms.setPlaybackState(new PlaybackState.Builder().setActions(acts)
                .setState(playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED, pos, playing ? 1f : 0f).build());
            ms.setActive(true);
        } catch (Exception e) { }
        int icon = getResources().getIdentifier("ic_stat_dua", "drawable", getPackageName());
        if (icon == 0) icon = android.R.drawable.ic_media_play;
        Notification.Builder nb = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CH) : new Notification.Builder(this);
        if (cover != null) nb.setLargeIcon(cover);
        nb.setSmallIcon(icon).setContentTitle(title).setContentText(artist)
            .setVisibility(Notification.VISIBILITY_PUBLIC).setOngoing(playing).setOnlyAlertOnce(true)
            .setContentIntent(PendingIntent.getActivity(this, 0,
                getPackageManager().getLaunchIntentForPackage(getPackageName()),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        nb.addAction(new Notification.Action.Builder(Icon.createWithResource(this, android.R.drawable.ic_media_previous), "السابق", pi("prev", 1)).build());
        if (playing) nb.addAction(new Notification.Action.Builder(Icon.createWithResource(this, android.R.drawable.ic_media_pause), "إيقاف", pi("pause", 2)).build());
        else nb.addAction(new Notification.Action.Builder(Icon.createWithResource(this, android.R.drawable.ic_media_play), "تشغيل", pi("play", 3)).build());
        nb.addAction(new Notification.Action.Builder(Icon.createWithResource(this, android.R.drawable.ic_media_next), "التالي", pi("next", 4)).build());
        nb.setStyle(new Notification.MediaStyle().setMediaSession(ms.getSessionToken()).setShowActionsInCompactView(0, 1, 2));
        try {
            startForeground(NID, nb.build());
            if (!playing) stopForeground(false);
        } catch (Exception e) { }
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        try { if (ms != null) ms.release(); } catch (Exception e) { }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent i) { return null; }
}
"""
open(os.path.join(java_dir, "MainActivity.java"), "w", encoding="utf-8").write(MAIN)
open(os.path.join(java_dir, "AudioService.java"), "w", encoding="utf-8").write(SVC)
print("patched OK")
