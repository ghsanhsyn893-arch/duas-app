"""يعدّل مشروع الأندرويد بعد `npx cap add android`:
- يضيف صلاحيات الإشعارات
- ينسخ أيقونة الإشعار الصغيرة (يبحث عنها في المجلد الحالي أو في scripts/)
"""
import os, shutil

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
# اتجاه RTL
if "android:supportsRtl" not in s:
    s = s.replace("<application", '<application android:supportsRtl="true"', 1)
open(manifest, "w", encoding="utf-8").write(s)

drawable = "android/app/src/main/res/drawable"
os.makedirs(drawable, exist_ok=True)
for cand in ("ic_stat_dua.xml", "scripts/ic_stat_dua.xml"):
    if os.path.exists(cand):
        shutil.copy(cand, os.path.join(drawable, "ic_stat_dua.xml"))
        print("icon copied from", cand)
        break
else:
    print("WARNING: ic_stat_dua.xml not found; skipping icon")
print("patched OK")
