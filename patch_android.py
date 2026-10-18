"""يعدّل مشروع الأندرويد بعد `npx cap add android`:
- يضيف صلاحيات الإشعارات
- ينشئ أيقونة الإشعار الصغيرة (بدون الحاجة لملف إضافي)
"""
import os

manifest = "android/app/src/main/AndroidManifest.xml"
perms = [
    "android.permission.POST_NOTIFICATIONS",
    "android.permission.RECEIVE_BOOT_COMPLETED",
    "android.permission.SCHEDULE_EXACT_ALARM",
    "android.permission.VIBRATE",
]
s = open(manifest, encoding="utf-8").read()
add = ""
for p in perms:
    if p not in s:
        add += f'    <uses-permission android:name="{p}" />\n'
if add:
    s = s.replace("</manifest>", add + "</manifest>")
if "android:supportsRtl" not in s:
    s = s.replace("<application", '<application android:supportsRtl="true"', 1)
open(manifest, "w", encoding="utf-8").write(s)

ICON = """<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#FFFFFFFF"
        android:pathData="M12,3a9,9 0 1,0 9,9a7,7 0 0,1 -9,-9z" />
</vector>
"""
drawable = "android/app/src/main/res/drawable"
os.makedirs(drawable, exist_ok=True)
with open(os.path.join(drawable, "ic_stat_dua.xml"), "w", encoding="utf-8") as f:
    f.write(ICON)
print("patched OK")
