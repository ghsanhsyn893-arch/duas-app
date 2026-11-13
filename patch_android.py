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
open(manifest, "w", encoding="utf-8").write(s)

drawable = "android/app/src/main/res/drawable"
os.makedirs(drawable, exist_ok=True)
for _src in ("scripts/ic_stat_dua.xml", "ic_stat_dua.xml", "../ic_stat_dua.xml"):
    if os.path.exists(_src):
        shutil.copy(_src, os.path.join(drawable, "ic_stat_dua.xml"))
        break

# تشغيل الصوت أثناء إطفاء الشاشة: قفل تشغيل جزئي يُفعَّل من الجافاسكربت فقط أثناء التلاوة
java_dir = "android/app/src/main/java/com/duas/app"
os.makedirs(java_dir, exist_ok=True)
open(os.path.join(java_dir, "MainActivity.java"), "w", encoding="utf-8").write("""package com.duas.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.drawable.Icon;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.webkit.JavascriptInterface;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private PowerManager.WakeLock wl;
    private boolean hold = false;
    private MediaSession msess;
    private String mTitle = "", mArtist = "";
    private boolean mPlaying = false;
    private long mPos = 0, mDur = 0;
    private static final String CH = "duas_media";
    private static final int NID = 7731;
    private static final String ACT = "com.duas.app.MEDIA";

    private void js(final String cmd) {
        try {
            if (getBridge() == null || getBridge().getWebView() == null) return;
            final String code = "window.__mc&&window.__mc('" + cmd + "')";
            runOnUiThread(new Runnable() { public void run() {
                try { getBridge().getWebView().evaluateJavascript(code, null); } catch (Exception e) { }
            }});
        } catch (Exception e) { }
    }

    private PendingIntent pi(String cmd, int rc) {
        Intent i = new Intent(ACT).setPackage(getPackageName()).putExtra("c", cmd);
        int fl = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        return PendingIntent.getBroadcast(this, rc, i, fl);
    }

    private void setupMedia() {
        try {
            if (Build.VERSION.SDK_INT < 26) return;
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            NotificationChannel ch = new NotificationChannel(CH, "مشغّل الصوت", NotificationManager.IMPORTANCE_LOW);
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
            msess = new MediaSession(this, "duas");
            msess.setCallback(new MediaSession.Callback() {
                @Override public void onPlay() { js("play"); }
                @Override public void onPause() { js("pause"); }
                @Override public void onSkipToNext() { js("next"); }
                @Override public void onSkipToPrevious() { js("prev"); }
                @Override public void onSeekTo(long pos) { js("seek:" + (pos / 1000)); }
            });
            msess.setActive(true);
            BroadcastReceiver r = new BroadcastReceiver() {
                @Override public void onReceive(Context c, Intent i) {
                    String cmd = i.getStringExtra("c");
                    if (cmd != null) js(cmd);
                }
            };
            IntentFilter f = new IntentFilter(ACT);
            if (Build.VERSION.SDK_INT >= 33) registerReceiver(r, f, Context.RECEIVER_NOT_EXPORTED);
            else registerReceiver(r, f);
        } catch (Exception e) { msess = null; }
    }

    private void refreshMedia() {
        try {
            if (msess == null || Build.VERSION.SDK_INT < 26) return;
            if (mTitle.length() == 0) {
                ((NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE)).cancel(NID);
                return;
            }
            msess.setMetadata(new MediaMetadata.Builder()
                .putString(MediaMetadata.METADATA_KEY_TITLE, mTitle)
                .putString(MediaMetadata.METADATA_KEY_ARTIST, mArtist)
                .putLong(MediaMetadata.METADATA_KEY_DURATION, mDur).build());
            long acts = PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_PLAY_PAUSE
                | PlaybackState.ACTION_SKIP_TO_NEXT | PlaybackState.ACTION_SKIP_TO_PREVIOUS | PlaybackState.ACTION_SEEK_TO;
            msess.setPlaybackState(new PlaybackState.Builder().setActions(acts)
                .setState(mPlaying ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED, mPos, mPlaying ? 1f : 0f).build());
            Notification.Builder nb = new Notification.Builder(this, CH)
                .setSmallIcon(getResources().getIdentifier("ic_stat_dua", "drawable", getPackageName()))
                .setContentTitle(mTitle).setContentText(mArtist)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setOngoing(mPlaying).setOnlyAlertOnce(true)
                .setContentIntent(PendingIntent.getActivity(this, 0,
                    getPackageManager().getLaunchIntentForPackage(getPackageName()),
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
            nb.addAction(new Notification.Action.Builder(Icon.createWithResource(this, android.R.drawable.ic_media_previous), "السابق", pi("prev", 1)).build());
            if (mPlaying) nb.addAction(new Notification.Action.Builder(Icon.createWithResource(this, android.R.drawable.ic_media_pause), "إيقاف", pi("pause", 2)).build());
            else nb.addAction(new Notification.Action.Builder(Icon.createWithResource(this, android.R.drawable.ic_media_play), "تشغيل", pi("play", 3)).build());
            nb.addAction(new Notification.Action.Builder(Icon.createWithResource(this, android.R.drawable.ic_media_next), "التالي", pi("next", 4)).build());
            nb.setStyle(new Notification.MediaStyle().setMediaSession(msess.getSessionToken()).setShowActionsInCompactView(0, 1, 2));
            ((NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE)).notify(NID, nb.build());
        } catch (Exception e) { }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "duas:audio");
        wl.setReferenceCounted(false);
        setupMedia();
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
                    mTitle = title == null ? "" : title; mArtist = artist == null ? "" : artist;
                    mPlaying = playing; mPos = posSec * 1000L; mDur = durSec * 1000L;
                    refreshMedia();
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
        try { ((NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE)).cancel(NID); if (msess != null) msess.release(); } catch (Exception e) { }
        super.onDestroy();
    }
}
""")
print("patched OK")
