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
shutil.copy("scripts/ic_stat_dua.xml", os.path.join(drawable, "ic_stat_dua.xml"))

# تشغيل الصوت أثناء إطفاء الشاشة: قفل تشغيل جزئي يُفعَّل من الجافاسكربت فقط أثناء التلاوة
java_dir = "android/app/src/main/java/com/duas/app"
os.makedirs(java_dir, exist_ok=True)
open(os.path.join(java_dir, "MainActivity.java"), "w", encoding="utf-8").write("""package com.duas.app;

import android.content.Context;
import android.os.Bundle;
import android.os.PowerManager;
import android.webkit.JavascriptInterface;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private PowerManager.WakeLock wl;
    private boolean hold = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "duas:audio");
        wl.setReferenceCounted(false);
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
        super.onDestroy();
    }
}
""")
print("patched OK")
