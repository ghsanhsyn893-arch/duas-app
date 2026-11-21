(function () {
  "use strict";

  var REMOTE_URL = "https://raw.githubusercontent.com/ghsanhsyn893-arch/duas-app/main/data.json";
  var DATA = window.DATA;
  var ITEMS = DATA.items;
  var CATS = DATA.categories;
  var BOOKS = DATA.books || [];
  var VERSION = DATA.version || 1;
  var OCC = DATA.occasions || [];
  var MS = parseStarts(DATA.month_starts);

  // أمان: لا نقبل إلا روابط https لأي رابط يأتي من بيانات خارجية
  function httpsOnly(u) { return typeof u === "string" && /^https:\/\//i.test(u) ? u : ""; }
  // روابط الصوت/الحزم القادمة من ملف البيانات: فقط من نطاقات معروفة (https)
  var TRUST_HOSTS = ["raw.githubusercontent.com", "ghsanhsyn893-arch.github.io", "assets.world-federation.org", "mp3quran.net", "yahosein.com"];
  function trustedUrl(u) {
    var m = typeof u === "string" && /^https:\/\/([^\/:?#@\\]+)(?::\d+)?(?:[\/?#]|$)/i.exec(u);
    if (!m) return "";
    var h = m[1].toLowerCase();
    return TRUST_HOSTS.some(function (t) { return h === t || h.slice(-t.length - 1) === "." + t; }) ? u : "";
  }
  // تحقق بنيوي صارم من البيانات الخارجية: أنواع، أطوال، مفاتيح، روابط، ومسارات الملفات
  function validData(d) {
    function isStr(v, max) { return typeof v === "string" && v.length <= max; }
    function isObj(v) { return v && typeof v === "object" && !Array.isArray(v); }
    function safeF(f) { return isStr(f, 200) && f.length > 0 && !/(^[\/\\])|(\.\.)|(:\/\/)/.test(f); }
    try {
      if (!isObj(d) || typeof d.version !== "number" || !isFinite(d.version) || d.version < 1 || d.version > 1e7) return false;
      if (!isObj(d.items) || !Array.isArray(d.categories) || d.categories.length > 300) return false;
      var ik = Object.keys(d.items);
      if (ik.length > 20000) return false;
      for (var i = 0; i < ik.length; i++) {
        var k = ik[i], it = d.items[k];
        if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(k) || k.indexOf("my:") === 0 || k === "__proto__" || k === "constructor" || k === "prototype") return false;
        if (!isObj(it) || !isStr(it.title, 300) || !isStr(it.text, 500000)) return false;
        if (it.source !== undefined && !isStr(it.source, 1000)) return false;
        if (it.audio !== undefined) {
          if (!Array.isArray(it.audio) || it.audio.length > 20) return false;
          for (var a = 0; a < it.audio.length; a++) {
            var au = it.audio[a];
            if (!isObj(au)) return false;
            if (au.u !== undefined && !trustedUrl(au.u)) return false;
            if (au.f !== undefined && !safeF(au.f)) return false;
            if (au.by !== undefined && !isStr(au.by, 200)) return false;
          }
        }
      }
      for (var c = 0; c < d.categories.length; c++) {
        var cc = d.categories[c];
        if (!isObj(cc) || !isStr(cc.id, 60) || !cc.id || !isStr(cc.name, 200) || !Array.isArray(cc.keys) || cc.keys.length > 20000) return false;
        if (cc.icon !== undefined && !isStr(cc.icon, 16)) return false;
        if (cc.parent !== undefined && !isStr(cc.parent, 60)) return false;
        for (var j = 0; j < cc.keys.length; j++) if (typeof cc.keys[j] !== "string" || !Object.prototype.hasOwnProperty.call(d.items, cc.keys[j])) return false;
      }
      if (d.books !== undefined) {
        if (!Array.isArray(d.books) || d.books.length > 2000) return false;
        for (var b = 0; b < d.books.length; b++) {
          var bk = d.books[b];
          if (!isObj(bk) || !/^[A-Za-z0-9_-]{1,80}$/.test(String(bk.id)) || !isStr(bk.title, 300)) return false;
          if (bk.packBase !== undefined && !trustedUrl(bk.packBase)) return false;
          ["author", "desc", "source", "kind"].forEach(function (f) { if (bk[f] !== undefined && !isStr(bk[f], 3000)) bk.__bad = 1; });
          if (bk.__bad) return false;
          if (bk.volumes !== undefined) {
            if (!Array.isArray(bk.volumes) || bk.volumes.length > 500) return false;
            for (var v = 0; v < bk.volumes.length; v++) {
              var vo = bk.volumes[v];
              if (!isObj(vo) || !isStr(String(vo.id), 80) || (vo.title !== undefined && !isStr(vo.title, 300))) return false;
              if (vo.pages !== undefined && !(Number.isInteger(vo.pages) && vo.pages >= 0 && vo.pages <= 50000)) return false;
              if (vo.parts !== undefined) {
                if (!Array.isArray(vo.parts) || vo.parts.length > 2000) return false;
                for (var p = 0; p < vo.parts.length; p++) {
                  var pt = vo.parts[p];
                  if (!isObj(pt) || !safeF(pt.f)) return false;
                  // sizes: مصفوفة أعداد صحيحة منطقية (حجم الصفحة ≤ 20MB، مجموع الجزء ≤ 300MB)
                  if (!Array.isArray(pt.sizes) || pt.sizes.length < 1 || pt.sizes.length > 2000) return false;
                  var sum = 0;
                  for (var z = 0; z < pt.sizes.length; z++) {
                    var sz = pt.sizes[z];
                    if (!Number.isInteger(sz) || sz < 1 || sz > 20e6) return false;
                    sum += sz;
                  }
                  if (sum > 300e6) return false;
                }
              }
            }
          }
        }
      }
      if (d.occasions !== undefined) {
        if (!Array.isArray(d.occasions) || d.occasions.length > 2000) return false;
        for (var o = 0; o < d.occasions.length; o++) {
          var oc = d.occasions[o];
          if (!isObj(oc) || !Number.isInteger(oc.m) || oc.m < 1 || oc.m > 12 || !Number.isInteger(oc.d) || oc.d < 1 || oc.d > 31 || !isStr(oc.t, 300)) return false;
        }
      }
      if (d.month_starts !== undefined && !isObj(d.month_starts)) return false;
      return true;
    } catch (e) { return false; }
  }
  function applyData(d) {
    DATA = d; ITEMS = d.items; CATS = d.categories; BOOKS = d.books || []; VERSION = d.version; OCC = d.occasions || []; MS = parseStarts(d.month_starts);
    syncMine();
  }
  // أذكاري: نصوص يكتبها المستخدم بنفسه (تُحفظ محلياً)
  var MINE_MAX = 60000;   // أطول نص مسموح (الأطول من هذا يُبطئ العرض كثيراً)
  function getMine() {
    try {
      var m = JSON.parse(localStorage.getItem("mine") || "[]");
      return Array.isArray(m) ? m.filter(function (x) { return x && typeof x.id === "string" && typeof x.title === "string" && typeof x.text === "string"; }) : [];
    } catch (e) { return []; }
  }
  function setMine(m) { try { localStorage.setItem("mine", JSON.stringify(m)); } catch (e) {} }
  function syncMine() {
    Object.keys(ITEMS).forEach(function (k) { if (k.indexOf("my:") === 0) delete ITEMS[k]; });
    getMine().forEach(function (x) { ITEMS["my:" + x.id] = { title: x.title.slice(0, 200), text: x.text.length > MINE_MAX ? x.text.slice(0, MINE_MAX) + "\n\n… (قُصّ النص لطوله)" : x.text, mine: true }; });
  }
  // آخر نسخة محفوظة من الإنترنت (إن كانت أحدث من المدمجة)
  try {
    var cached = JSON.parse(localStorage.getItem("remoteData") || "null");
    if (validData(cached) && cached.version > VERSION) applyData(cached);
  } catch (e) {}

  /* ---------------- تخزين الإعدادات ---------------- */
  var DEFAULTS = {
    theme: "auto",
    nav: "normal",
    glass: 45,
    bg: true,                              // صورة خلفية التطبيق
    bga: 35,                               // وضوح الصورة (0-100)
    fs: 22,
    lh: 2.1,                               // تباعد الأسطر
    calm: false,                           // وضع القراءة الهادئ
    awake: false,                          // إبقاء الشاشة مضيئة أثناء القراءة
    daily: { on: false, time: "08:00" },   // حديث يومي بوقت الشخص
    away: { on: true },                    // تذكير عند الغياب
    sabah: { on: false, time: "06:00" },   // دعاء الصباح يومياً
    kumil: { on: false, time: "20:00" },   // دعاء كميل ليلة الجمعة (الخميس)
    nudba: { on: false, time: "06:00" }    // دعاء الندبة صباح الجمعة
  };

  function loadCfg() {
    var cfg = JSON.parse(JSON.stringify(DEFAULTS));
    try {
      var raw = localStorage.getItem("cfg");
      if (raw) {
        var s = JSON.parse(raw);
        Object.keys(cfg).forEach(function (k) {
          if (s[k] === undefined) return;
          if (typeof cfg[k] === "object") {
            Object.keys(cfg[k]).forEach(function (j) {
              if (s[k][j] !== undefined) cfg[k][j] = s[k][j];
            });
          } else cfg[k] = s[k];
        });
      }
    } catch (e) {}
    // تنظيف القيم: أي قيمة تالفة أو خارج الحدود ترجع للافتراضي/الحد المسموح
    function num(v, lo, hi, d) { v = +v; return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; }
    cfg.fs = num(cfg.fs, 16, 40, DEFAULTS.fs);
    cfg.lh = num(cfg.lh, 1.6, 3, DEFAULTS.lh);
    cfg.glass = num(cfg.glass, 0, 100, DEFAULTS.glass);
    cfg.bga = num(cfg.bga, 0, 100, DEFAULTS.bga);
    if (["auto", "light", "dark"].indexOf(cfg.theme) < 0) cfg.theme = DEFAULTS.theme;
    if (["normal", "glass"].indexOf(cfg.nav) < 0) cfg.nav = DEFAULTS.nav;
    ["bg", "calm", "awake"].forEach(function (k) { cfg[k] = !!cfg[k]; });
    ["daily", "away", "sabah", "kumil", "nudba"].forEach(function (k) {
      if (!cfg[k] || typeof cfg[k] !== "object") cfg[k] = JSON.parse(JSON.stringify(DEFAULTS[k]));
      cfg[k].on = !!cfg[k].on;
      if (DEFAULTS[k].time && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(String(cfg[k].time))) cfg[k].time = DEFAULTS[k].time;
    });
    return cfg;
  }
  var cfg = loadCfg();

  function saveCfg() {
    try { localStorage.setItem("cfg", JSON.stringify(cfg)); } catch (e) {}
  }

  /* ---------------- أدوات ---------------- */
  var $ = function (id) { return document.getElementById(id); };
  var viewEl = $("view"), titleEl = $("title"), btnBack = $("btnBack"), btnSettings = $("btnSettings");

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  var toastTimer;
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  function norm(s) {
    return (s || "")
      .replace(/[\u064B-\u0670\u06D6-\u06ED\u0640\u200C-\u200F]/g, "")
      .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627")
      .replace(/\u0649/g, "\u064A").replace(/\u06CC/g, "\u064A")
      .replace(/\u0629/g, "\u0647")
      .replace(/\u0624/g, "\u0648").replace(/\u0626/g, "\u064A").replace(/\u0621/g, "")
      .replace(/\u06A9/g, "\u0643")
      .replace(/[\u0660-\u0669]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
      .replace(/[\u06F0-\u06F9]/g, function (d) { return String(d.charCodeAt(0) - 0x06F0); })
      .replace(/[\u060C\u061B\u061F.,;:!?()\[\]{}"'«»]/g, " ")
      .replace(/\s+/g, " ")
      .toLowerCase();
  }
  // كل الكلمات لازم توجد (بأي ترتيب)
  function has(h, q) {
    var w = q.split(" ");
    for (var i = 0; i < w.length; i++) if (w[i] && h.indexOf(w[i]) === -1) return false;
    return true;
  }
  var INDEX = {}, BINDEX = [];
  function buildIndex() {
    INDEX = {}; BINDEX = [];
    Object.keys(ITEMS).forEach(function (k) {
      INDEX[k] = norm(ITEMS[k].title + " " + ITEMS[k].text);
    });
    BOOKS.forEach(function (b) {
      (b.chapters || []).forEach(function (c, i) {
        BINDEX.push({ id: b.id, i: i, book: b.title, title: c.title, n: norm(c.title + " " + c.text) });
      });
    });
  }
  syncMine();
  buildIndex();

  function applyTheme() {
    var t = cfg.theme;
    if (t === "auto") {
      t = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-theme", t);
    document.documentElement.setAttribute("data-nav", cfg.nav === "glass" ? "glass" : "normal");
    document.documentElement.setAttribute("data-bg", cfg.bg ? "1" : "0");
    document.documentElement.style.setProperty("--bgv", String(Math.max(0, Math.min(100, +cfg.bga || 0)) / 100));
    document.documentElement.style.setProperty("--ga", String(0.15 + Math.max(0, Math.min(100, +cfg.glass || 0)) / 100 * 2.2));
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", t === "dark" ? "#0b2a20" : "#0f3d2e");
  }
  function applyFont() {
    document.documentElement.style.setProperty("--fs", cfg.fs + "px");
    document.documentElement.style.setProperty("--lh", String(cfg.lh || 2.1));
    document.documentElement.setAttribute("data-calm", cfg.calm ? "1" : "0");
  }

  // إبقاء الشاشة مضيئة أثناء القراءة (إن دعمها الجهاز)
  var wl = null, wlBusy = false;
  function applyAwake() {
    var top = stack[stack.length - 1];
    var want = cfg.awake && top && (top.type === "item" || top.type === "book" || top.type === "vol");
    try {
      if (want && !wl && !wlBusy && navigator.wakeLock && document.visibilityState === "visible") {
        wlBusy = true;
        navigator.wakeLock.request("screen").then(function (sn) {
          wlBusy = false; wl = sn;
          sn.addEventListener("release", function () { if (wl === sn) wl = null; });
        }, function () { wlBusy = false; });
      } else if (!want && wl) { wl.release(); wl = null; }
    } catch (e) { wlBusy = false; }
  }
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") applyAwake(); });

  function copyText(txt) {
    function done() { toast("تم النسخ"); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done, fallback);
    } else fallback();
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = txt; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { toast("تعذّر النسخ"); }
      document.body.removeChild(ta);
    }
  }

  /* ---------------- المفضلة ---------------- */
  var SHAHADA = "أشهد أن لا إله إلا الله وحده لا شريك له، وأشهد أن محمداً عبده ورسوله، وأشهد أن علياً ولي الله";
  function getFavs() {
    try {
      var f = JSON.parse(localStorage.getItem("favs") || "{}") || {};
      return { books: Array.isArray(f.books) ? f.books : [], items: Array.isArray(f.items) ? f.items : [], recs: Array.isArray(f.recs) ? f.recs : [] };
    } catch (e) { return { books: [], items: [], recs: [] }; }
  }
  function isFav(kind, id) { return getFavs()[kind].indexOf(id) !== -1; }
  function toggleFav(kind, id) {
    var f = getFavs(), i = f[kind].indexOf(id);
    if (i >= 0) f[kind].splice(i, 1); else f[kind].unshift(id);
    try { localStorage.setItem("favs", JSON.stringify(f)); } catch (e) {}
    return i < 0;
  }
  function favCount() {
    var f = getFavs();
    return f.books.filter(function (id) { return findBook(id); }).length +
           f.items.filter(function (k) { return ITEMS[k]; }).length + f.recs.length;
  }
  // نجمة صغيرة داخل الصفوف
  function favStar(kind, id, onChange) {
    var b = el("span", "fstar");
    b.setAttribute("role", "button");
    function paint() {
      var on = isFav(kind, id);
      b.textContent = on ? "★" : "☆";
      b.className = "fstar" + (on ? " on" : "");
      b.setAttribute("aria-label", on ? "إزالة من المفضلة" : "إضافة إلى المفضلة");
    }
    paint();
    b.onclick = function (e) {
      e.stopPropagation();
      var on = toggleFav(kind, id); paint();
      toast(on ? "أُضيف إلى المفضلة" : "أُزيل من المفضلة");
      if (onChange) onChange(on);
    };
    return b;
  }
  // زر (شريحة) للأدوات
  function favChip(kind, id) {
    var b = el("button", "chip fav");
    function paint() {
      var on = isFav(kind, id);
      b.textContent = on ? "★ في المفضلة" : "☆ للمفضلة";
      b.className = "chip fav" + (on ? " on" : "");
    }
    paint();
    b.onclick = function () {
      var on = toggleFav(kind, id); paint();
      toast(on ? "أُضيف إلى المفضلة" : "أُزيل من المفضلة");
    };
    return b;
  }

  /* ---------------- سجل القراءة وآخر عنصر ---------------- */
  function getReads() {
    try { var o = JSON.parse(localStorage.getItem("reads") || "{}"); return (o && typeof o === "object" && !Array.isArray(o)) ? o : {}; }
    catch (e) { return {}; }
  }
  function isRead(k) { return !!getReads()[k]; }
  function toggleRead(k) {
    var o = getReads(), on;
    if (o[k]) { delete o[k]; on = false; } else { o[k] = Date.now(); on = true; }
    try { localStorage.setItem("reads", JSON.stringify(o)); } catch (e) {}
    return on;
  }
  function readCount() { return Object.keys(getReads()).filter(function (k) { return ITEMS[k]; }).length; }
  function getLastItem() {
    try {
      var o = JSON.parse(localStorage.getItem("lastItem") || "null");
      if (o && typeof o.k === "string" && ITEMS[o.k]) return { k: o.k, t: +o.t || 0, pct: +o.pct || 0 };
    } catch (e) {}
    return null;
  }
  function setLastItem(k, pct) {
    try { localStorage.setItem("lastItem", JSON.stringify({ k: k, t: Date.now(), pct: pct || 0 })); } catch (e) {}
  }

  /* ---------------- النسخ الاحتياطي ---------------- */
  // يُنسخ تقدّمك وإعداداتك فقط (لا مفاتيح ولا كلمات سر ولا ذاكرة مؤقتة)
  var BK_OK = /^(cfg|favs|hifz|tasbih|tsvib|hijriAdj|pins|lastrec|scanzoom|reads|lastItem|mine|tscustom|splitMode|splitLast|pos:.+|bm:.+)$/;
  function backupText() {
    var d = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (BK_OK.test(k)) d[k] = localStorage.getItem(k);
      }
    } catch (e) {}
    return JSON.stringify({ app: "duas", v: 1, t: new Date().toISOString(), data: d });
  }
  function restoreFrom(text) {
    var o;
    try { o = JSON.parse(text); } catch (e) { throw new Error("الملف غير صالح"); }
    if (!o || o.app !== "duas" || !o.data || typeof o.data !== "object") throw new Error("هذا ليس ملف نسخة احتياطية لهذا التطبيق");
    var n = 0;
    Object.keys(o.data).forEach(function (k) {
      var val = o.data[k];
      if (BK_OK.test(k) && typeof val === "string" && val.length < 2000000) {
        try { localStorage.setItem(k, val); n++; } catch (e) {}
      }
    });
    if (!n) throw new Error("النسخة فارغة");
    return n;
  }
  function doRestore(text) {
    if (!confirm("سيتم دمج النسخة الاحتياطية مع بياناتك الحالية (وتستبدل المتشابه). متابعة؟")) return;
    try {
      var n = restoreFrom(text);
      toast("تم استرجاع " + n + " عنصر");
      setTimeout(function () { location.reload(); }, 900);
    } catch (e) { toast(e.message || "تعذّر الاسترجاع"); }
  }
  function saveBackupFile() {
    var text = backupText();
    var d = new Date(), fname = "duas-backup-" + d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0") + ".json";
    var P = window.Capacitor && window.Capacitor.Plugins || {};
    if (P.Filesystem && P.Share) {
      P.Filesystem.writeFile({ path: fname, data: text, directory: "CACHE", encoding: "utf8" })
        .then(function (r) { return P.Share.share({ title: "نسخة احتياطية", files: [r.uri], dialogTitle: "احفظ النسخة الاحتياطية" }); })
        .catch(function () { copyText(text); toast("تعذّر الحفظ كملف، تم نسخها كنص"); });
      return;
    }
    try {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      a.download = fname; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (e) { copyText(text); }
  }

  /* ---------------- التنقل ---------------- */
  var stack = [{ type: "home" }];
  var query = "";

  function go(v) {
    if (isReader(stack[stack.length - 1])) savePos();
    stack.push(v); render(); window.scrollTo(0, 0);
  }
  function isReader(v) { return v.type === "book" || v.type === "vol"; }
  function goBack() {
    if (document.body.classList.contains("np-open")) { closeNP(); return true; }
    if (sheetEl) { closeSheet(); return true; }
    if (stack.length > 1) {
      if (isReader(stack[stack.length - 1])) savePos();
      stack.pop(); render(); return true;
    }
    return false;
  }

  function render() {
    var v = stack[stack.length - 1];
    viewEl.textContent = "";
    destroySplit();
    if (io) { io.disconnect(); io = null; }
    btnBack.hidden = stack.length <= 1;
    if (v.type === "home") renderHome();
    else if (v.type === "cat") renderCat(v);
    else if (v.type === "item") renderItem(v);
    else if (v.type === "settings") renderSettings();
    else if (v.type === "lib") renderLib();
    else if (v.type === "favs") renderFavs();
    else if (v.type === "book") renderBook(v);
    else if (v.type === "vol") renderScan(v);
    else if (v.type === "tasbih") renderTasbih();
    else if (v.type === "hifz") renderHifz();
    else if (v.type === "listen") renderListenHub(v);
    else if (v.type === "lat") renderListenHub({ type: "listen", tab: "l" });
    else if (v.type === "cal") renderCal();
    else if (v.type === "mine") renderMine();
    else if (v.type === "mineEdit") renderMineEdit(v);
    updateTabs();
    applyAwake();
  }

  var TABS = [
    ["home", "الرئيسية", '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'],
    ["lib", "المكتبة", '<path d="M4 4h4v16H4zM10 4h4v16h-4zM16.5 5.5l3.5-1 3 14.500-3.500 1z" transform="translate(-1 0)"/>'],
    ["listen", "الاستماع", '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="7" rx="1.500"/><rect x="17" y="14" width="4" height="7" rx="1.500"/>'],
    ["favs", "المفضلة", '<path d="M12 3l2.700 5.600 6.100.9-4.400 4.300 1 6.100L12 17l-5.400 2.900 1-6.100L3.200 9.500l6.100-.9z"/>']
  ];
  var tabsEl = null;
  function tabGo(t) {
    if (sheetEl) closeSheet();
    if (isReader(stack[stack.length - 1])) savePos();
    stack = [{ type: "home" }];
    if (t !== "home") stack.push({ type: t });
    render(); window.scrollTo(0, 0);
  }
  function updateTabs() {
    var v = stack[stack.length - 1], show = ["home", "lib", "listen", "favs", "cal", "tasbih", "hifz", "mine", "lat"].indexOf(v.type) >= 0;
    if (!tabsEl) {
      tabsEl = el("nav"); tabsEl.id = "tabs";
      var pill = el("div", "tpill");
      TABS.forEach(function (t) {
        var b = el("button", "tab"); b.dataset.t = t[0];
        b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + t[2] + "</svg><span>" + t[1] + "</span>";
        b.onclick = function () { tabGo(t[0]); };
        pill.appendChild(b);
      });
      var sb = el("button", "tsearch"); sb.setAttribute("aria-label", "بحث");
      sb.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>';
      sb.onclick = function () { tabGo("home"); var i = document.querySelector(".search"); if (i) i.focus(); };
      tabsEl.appendChild(pill); tabsEl.appendChild(sb);
      document.body.appendChild(tabsEl);
    }
    tabsEl.hidden = !show;
    document.body.classList.toggle("has-tabs", show);
    Array.prototype.forEach.call(tabsEl.querySelectorAll(".tab"), function (b) { b.classList.toggle("on", b.dataset.t === v.type); });
  }



  /* ---------------- العرض المزدوج (صفحتان معاً) ---------------- */
  var SPLIT = { el: null, io: null, body: null, b: null, v: null, zoom: 100 };
  function splitMode() { return 0; } /* وضع التقسيم أُلغي */
  function setSplitMode(n) { try { localStorage.setItem("splitMode", String(n)); } catch (e) {} }
  function spCur() {
    if (!SPLIT.body || !SPLIT.v) return 0;
    var ch = SPLIT.body.children, top = SPLIT.body.scrollTop, i;
    for (i = 0; i < ch.length; i++) if (ch[i].offsetTop + ch[i].offsetHeight > top + 5) return i;
    return 0;
  }
  function spSave() {
    if (!SPLIT.b || !SPLIT.v) return;
    try { localStorage.setItem("splitLast", JSON.stringify({ b: SPLIT.b.id, v: SPLIT.v.id, i: spCur() })); } catch (e) {}
  }
  function destroySplit() {
    spSave();
    if (SPLIT.io) { SPLIT.io.disconnect(); SPLIT.io = null; }
    if (SPLIT.el) { SPLIT.el.remove(); SPLIT.el = null; }
    SPLIT.body = null;
    document.body.classList.remove("sp-v", "sp-h");
  }
  function spLoad(b, v, idx) {
    SPLIT.b = b; SPLIT.v = v;
    if (SPLIT.io) { SPLIT.io.disconnect(); }
    SPLIT.body.textContent = "";
    SPLIT.title.textContent = b.title + " – " + v.title;
    var pgs = [];
    for (var i = 0; i < v.pages; i++) {
      var d = el("div", "spage"); d.style.aspectRatio = String(v.dims[i] || 0.7); d.style.width = SPLIT.zoom + "%"; d.dataset.i = i;
      pgs.push(d); SPLIT.body.appendChild(d);
    }
    SPLIT.io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var d = e.target;
        if (e.isIntersecting) {
          if (d.firstChild || d._ld) return; d._ld = true;
          idbDo("readonly", function (s) { return s.get(vkey(b, v) + d.dataset.i); }).then(function (bl) {
            d._ld = false; if (!bl || d.firstChild || SPLIT.v !== v) return;
            var im = new Image(); im.alt = ""; im.src = d._url = URL.createObjectURL(bl); d.appendChild(im);
          }, function () { d._ld = false; });
        } else if (d.firstChild) {
          d.removeChild(d.firstChild); if (d._url) { URL.revokeObjectURL(d._url); d._url = null; }
        }
      });
    }, { root: SPLIT.body, rootMargin: "800px 0px" });
    pgs.forEach(function (p) { SPLIT.io.observe(p); });
    setTimeout(function () { if (pgs[idx]) SPLIT.body.scrollTop = pgs[idx].offsetTop; }, 50);
    spSave();
  }
  function spPick() {
    closeSheet();
    sheetEl = el("div", "sheet");
    sheetEl.onclick = function (e) { if (e.target === sheetEl) closeSheet(); };
    var panel = el("div", "panel"), head = el("div", "ph");
    head.appendChild(el("strong", null, "اختر الكتاب للعرض الثاني"));
    var x = el("button", "chip", "إغلاق"); x.onclick = closeSheet; head.appendChild(x); panel.appendChild(head);
    var list = el("div", "pl"); panel.appendChild(list);
    list.appendChild(el("div", "pgroup", "الكتب المنزّلة فقط"));
    BOOKS.forEach(function (b) {
      if (b.kind !== "scan") return;
      (b.volumes || []).forEach(function (v) {
        isDown(b, v).then(function (ok) {
          if (!ok) return;
          var r = el("button", "pi"); r.appendChild(el("span", null, b.title + (b.volumes.length > 1 ? " – " + v.title : "")));
          r.onclick = function () { closeSheet(); spLoad(b, v, 0); };
          list.appendChild(r);
        });
      });
    });
    sheetEl.appendChild(panel); document.body.appendChild(sheetEl);
  }
  function buildSplit() {
    var mode = splitMode(); if (!mode) return;
    document.body.classList.add(mode === 1 ? "sp-v" : "sp-h");
    var pane = el("div", "splitpane " + (mode === 1 ? "v" : "h")); SPLIT.el = pane;
    if (mode === 2) pane.style.top = ($("bar").offsetHeight) + "px";
    var head = el("div", "sp-head");
    SPLIT.title = el("span", "sp-title", "اختر كتاباً للمقارنة");
    var pk = el("button", "chip", "📚"), zi = el("button", "chip", "🔍+"), zo = el("button", "chip", "🔍−");
    var inp = el("input", "sp-in"); inp.type = "number"; inp.placeholder = "ص"; inp.inputMode = "numeric";
    var gb = el("button", "chip", "اذهب"), cl = el("button", "chip", "✕");
    pk.onclick = spPick;
    function zoom(d) { SPLIT.zoom = Math.max(100, Math.min(300, SPLIT.zoom + d)); [].forEach.call(SPLIT.body.children, function (c) { c.style.width = SPLIT.zoom + "%"; }); }
    zi.onclick = function () { zoom(50); }; zo.onclick = function () { zoom(-50); };
    gb.onclick = function () {
      var n = parseInt(inp.value, 10); if (!n || !SPLIT.v) return;
      var i = Math.max(0, Math.min(SPLIT.v.pages - 1, p2i(SPLIT.v, n))), c = SPLIT.body.children[i];
      if (c) SPLIT.body.scrollTop = c.offsetTop;
    };
    cl.onclick = function () { setSplitMode(0); destroySplit(); render(); };
    [pk, zo, zi, inp, gb, cl].forEach(function (x) { head.appendChild(x); });
    pane.appendChild(SPLIT.title); pane.appendChild(head);
    SPLIT.body = el("div", "sp-body"); pane.appendChild(SPLIT.body);
    document.body.appendChild(pane);
    var last = null; try { last = JSON.parse(localStorage.getItem("splitLast") || "null"); } catch (e) {}
    var lb = last && findBook(last.b), lv = lb && lb.volumes.filter(function (x) { return x.id === last.v; })[0];
    if (lb && lv) isDown(lb, lv).then(function (ok) { if (ok) spLoad(lb, lv, last.i || 0); else spPick(); });
    else spPick();
  }

  /* ---------------- حفظ القرآن ---------------- */
  function hfGet() {
    try {
      var o = JSON.parse(localStorage.getItem("hifz") || "{}") || {};
      return { agree: !!o.agree, plan: Array.isArray(o.plan) ? o.plan : [] };
    } catch (e) { return { agree: false, plan: [] }; }
  }
  function hfSet(o) { try { localStorage.setItem("hifz", JSON.stringify(o)); } catch (e) {} }
  function todayStr() {
    var d = new Date(), m = d.getMonth() + 1, dd = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (dd < 10 ? "0" : "") + dd;
  }
  function quranVol() {
    var b = findBook("quran"); return b && b.volumes && b.volumes[0] ? { b: b, v: b.volumes[0] } : null;
  }
  function surahAt(page) {
    var q = quranVol(); if (!q) return "";
    var name = "";
    q.v.toc.forEach(function (t) { if (t.p <= page) name = t.t; });
    return name;
  }
  function openQuranAt(page) {
    var q = quranVol();
    if (!q) { alert("المصحف غير موجود في المكتبة."); return; }
    isDown(q.b, q.v).then(function (ok) {
      if (!ok) { alert("حمّل المصحف أولاً من المكتبة، ثم ارجع واضغط فتح."); go({ type: "book", id: q.b.id }); return; }
      var i = Math.max(0, Math.min(q.v.pages - 1, page - q.v.off));
      go({ type: "vol", id: q.b.id, vol: q.v.id, jump: i });
    });
  }
  function renderHifz() {
    titleEl.textContent = "🕋 حفظ القرآن";
    var H = hfGet();
    if (!H.agree) {
      var c = el("div", "hf-agree");
      c.appendChild(el("div", "hf-h", "برنامج حفظ القرآن الكريم"));
      c.appendChild(el("div", "hf-p", "هذا القسم يساعدك على تنظيم حفظك: أنت تضع جدولك بنفسك (التاريخ، ومن أي صفحة إلى أي صفحة)، وتؤشّر على ما أتممته، ويظهر لك تقدمك من المصحف."));
      c.appendChild(el("div", "hf-p", "هل توافق على الدخول في برنامج حفظ القرآن؟"));
      var yes = el("button", "chip hf-yes", "✅ موافق"), no = el("button", "chip", "رجوع");
      yes.onclick = function () { H.agree = true; hfSet(H); render(); };
      no.onclick = function () { goBack(); };
      var row = el("div", "hf-btns"); row.appendChild(yes); row.appendChild(no);
      c.appendChild(row);
      viewEl.appendChild(c);
      return;
    }
    var q = quranVol(), total = q ? q.v.pages : 569;
    var seen = {};
    H.plan.forEach(function (e) { if (e.done) for (var p = e.from; p <= e.to; p++) seen[p] = 1; });
    var done = Object.keys(seen).length, pct = Math.min(100, Math.round(100 * done / total));
    var pr = el("div", "hf-prog");
    pr.appendChild(el("div", "hf-pt", "تقدّمك: " + done + " من " + total + " صفحة (" + pct + "%)"));
    var bar = el("div", "hf-bar"), fill = el("i"); fill.style.width = pct + "%"; bar.appendChild(fill); pr.appendChild(bar);
    viewEl.appendChild(pr);

    // نموذج الإضافة
    var f = el("div", "hf-form");
    f.appendChild(el("div", "hf-h", "➕ أضف مقرراً إلى جدولك"));
    var dt = el("input", "hf-in"); dt.type = "date"; dt.value = todayStr();
    var sel = el("select", "hf-in");
    var o0 = el("option", null, "اختر سورة (اختياري)"); o0.value = ""; sel.appendChild(o0);
    if (q) q.v.toc.forEach(function (t) { var o = el("option", null, t.t); o.value = t.p; sel.appendChild(o); });
    var fr = el("input", "hf-in"); fr.type = "number"; fr.min = 1; fr.max = total; fr.placeholder = "من صفحة";
    var to = el("input", "hf-in"); to.type = "number"; to.min = 1; to.max = total; to.placeholder = "إلى صفحة";
    var nt = el("input", "hf-in"); nt.type = "text"; nt.placeholder = "ملاحظة (اختياري)";
    sel.onchange = function () { if (sel.value) { fr.value = sel.value; if (!to.value) to.value = sel.value; } };
    var add = el("button", "chip hf-yes", "إضافة");
    add.onclick = function () {
      var a = parseInt(fr.value, 10), b = parseInt(to.value, 10);
      if (!dt.value) { alert("اختر التاريخ."); return; }
      if (!(a >= 1 && b >= a && b <= total)) { alert("اكتب الصفحات بشكل صحيح: من ≤ إلى، وضمن 1–" + total + "."); return; }
      H.plan.push({ id: Date.now(), d: dt.value, from: a, to: b, note: nt.value.trim(), done: false });
      hfSet(H); render();
    };
    [dt, sel, fr, to, nt, add].forEach(function (x) { f.appendChild(x); });
    viewEl.appendChild(f);

    // الجدول
    viewEl.appendChild(el("div", "fsec", "📅 جدولك (" + H.plan.length + ")"));
    if (!H.plan.length) viewEl.appendChild(el("div", "favempty", "ما عندك مقررات بعد. أضف أول مقرر من الأعلى."));
    var tdy = todayStr();
    var list = el("div", "list");
    H.plan.slice().sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : a.from - b.from; }).forEach(function (e) {
      var r = el("div", "hf-row" + (e.done ? " done" : (e.d < tdy ? " late" : (e.d === tdy ? " today" : ""))));
      var ck = el("button", "hf-ck", e.done ? "✔" : "○");
      ck.onclick = function () { e.done = !e.done; hfSet(H); render(); };
      var mid = el("div", "hf-mid");
      mid.appendChild(el("div", "hf-t", "صفحة " + e.from + (e.to !== e.from ? " – " + e.to : "") + (surahAt(e.from) ? " (" + surahAt(e.from) + ")" : "")));
      mid.appendChild(el("div", "hf-s", e.d + (e.d === tdy ? " · اليوم" : (!e.done && e.d < tdy ? " · متأخر" : "")) + (e.note ? " · " + e.note : "")));
      var op = el("button", "chip", "📖 فتح"); op.onclick = function () { openQuranAt(e.from); };
      var dl = el("button", "chip", "🗑"); dl.onclick = function () {
        if (confirm("حذف هذا المقرر؟")) { H.plan = H.plan.filter(function (x) { return x.id !== e.id; }); hfSet(H); render(); }
      };
      [ck, mid, op, dl].forEach(function (x) { r.appendChild(x); });
      list.appendChild(r);
    });
    viewEl.appendChild(list);
  }


  /* ---------------- الاستماع للقرآن ---------------- */
  var SURAHS = "الفاتحة|البقرة|آل عمران|النساء|المائدة|الأنعام|الأعراف|الأنفال|التوبة|يونس|هود|يوسف|الرعد|إبراهيم|الحجر|النحل|الإسراء|الكهف|مريم|طه|الأنبياء|الحج|المؤمنون|النور|الفرقان|الشعراء|النمل|القصص|العنكبوت|الروم|لقمان|السجدة|الأحزاب|سبأ|فاطر|يس|الصافات|ص|الزمر|غافر|فصلت|الشورى|الزخرف|الدخان|الجاثية|الأحقاف|محمد|الفتح|الحجرات|ق|الذاريات|الطور|النجم|القمر|الرحمن|الواقعة|الحديد|المجادلة|الحشر|الممتحنة|الصف|الجمعة|المنافقون|التغابن|الطلاق|التحريم|الملك|القلم|الحاقة|المعارج|نوح|الجن|المزمل|المدثر|القيامة|الإنسان|المرسلات|النبأ|النازعات|عبس|التكوير|الانفطار|المطففين|الانشقاق|البروج|الطارق|الأعلى|الغاشية|الفجر|البلد|الشمس|الليل|الضحى|الشرح|التين|العلق|القدر|البينة|الزلزلة|العاديات|القارعة|التكاثر|العصر|الهمزة|الفيل|قريش|الماعون|الكوثر|الكافرون|النصر|المسد|الإخلاص|الفلق|الناس".split("|");
  var recCache = null, audioEl = null;
  function pad3(n) { return (n < 10 ? "00" : n < 100 ? "0" : "") + n; }
  function loadReciters() {
    if (recCache) return Promise.resolve(recCache);
    try { var c = JSON.parse(localStorage.getItem("recs") || "null"); if (Array.isArray(c) && c.length && c.every(function (r) { return r && typeof r.name === "string"; })) { recCache = c; return Promise.resolve(c); } } catch (e) {}
    return fetch("https://mp3quran.net/api/v3/reciters?language=ar").then(function (r) {
      if (!r.ok) throw new Error("http " + r.status); return r.json();
    }).then(function (j) {
      var out = (j.reciters || []).map(function (r) {
        return { id: r.id, name: r.name, m: (r.moshaf || []).map(function (m) {
          return { id: m.id, n: m.name, s: m.server, l: String(m.surah_list || "").split(",").map(Number).filter(Boolean) };
        }).filter(function (m) { return m.s && m.l.length; }) };
      }).filter(function (r) { return r.m.length; });
      if (!out.length) throw new Error("empty");
      recCache = out;
      try { localStorage.setItem("recs", JSON.stringify(out)); } catch (e) {}
      return out;
    });
  }
  function audKey(rid, mid, n) { return "aud:" + rid + ":" + mid + ":" + n; }
  function audGet(rid, mid, n) { return idbDo("readonly", function (s) { return s.get(audKey(rid, mid, n)); }).then(function (x) { return x || null; }, function () { return null; }); }

  /* مشغّل عام يبقى يعمل في كل الصفحات */
  var PL = { a: null, bar: null, t: null, next: null, prev: null };
  var askedN = false;
  function askNotif() {
    if (askedN) return; askedN = true;
    try {
      var ln = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications;
      if (!ln) return;
      ln.checkPermissions().then(function (p) { if (p.display !== "granted") ln.requestPermissions(); });
    } catch (e) {}
  }
  function nativeMedia() {
    askNotif();
    try {
      if (!(window.NativeAudio && NativeAudio.media) || !PL.a) return;
      var a = PL.a, src = a.getAttribute("src");
      NativeAudio.media(src ? (PL.title || "") : "", PL.artist || "", !a.paused, Math.floor(a.currentTime || 0), isFinite(a.duration) ? Math.floor(a.duration) : 0);
    } catch (e) {}
  }
  window.__mc = function (c) {
    var a = PL.a; if (!a) return;
    if (c === "play") a.play(); else if (c === "pause") a.pause();
    else if (c === "next") { if (PL.next) PL.next(); } else if (c === "prev") { if (PL.prev) PL.prev(); }
    else if (c.indexOf("seek:") === 0) a.currentTime = +c.slice(5);
  };
  function nativeHold(on) { try { if (window.NativeAudio && NativeAudio.hold) NativeAudio.hold(!!on); } catch (e) {} }
  /* حفظ موضع الاستماع لكل تسجيل لاستئنافه لاحقاً */
  var APOS_MAX = 60, aposLast = 0;
  function aposAll() { try { var o = JSON.parse(localStorage.getItem("apos") || "{}"); return (o && typeof o === "object" && !Array.isArray(o)) ? o : {}; } catch (e) { return {}; } }
  function aposSave(force) {
    var a = PL.a; if (!a || !PL.rk || !a.getAttribute("src")) return;
    var now = Date.now(); if (!force && now - aposLast < 4000) return; aposLast = now;
    var t = a.currentTime, d = a.duration;
    if (!isFinite(t) || t < 0) return;
    try {
      var o = aposAll();
      if (t < 5 || (isFinite(d) && d - t < 10)) delete o[PL.rk]; else o[PL.rk] = { t: Math.floor(t), u: now };
      var ks = Object.keys(o); if (ks.length > APOS_MAX) { ks.sort(function (x, y) { return (o[x].u || 0) - (o[y].u || 0); }); ks.slice(0, ks.length - APOS_MAX).forEach(function (k) { delete o[k]; }); }
      localStorage.setItem("apos", JSON.stringify(o));
    } catch (e) {}
  }
  function ensurePlayer() {
    if (PL.a) return;
    var a = document.createElement("audio"); a.preload = "auto"; a.style.display = "none"; document.body.appendChild(a); PL.a = a;
    var bar = el("div", "gplayer"); bar.hidden = true;
    var thumb = el("img", "gp-img"); thumb.alt = ""; coverSrc(thumb, "quran");
    PL.t = el("div", "gp-t");
    var prog = el("i", "gp-prog"); var pbox = el("span", "gp-pb"); pbox.appendChild(prog);
    var pp = el("button", "gp-b", "▶"), x = el("button", "gp-b gp-x", "✕");
    pp.onclick = function (e) { e.stopPropagation(); if (a.paused) a.play(); else a.pause(); };
    x.onclick = function (e) { e.stopPropagation(); a.pause(); aposSave(true); PL.rk = null; a.removeAttribute("src"); a.load(); bar.hidden = true; nativeHold(false); nativeMedia(); closeNP(); };
    bar.onclick = function () { openNP(); };
    PL.pp = pp; PL.prog = prog;
    a.ontimeupdate = function () { syncNP(); aposSave(false); };
    a.onplay = function () { nativeHold(true); nativeMedia(); syncNP(); };
    a.onpause = function () { aposSave(true); nativeHold(false); nativeMedia(); syncNP(); };
    a.onended = function () { if (PL.rk) { try { var o = aposAll(); delete o[PL.rk]; localStorage.setItem("apos", JSON.stringify(o)); } catch (e) {} } PL.rk = null; nativeHold(false); if (PL.next) PL.next(); };
    a.onloadedmetadata = function () { if (PL.resume > 5 && isFinite(a.duration) && a.duration - PL.resume > 10) { try { a.currentTime = PL.resume; } catch (e) {} } PL.resume = 0; nativeMedia(); syncNP(); };
    [thumb, PL.t, pp, x, pbox].forEach(function (b) { bar.appendChild(b); });
    document.body.appendChild(bar); PL.bar = bar;
  }
  function fmtT(t) { if (!isFinite(t) || t < 0) t = 0; t = Math.floor(t); var h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return (h ? h + ":" + (m < 10 ? "0" : "") : "") + m + ":" + (s < 10 ? "0" : "") + s; }
  var SPEEDS = [1, 1.25, 1.5, 2, 0.75], SLEEPS = [0, 15, 30, 60], sleepI = 0, sleepTm = null;
  function svgI(p) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + p + "</svg>"; }
  function buildNP() {
    if (PL.np) return;
    var a = PL.a, np = el("div", "np"); np.hidden = true;
    var top = el("div", "np-top"), cl = el("button", "np-x"); cl.innerHTML = svgI('<path d="M6 9l6 6 6-6"/>'); cl.onclick = closeNP;
    top.appendChild(cl); top.appendChild(el("span", "np-lbl", "قيد التشغيل"));
    var img = el("img", "np-cover"); img.alt = ""; coverSrc(img, "quran");
    var t = el("div", "np-t"), sb = el("div", "np-s");
    var rng = document.createElement("input"); rng.type = "range"; rng.min = 0; rng.max = 1000; rng.value = 0; rng.className = "np-r";
    rng.oninput = function () { if (a.duration) a.currentTime = a.duration * rng.value / 1000; };
    var tm = el("div", "np-times"), t1 = el("span", null, "0:00"), t2 = el("span", null, "-0:00"); tm.appendChild(t1); tm.appendChild(t2);
    var row = el("div", "np-row");
    var bk = el("button", "np-b np-sk"); bk.innerHTML = svgI('<path d="M4 12a8 8 0 1 0 3-6.200M4 4v4h4"/>') + "<b>15</b>";
    var pv = el("button", "np-b"); pv.innerHTML = svgI('<path d="M19 5v14L9 12zM5 5v14"/>');
    var pp = el("button", "np-b np-pp");
    var nx = el("button", "np-b"); nx.innerHTML = svgI('<path d="M5 5v14l10-7zM19 5v14"/>');
    var fw = el("button", "np-b np-sk"); fw.innerHTML = svgI('<path d="M20 12a8 8 0 1 1-3-6.200M20 4v4h-4"/>') + "<b>15</b>";
    bk.onclick = function () { a.currentTime = Math.max(0, a.currentTime - 15); };
    fw.onclick = function () { a.currentTime = a.currentTime + 15; };
    pv.onclick = function () { if (PL.prev) PL.prev(); };
    nx.onclick = function () { if (PL.next) PL.next(); };
    pp.onclick = function () { if (a.paused) a.play(); else a.pause(); };
    [bk, pv, pp, nx, fw].forEach(function (b) { row.appendChild(b); });
    var row2 = el("div", "np-row2");
    var sp = el("button", "np-c", "1×"), sl = el("button", "np-c", "🌙 إيقاف");
    sp.onclick = function () { var k = (SPEEDS.indexOf(a.playbackRate) + 1) % SPEEDS.length; a.playbackRate = SPEEDS[k]; sp.textContent = SPEEDS[k] + "×"; };
    sl.onclick = function () {
      sleepI = (sleepI + 1) % SLEEPS.length; clearTimeout(sleepTm);
      if (SLEEPS[sleepI]) { sleepTm = setTimeout(function () { a.pause(); sleepI = 0; sl.textContent = "🌙 إيقاف"; toast("توقّف التشغيل (مؤقّت النوم)"); }, SLEEPS[sleepI] * 60000); sl.textContent = "🌙 " + SLEEPS[sleepI] + " د"; }
      else sl.textContent = "🌙 إيقاف";
    };
    row2.appendChild(sp); row2.appendChild(sl);
    [top, img, t, sb, rng, tm, row, row2].forEach(function (c) { np.appendChild(c); });
    document.body.appendChild(np);
    PL.np = { el: np, t: t, s: sb, r: rng, t1: t1, t2: t2, pp: pp, img: img };
  }
  function openNP() { buildNP(); PL.np.el.hidden = false; document.body.classList.add("np-open"); syncNP(); }
  function closeNP() { if (PL.np) PL.np.el.hidden = true; document.body.classList.remove("np-open"); }
  function syncNP() {
    var a = PL.a; if (!a) return;
    var d = a.duration, pr = d ? a.currentTime / d : 0;
    if (PL.pp) PL.pp.textContent = a.paused ? "▶" : "⏸";
    if (PL.prog) PL.prog.style.width = (pr * 100) + "%";
    var n = PL.np; if (!n) return;
    n.t.textContent = PL.title || ""; n.s.textContent = PL.artist || "";
    n.pp.innerHTML = a.paused ? svgI('<path d="M7 4l13 8-13 8z" fill="currentColor"/>') : svgI('<path d="M7 4h4v16H7zM13 4h4v16h-4z" fill="currentColor"/>');
    if (!n.r.matches(":active")) n.r.value = Math.round(1000 * pr);
    n.t1.textContent = fmtT(a.currentTime); n.t2.textContent = "-" + fmtT(d ? d - a.currentTime : 0);
  }
  function playerLoad(o) {
    ensurePlayer();
    var a = PL.a;
    a.onerror = null;
    if (PL.rk && a.getAttribute("src")) aposSave(true);
    PL.rk = o.rk || null; PL.resume = 0;
    if (PL.rk && !o.fresh) { var sv = aposAll()[PL.rk]; if (sv && sv.t > 5) PL.resume = sv.t; }
    a.src = o.src; PL.title = o.title; PL.artist = o.artist; PL.t.textContent = o.title + " — " + o.artist; PL.bar.hidden = false; syncNP();
    PL.next = o.next; PL.prev = o.prev;
    var p = a.play(); if (p && p.catch) p.catch(function () { toast("تعذّر التشغيل، تحقق من الإنترنت"); });
    var ms = navigator.mediaSession; if (!ms) return;
    try {
      ms.metadata = new MediaMetadata({ title: o.title, artist: o.artist, album: "القرآن الكريم",
        artwork: [{ src: BASE + "covers/quran.jpg", sizes: "260x366", type: "image/jpeg" }] });
      ms.setActionHandler("play", function () { a.play(); });
      ms.setActionHandler("pause", function () { a.pause(); });
      ms.setActionHandler("nexttrack", function () { if (PL.next) PL.next(); });
      ms.setActionHandler("previoustrack", function () { if (PL.prev) PL.prev(); });
      ms.setActionHandler("seekbackward", function () { a.currentTime = Math.max(0, a.currentTime - 10); });
      ms.setActionHandler("seekforward", function () { a.currentTime = a.currentTime + 10; });
    } catch (e) {}
  }
  function renderListen(v, host) {
    host = host || viewEl;
    var st = { rec: null, m: null };
    var q = el("input", "search"); q.type = "search"; q.placeholder = "ابحث عن قارئ: عبد الباسط، الحصري، المنشاوي...";
    try { q.value = localStorage.getItem("lastrec") || ""; } catch (e) {}
    var box = el("div"); host.appendChild(q); host.appendChild(box);
    function play(n, blobUrl) {
      var src = blobUrl || (st.m.s.replace(/\/?$/, "/") + pad3(n) + ".mp3");
      var rec = st.rec, m = st.m;
      playerLoad({
        src: src, rk: "q:" + rec.id + ":" + m.id + ":" + n, title: "سورة " + (SURAHS[n - 1] || n), artist: rec.name,
        next: function () { var k = m.l.indexOf(n); if (k >= 0 && k + 1 < m.l.length) loadSurahOf(rec, m, m.l[k + 1]); },
        prev: function () { var k = m.l.indexOf(n); if (k > 0) loadSurahOf(rec, m, m.l[k - 1]); }
      });
    }
    function loadSurahOf(rec, m, n) {
      audGet(rec.id, m.id, n).then(function (bl) {
        var src = bl ? URL.createObjectURL(bl) : m.s.replace(/\/?$/, "/") + pad3(n) + ".mp3";
        playerLoad({
          src: src, fresh: true, rk: "q:" + rec.id + ":" + m.id + ":" + n, title: "سورة " + (SURAHS[n - 1] || n), artist: rec.name,
          next: function () { var k = m.l.indexOf(n); if (k >= 0 && k + 1 < m.l.length) loadSurahOf(rec, m, m.l[k + 1]); },
          prev: function () { var k = m.l.indexOf(n); if (k > 0) loadSurahOf(rec, m, m.l[k - 1]); }
        });
      });
    }
    function startSurah(n) {
      audGet(st.rec.id, st.m.id, n).then(function (bl) { play(n, bl ? URL.createObjectURL(bl) : null); });
    }
    function drawSurahs() {
      box.textContent = "";
      var back = el("button", "chip", "← القرّاء"); back.onclick = function () { st.rec = null; draw(); };
      box.appendChild(back);
      var hrow = el("div", "favrow"); hrow.appendChild(el("span", "fsec", st.rec.name + (st.m.n ? " — " + st.m.n : "")));
      hrow.appendChild(favStar("recs", st.rec.id, function () {})); box.appendChild(hrow);
      if (st.rec.m.length > 1) {
        var sel = el("select", "hf-in");
        st.rec.m.forEach(function (m, i) { var o = el("option", null, m.n || ("رواية " + (i + 1))); o.value = i; if (m === st.m) o.selected = true; sel.appendChild(o); });
        sel.onchange = function () { st.m = st.rec.m[+sel.value]; drawSurahs(); };
        box.appendChild(sel);
      }
      var list = el("div", "list");
      st.m.l.forEach(function (n) {
        var r = el("div", "hf-row");
        var pl = el("button", "chip hf-yes", "▶"); pl.onclick = function () { startSurah(n); };
        var mid = el("div", "hf-mid"); mid.appendChild(el("div", "hf-t", n + ". سورة " + (SURAHS[n - 1] || "")));
        var dl = el("button", "chip", "⬇ تنزيل");
        function paint() { audGet(st.rec.id, st.m.id, n).then(function (bl) {
          dl.textContent = bl ? "🗑 حذف التنزيل" : "⬇ تنزيل";
          dl.onclick = bl ? function () { idbDo("readwrite", function (s) { return s.delete(audKey(st.rec.id, st.m.id, n)); }).then(paint); } : download;
        }); }
        var bar = el("span", "dlbar"); var fill = el("i"); bar.appendChild(fill); bar.hidden = true;
        mid.appendChild(bar);
        function download() {
          if (!confirm("تنزيل سورة " + SURAHS[n - 1] + "؟ قد يكون حجمها كبيراً (حسب طولها). يفضّل واي فاي.")) return;
          dl.disabled = true; dl.textContent = "0%"; fill.style.width = "0%"; bar.hidden = false;
          fetch(httpsOnly(st.m.s).replace(/\/?$/, "/") + pad3(n) + ".mp3").then(function (r) {
            if (!r.ok) throw new Error("http " + r.status);
            var total = parseInt(r.headers.get("content-length") || "0", 10), got = 0, chunks = [];
            if (!r.body || !r.body.getReader) return r.blob();
            var rd = r.body.getReader();
            function pump() {
              return rd.read().then(function (x) {
                if (x.done) return new Blob(chunks, { type: "audio/mpeg" });
                chunks.push(x.value); got += x.value.length;
                if (total) { var p = Math.min(100, Math.round(100 * got / total)); fill.style.width = p + "%"; dl.textContent = p + "%"; }
                else dl.textContent = (got / 1048576).toFixed(1) + " MB";
                return pump();
              });
            }
            return pump();
          }).then(function (bl) {
            return idbDo("readwrite", function (s) { return s.put(bl, audKey(st.rec.id, st.m.id, n)); });
          }).then(function () { toast("تم التنزيل"); }, function (e) { toast("تعذّر التنزيل: " + (e && e.message || e)); })
            .then(function () { dl.disabled = false; bar.hidden = true; paint(); });
        }
        paint();
        [pl, mid, dl].forEach(function (x) { r.appendChild(x); }); list.appendChild(r);
      });
      box.appendChild(list);
    }
    function draw() {
      box.textContent = "";
      box.appendChild(el("div", "empty", "جاري تحميل قائمة القرّاء…"));
      loadReciters().then(function (recs) {
        box.textContent = "";
        var t = norm(q.value.trim());
        var m = recs.filter(function (r) { return !t || norm(r.name).indexOf(t) !== -1; });
        m = m.filter(function (r) { return isFav("recs", r.id); }).concat(m.filter(function (r) { return !isFav("recs", r.id); })).slice(0, 40);
        if (v && v.rec && !st.rec) {
          var pre = recs.filter(function (r) { return r.id === v.rec; })[0];
          if (pre) { st.rec = pre; st.m = pre.m[0]; v.rec = null; drawSurahs(); return; }
        }
        if (!m.length) { box.appendChild(el("div", "empty", "ما لقينا قارئ بهذا الاسم")); return; }
        var list = el("div", "list");
        m.forEach(function (r) {
          var b = el("button", "row"); b.appendChild(el("span", null, r.name));
          b.appendChild(favStar("recs", r.id, function () { draw(); })); b.appendChild(el("span", "chev", "‹"));
          b.onclick = function () { st.rec = r; st.m = r.m[0]; try { localStorage.setItem("lastrec", q.value); } catch (e) {} drawSurahs(); };
          list.appendChild(b);
        });
        box.appendChild(list);
      }, function (e) {
        box.textContent = "";
        box.appendChild(el("div", "empty", "تعذّر تحميل قائمة القرّاء (" + (e && e.message || e) + "). تحقق من الإنترنت وجرّب مرة ثانية."));
      });
    }
    q.addEventListener("input", function () { if (!st.rec) draw(); });
    draw();
  }


  /* شاشة الاستماع: اختيار بين القرآن واللطميات */
  function renderListenHub(v) {
    titleEl.textContent = "🎧 الاستماع";
    var tab = v && v.rec ? "q" : (v && v.tab) || "";
    if (!tab) { try { tab = localStorage.getItem("listenTab") || "q"; } catch (e) { tab = "q"; } }
    if (tab !== "l") tab = "q";
    var seg = el("div"); seg.style.cssText = "display:flex;gap:8px;margin:0 0 12px";
    var host = el("div");
    var bq = el("button", "chip", "📖 القرآن الكريم"), bl = el("button", "chip", "🎙 لطميات");
    [bq, bl].forEach(function (b) { b.style.flex = "1"; seg.appendChild(b); });
    function show(t, vv) {
      try { localStorage.setItem("listenTab", t); } catch (e) {}
      bq.className = "chip" + (t === "q" ? " on" : ""); bl.className = "chip" + (t === "l" ? " on" : "");
      host.textContent = "";
      if (t === "l") renderLat(host); else renderListen(vv || { type: "listen" }, host);
    }
    bq.onclick = function () { show("q"); };
    bl.onclick = function () { show("l"); };
    viewEl.appendChild(seg); viewEl.appendChild(host);
    show(tab, v && v.rec ? v : null);
  }

  /* ---------------- لطميات (روابط من موقع يا حسين؛ استخدام شخصي) ---------------- */
  var LAT_HOME = "https://www.yahosein.com/latom/";
  // باسم الكربلائي: اسم الملف = base + (المعرّف − off) + ".mp3" (تأكّدنا منها). البقية: نستخرج رابط الصوت من صفحة المقطع وقت التشغيل.
  var LAT = [{ id: "basem", n: "باسم الكربلائي", direct: { base: LAT_HOME + "sound-mp3/basem/basem", off: 15811 }, items: [[17420,"يقلبي يصابر — 1",20],[17419,"يقلبي يصابر — 2",34],[17418,"يقلبي يصابر — 3",8],[17417,"يقلبي يصابر — 4",7],[17416,"يا مهدينا الضلع — 1",18],[17415,"يا مهدينا الضلع — 2",4],[17414,"يا مهدينا الضلع — 3",9],[17413,"يا مهدينا الضلع — 4",11],[17412,"يا مهدينا الضلع — 5",17],[17411,"يا مهدينا — 1",28],[17410,"يا مهدينا — 2",3],[17409,"يا مهدينا — 3",11],[17408,"يا مهدينا — 4",10],[17407,"يا مدرك الثار — 1",18],[17406,"يا مدرك الثار — 2",11],[17405,"يا مدرك الثار — 3",19],[17404,"يا لما تنسى ثارك — 1",15],[17403,"يا لما تنسى ثارك — 2",27],[17402,"يا لما تنسى ثارك — 3",5],[17401,"يا لعفتك بطف — 1",18],[17400,"يا لعفتك بطف — 2",28],[17399,"يا لعفتك بطف — 3",5],[17398,"يا لعفتك بطف — 4",5],[17397,"يا كنز علم المصطفى — 1",36],[17396,"يا كنز علم المصطفى — 2",5],[17395,"يا كنز علم المصطفى — 3",9],[17394,"يا فاطمة — 1",13],[17393,"يا فاطمة — 2",14],[17392,"يا فاطمة — 3",15],[17391,"يا فاطمة — 4",5],[17390,"يا فاطمة — 5",6],[17389,"يا فاطمة — 6",16],[17388,"يا فاطمة — 7",9],[17387,"يا فاطمة — 8",7],[17386,"يا علي — 1",12],[17385,"يا علي — 2",13],[17384,"يا علي — 3",7],[17383,"يا علي — 4",14],[17382,"يا علي — 5",10],[17381,"يا علي — 6",9],[17380,"يا علي — 7",22],[17379,"يا علي — 8",11],[17378,"يا عباس — 1",16],[17377,"يا عباس — 2",14],[17376,"يا عباس — 3",18],[17375,"يا عباس — 4",14],[17374,"يا عباس — 5",9],[17373,"يا عباس — 6",17],[17372,"يا حِمانا — 1",40],[17371,"يا حِمانا — 2",8]] }].concat([{"id":"jalil","n":"جليل الكربلائي","items":[[5020,"",27],[5019,"",23],[5018,"استديو «سر النجاة» — 1",17],[5017,"استديو «سر النجاة» — 2",13],[5016,"استديو «سر النجاة» — 3",8],[5015,"استديو «سر النجاة» — 4",7],[5014,"استديو «سر النجاة» — 5",9],[5013,"استديو «سر النجاة» — 6",10],[5012,"استديو «سر النجاة» — 7",8],[5011,"",4],[5010,"",7],[5009,"",5],[5008,"استديو «وازينباه» — 1",13],[5007,"استديو «وازينباه» — 2",11],[5006,"استديو «وازينباه» — 3",8],[5005,"استديو «صاح ابو فاضل» — 1",9],[5004,"استديو «صاح ابو فاضل» — 2",7],[5003,"استديو «صاح ابو فاضل» — 3",13],[5002,"استديو «صاح ابو فاضل» — 4",8],[5001,"استديو «صاح ابو فاضل» — 5",9],[5000,"استديو «صاح ابو فاضل» — 6",10],[4999,"استديو «رقيه في خراب الشام» — 1",7],[4998,"استديو «رقيه في خراب الشام» — 2",3],[4997,"استديو «رقيه في خراب الشام» — 3",10],[4996,"استديو «رقيه في خراب الشام» — 4",15],[4995,"استديو «مدارس آيات» — 1",9],[4994,"استديو «مدارس آيات» — 2",10],[4993,"استديو «مدارس آيات» — 3",16],[4992,"استديو «مدارس آيات» — 4",13],[4991,"استديو «مدارس آيات» — 5",8],[4990,"استديو «مدارس آيات» — 6",10],[4989,"استديو «مدارس آيات» — 7",10],[4988,"",9],[4987,"نزلة",8],[4986,"",3],[4985,"",15],[4984,"",8],[4983,"",15],[4982,"",18],[4981,"",30],[4980,"",8],[4979,"",7],[4978,"",17],[4977,"هوسات",3],[4976,"",12],[4975,"",16],[4974,"",16],[4973,"",10],[4972,"",3],[4971,"",11]]},{"id":"nizar","n":"نزار القطري","items":[[4631,"استديو «سفرة أم البنين» — 1",8],[4630,"استديو «سفرة أم البنين» — 2",8],[4629,"استديو «سفرة أم البنين» — 3",10],[4628,"استديو «سفرة أم البنين» — 4",4],[4627,"استديو «سفرة أم البنين» — 5",4],[4626,"استديو «سفرة أم البنين» — 6",6],[4625,"استديو «سفرة أم البنين» — 7",7],[4624,"استديو «سفرة أم البنين» — 8",9],[4623,"استديو «سفرة أم البنين» — 9",7],[4622,"استديو «يالغالي» — 1",3],[4621,"استديو «يالغالي» — 2",6],[4620,"استديو «يالغالي» — 3",13],[4619,"استديو «عهدا يا سيدي» — 1",9],[4618,"استديو «عهدا يا سيدي» — 2",8],[4617,"استديو «عهدا يا سيدي» — 3",8],[4616,"استديو «عهدا يا سيدي» — 4",7],[4615,"استديو «عهدا يا سيدي» — 5",8],[4614,"استديو «عهدا يا سيدي» — 6",8],[4613,"استديو «عهدا يا سيدي» — 7",7],[4612,"استديو — 1",10],[4611,"استديو — 2",8],[4610,"استديو — 3",7],[4609,"استديو — 4",11],[4608,"استديو — 5",10],[4607,"استديو — 6",11],[4606,"استديو — 7",9],[4605,"استديو — 8",8],[4604,"استديو — 9",9],[4603,"استديو — 10",7],[4602,"استديو — 11",8],[4601,"استديو — 12",6],[4600,"استديو",8],[4599,"محرم 1425هـ — 1",12],[4598,"محرم 1425هـ — 2",7],[4597,"محرم 1425هـ — 3",6],[4596,"محرم 1425هـ — 4",6],[4595,"محرم 1425هـ — 5",8],[4594,"محرم 1425هـ — 6",13],[4593,"محرم 1425هـ — 7",16],[4592,"محرم 1425هـ — 8",8],[4591,"محرم 1425هـ — 9",14],[4590,"محرم 1425هـ — 10",18],[4589,"محرم 1425هـ — 11",13],[4588,"محرم 1425هـ — 12",17],[4587,"محرم 1425هـ — 13",4],[4586,"محرم 1425هـ — 14",8],[4585,"محرم 1425هـ — 15",19],[4584,"محرم 1425هـ — 16",20],[4583,"محرم 1425هـ — 17",24]]},{"id":"akraf","n":"حسين الأكرف","items":[[3975,"",30],[3974,"",28],[3973,"",9],[3972,"",61],[3971,"",12],[3970,"",30],[3969,"وداع مكة — 1",56],[3968,"وداع مكة — 2",17],[3967,"",5],[3966,"",16],[3965,"",18],[3964,"",7],[3963,"",19],[3962,"",33],[3961,"",18],[3960,"",2],[3959,"",7],[3958,"مآسينا — 1",2],[3957,"مآسينا — 2",6],[3956,"مآسينا — 3",7],[3955,"مآسينا — 4",7],[3954,"مآسينا — 5",7],[3953,"مآسينا — 6",7],[3952,"مآسينا — 7",6],[3951,"مآسينا — 8",7],[3950,"مآسينا — 9",9],[3949,"أي جرح — 1",6],[3948,"أي جرح — 2",6],[3947,"أي جرح — 3",6],[3946,"أي جرح — 4",8],[3945,"أي جرح — 5",8],[3944,"أي جرح — 6",8],[3943,"أي جرح — 7",7],[3942,"أي جرح — 8",9],[3941,"أي جرح — 9",6],[3940,"فداك — 1",2],[3939,"فداك — 2",9],[3938,"فداك — 3",11],[3937,"فداك — 4",9],[3936,"فداك — 5",2],[3935,"فداك — 6",11],[3934,"فداك — 7",10],[3933,"فداك — 8",8],[3932,"وقفة ألم — 1",10],[3931,"وقفة ألم — 2",7],[3930,"وقفة ألم — 3",8],[3929,"وقفة ألم — 4",7],[3928,"وقفة ألم — 5",11],[3927,"وقفة ألم — 6",9],[3926,"وقفة ألم — 7",11]]},{"id":"walid","n":"وليد المزيدي","items":[[5656,"السيد وليد المزيدي — 1",17],[5655,"السيد وليد المزيدي — 2",7],[5654,"السيد وليد المزيدي — 3",5],[5653,"السيد وليد المزيدي — 4",11],[5652,"السيد وليد المزيدي — 5",14],[5651,"السيد وليد المزيدي — 6",8],[5650,"السيد وليد المزيدي — 7",5],[5649,"السيد وليد المزيدي — 8",6],[5648,"السيد وليد المزيدي — 9",10],[5647,"السيد وليد المزيدي — 10",9],[5646,"السيد وليد المزيدي — 11",13],[5645,"السيد وليد المزيدي — 12",13],[5644,"السيد وليد المزيدي — 13",6],[5643,"السيد وليد المزيدي — 14",21],[5642,"السيد وليد المزيدي — 15",3],[5641,"السيد وليد المزيدي — 16",11],[5640,"السيد وليد المزيدي — 17",6],[5639,"السيد وليد المزيدي — 18",3],[5638,"السيد وليد المزيدي — 19",3],[5637,"السيد وليد المزيدي — 20",6],[5636,"السيد وليد المزيدي — 21",6],[5635,"السيد وليد المزيدي — 22",5],[5634,"السيد وليد المزيدي — 23",9],[5633,"السيد وليد المزيدي — 24",11],[5632,"السيد وليد المزيدي — 25",2],[5631,"السيد وليد المزيدي — 26",29],[5630,"السيد وليد المزيدي — 27",5],[5629,"السيد وليد المزيدي — 28",14],[5628,"السيد وليد المزيدي — 29",6],[5627,"السيد وليد المزيدي — 30",3],[5626,"السيد وليد المزيدي — 31",2],[5625,"السيد وليد المزيدي — 32",4],[5624,"السيد وليد المزيدي — 33",8],[5623,"السيد وليد المزيدي — 34",12],[5622,"السيد وليد المزيدي — 35",14],[5621,"السيد وليد المزيدي — 36",8],[5620,"السيد وليد المزيدي — 37",16],[5619,"السيد وليد المزيدي — 38",7],[5618,"السيد وليد المزيدي — 39",14],[5617,"السيد وليد المزيدي — 40",5],[5616,"السيد وليد المزيدي — 41",4],[5615,"السيد وليد المزيدي — 42",17],[5614,"السيد وليد المزيدي — 43",13],[5613,"السيد وليد المزيدي — 44",4],[5612,"السيد وليد المزيدي — 45",18],[5611,"السيد وليد المزيدي — 46",17],[5610,"السيد وليد المزيدي — 47",11],[5609,"السيد وليد المزيدي — 48",29],[5608,"السيد وليد المزيدي — 49",10],[5607,"السيد وليد المزيدي — 50",11]]},{"id":"hamza","n":"حمزة الصغير","items":[[1327,"الرادود حمزة الصغير — 1",21],[1326,"الرادود حمزة الصغير — 2",14],[1325,"الرادود حمزة الصغير — 3",9],[1324,"الرادود حمزة الصغير — 4",13],[1323,"الرادود حمزة الصغير — 5",32],[1322,"الرادود حمزة الصغير — 6",29],[1321,"الرادود حمزة الصغير — 7",16],[1320,"الرادود حمزة الصغير — 8",17],[1319,"الرادود حمزة الصغير — 9",15],[1318,"الرادود حمزة الصغير — 10",18],[1317,"الرادود حمزة الصغير — 11",20],[1316,"الرادود حمزة الصغير — 12",31],[1315,"الرادود حمزة الصغير — 13",22],[1314,"الرادود حمزة الصغير — 14",10],[1313,"الرادود حمزة الصغير — 15",16],[1312,"الرادود حمزة الصغير — 16",7],[1311,"الرادود حمزة الصغير — 17",15],[1310,"الرادود حمزة الصغير — 18",15],[1309,"الرادود حمزة الصغير — 19",15],[1308,"الرادود حمزة الصغير — 20",14],[1307,"الرادود حمزة الصغير — 21",7],[1306,"الرادود حمزة الصغير — 22",7],[1305,"الرادود حمزة الصغير — 23",9],[1304,"الرادود حمزة الصغير — 24",22],[1303,"الرادود حمزة الصغير — 25",15],[1302,"الرادود حمزة الصغير — 26",10],[1301,"الرادود حمزة الصغير — 27",8],[1300,"الرادود حمزة الصغير — 28",15],[1299,"الرادود حمزة الصغير — 29",5],[1298,"الرادود حمزة الصغير — 30",15],[1297,"الرادود حمزة الصغير — 31",7],[1296,"الرادود حمزة الصغير — 32",15],[1295,"الرادود حمزة الصغير — 33",14],[1294,"الرادود حمزة الصغير — 34",21],[1293,"الرادود حمزة الصغير — 35",18],[1292,"الرادود حمزة الصغير — 36",15],[1291,"الرادود حمزة الصغير — 37",20],[1290,"الرادود حمزة الصغير — 38",5],[1289,"الرادود حمزة الصغير — 39",16],[1288,"الرادود حمزة الصغير — 40",9],[1287,"الرادود حمزة الصغير — 41",6],[1286,"الرادود حمزة الصغير — 42",8],[1285,"الرادود حمزة الصغير — 43",30],[1284,"الرادود حمزة الصغير — 44",14],[1283,"الرادود حمزة الصغير — 45",9],[1282,"الرادود حمزة الصغير — 46",6],[1281,"الرادود حمزة الصغير — 47",13],[1280,"الرادود حمزة الصغير — 48",7],[1279,"الرادود حمزة الصغير — 49",11],[1278,"الرادود حمزة الصغير — 50",7]]},{"id":"abobashir","n":"أبو بشير النجفي","items":[[1415,"الرادود أبو بشير النجفي — 1",28],[1414,"الرادود أبو بشير النجفي — 2",20],[1413,"الرادود أبو بشير النجفي — 3",22],[1412,"الرادود أبو بشير النجفي — 4",5],[1411,"الرادود أبو بشير النجفي — 5",9],[1410,"الرادود أبو بشير النجفي — 6",9],[1409,"الرادود أبو بشير النجفي — 7",5],[1408,"الرادود أبو بشير النجفي — 8",9],[1407,"الرادود أبو بشير النجفي — 9",6],[1406,"الرادود أبو بشير النجفي — 10",5],[1405,"الرادود أبو بشير النجفي — 11",30],[1404,"الرادود أبو بشير النجفي — 12",11],[1403,"الرادود أبو بشير النجفي — 13",24],[1402,"الرادود أبو بشير النجفي — 14",22],[1401,"الرادود أبو بشير النجفي — 15",8],[1400,"الرادود أبو بشير النجفي — 16",13],[1399,"الرادود أبو بشير النجفي — 17",12],[1398,"الرادود أبو بشير النجفي — 18",20],[1397,"الرادود أبو بشير النجفي — 19",4],[1396,"الرادود أبو بشير النجفي — 20",7],[1395,"الرادود أبو بشير النجفي — 21",22],[1394,"الرادود أبو بشير النجفي — 22",11],[1393,"الرادود أبو بشير النجفي — 23",15],[1392,"الرادود أبو بشير النجفي — 24",6],[1391,"الرادود أبو بشير النجفي — 25",14],[1390,"الرادود أبو بشير النجفي — 26",5],[1389,"الرادود أبو بشير النجفي — 27",14],[1388,"الرادود أبو بشير النجفي — 28",26],[1387,"الرادود أبو بشير النجفي — 29",6],[1386,"الرادود أبو بشير النجفي — 30",5],[1385,"الرادود أبو بشير النجفي — 31",29],[1384,"الرادود أبو بشير النجفي — 32",5],[1383,"الرادود أبو بشير النجفي — 33",6],[1382,"الرادود أبو بشير النجفي — 34",24],[1381,"الرادود أبو بشير النجفي — 35",9],[1380,"الرادود أبو بشير النجفي — 36",30],[1379,"الرادود أبو بشير النجفي — 37",13],[1378,"الرادود أبو بشير النجفي — 38",18],[1377,"الرادود أبو بشير النجفي — 39",6],[1376,"الرادود أبو بشير النجفي — 40",7],[1375,"الرادود أبو بشير النجفي — 41",9],[1374,"الرادود أبو بشير النجفي — 42",30],[1373,"الرادود أبو بشير النجفي — 43",12],[1372,"الرادود أبو بشير النجفي — 44",18],[1371,"الرادود أبو بشير النجفي — 45",40],[1370,"الرادود أبو بشير النجفي — 46",17],[1369,"الرادود أبو بشير النجفي — 47",5],[1368,"الرادود أبو بشير النجفي — 48",24],[1367,"الرادود أبو بشير النجفي — 49",30],[1366,"الرادود أبو بشير النجفي — 50",31]]},{"id":"hasan","n":"حسن الكربلائي","items":[[3911,"استديو",14],[3910,"",24],[1480,"جمادى الثانية 1424هـ — 1",7],[1479,"جمادى الثانية 1424هـ — 2",7],[1478,"جمادى الثانية 1424هـ — 3",25],[1477,"جمادى الثانية 1424هـ — 4",12],[1476,"جمادى الثانية 1424هـ — 5",18],[1475,"جمادى الثانية 1424هـ — 6",13],[1474,"جمادى الثانية 1424هـ — 7",10],[1473,"جمادى الثانية 1424هـ — 8",23],[1472,"جمادى الثانية 1424هـ — 9",10],[1471,"جمادى الثانية 1424هـ — 10",28],[1470,"",20],[1469,"",28],[1468,"",14],[1467,"",40],[1466,"",23],[1465,"",34],[1464,"",28],[1463,"",26],[1462,"",15],[1461,"",26],[1460,"",29],[1459,"",30],[1458,"",19],[1457,"",65],[1456,"",24],[1455,"",29],[1454,"",17],[1453,"",61],[1452,"",7],[1451,"",32],[1450,"",14],[1449,"",30],[1448,"",29],[1447,"",17],[1446,"",28],[1445,"",7],[1444,"",19],[1443,"",19],[1442,"",26],[1441,"",5],[1440,"",29],[1439,"",8],[1438,"",31],[1437,"",11],[1436,"",30],[1435,"",23],[1434,"",50],[1433,"",15]]},{"id":"abothar","n":"أبو ذر الحلواجي","items":[[5099,"",33],[5098,"استديو «شيال العلم» — 1",5],[5097,"استديو «شيال العلم» — 2",3],[5096,"استديو «شيال العلم» — 3",6],[5095,"استديو «شيال العلم» — 4",3],[5094,"استديو «شيال العلم» — 5",6],[5093,"استديو «شيال العلم» — 6",6],[5092,"استديو «شيال العلم» — 7",4],[5091,"استديو «شيال العلم» — 8",4],[5090,"استديو «شيال العلم» — 9",5],[5089,"استديو «شيال العلم» — 10",4],[5088,"استديو «شيال العلم» — 11",5],[5087,"استديو «شيال العلم» — 12",6],[5086,"شهادة السيدة الزهراء 1424هـ — 1",7],[5085,"شهادة السيدة الزهراء 1424هـ — 2",9],[5084,"شهادة السيدة الزهراء 1424هـ — 3",9],[5083,"استديو «رضيع الحسين» — 1",4],[5082,"استديو «رضيع الحسين» — 2",6],[5081,"استديو «رضيع الحسين» — 3",10],[5080,"استديو «رضيع الحسين» — 4",11],[5079,"استديو «رضيع الحسين» — 5",6],[5078,"استديو «رضيع الحسين» — 6",8],[5077,"استديو «رضيع الحسين» — 7",7],[5076,"استديو «رضيع الحسين» — 8",11],[5075,"استديو «الظليمة» — 1",3],[5074,"استديو «الظليمة» — 2",3],[5073,"استديو «الظليمة» — 3",6],[5072,"استديو «الظليمة» — 4",6],[5071,"استديو «الظليمة» — 5",7],[5070,"استديو «الظليمة» — 6",6],[5069,"استديو «الظليمة» — 7",7],[5068,"استديو «الظليمة» — 8",7],[5067,"استديو «الظليمة» — 9",7],[5066,"استديو «الظليمة» — 10",6],[5065,"استديو «الظليمة» — 11",7],[5064,"استديو «الظليمة» — 12",5],[5063,"استديو «الظليمة» — 13",5],[5062,"استديو «حروف القرآن» — 1",9],[5061,"استديو «حروف القرآن» — 2",7],[5060,"استديو «حروف القرآن» — 3",7],[5059,"استديو «حروف القرآن» — 4",8],[5058,"استديو «حروف القرآن» — 5",7],[5057,"استديو «حروف القرآن» — 6",6],[5056,"استديو «حروف القرآن» — 7",6],[5055,"استديو «حروف القرآن» — 8",11],[5054,"",26],[5053,"",45],[5052,"",15]]},{"id":"saleh","n":"صالح الدرازي","items":[[4012,"الرادود صالح الدرازي — 1",41],[4011,"الرادود صالح الدرازي — 2",16],[4010,"الرادود صالح الدرازي — 3",46],[4009,"الرادود صالح الدرازي — 4",45],[4008,"الرادود صالح الدرازي — 5",36],[4007,"الرادود صالح الدرازي — 6",6],[4006,"الرادود صالح الدرازي — 7",9],[4005,"الرادود صالح الدرازي — 8",56],[4004,"الرادود صالح الدرازي — 9",59],[4003,"الرادود صالح الدرازي — 10",44],[4002,"الرادود صالح الدرازي — 11",34],[4001,"الرادود صالح الدرازي — 12",47],[4000,"الرادود صالح الدرازي — 13",54],[3999,"الرادود صالح الدرازي — 14",10],[3998,"الرادود صالح الدرازي — 15",18],[3997,"الرادود صالح الدرازي — 16",66],[3996,"الرادود صالح الدرازي — 17",25],[3995,"الرادود صالح الدرازي — 18",53],[3994,"الرادود صالح الدرازي — 19",42],[3993,"الرادود صالح الدرازي — 20",24],[3992,"الرادود صالح الدرازي — 21",21],[3991,"الرادود صالح الدرازي — 22",42],[3990,"الرادود صالح الدرازي — 23",10],[3989,"الرادود صالح الدرازي — 24",11],[3988,"الرادود صالح الدرازي — 25",25],[3987,"الرادود صالح الدرازي — 26",4],[3986,"الرادود صالح الدرازي — 27",40],[3985,"الرادود صالح الدرازي — 28",14],[3984,"الرادود صالح الدرازي — 29",19],[3983,"الرادود صالح الدرازي — 30",30],[3982,"الرادود صالح الدرازي — 31",22],[3981,"الرادود صالح الدرازي — 32",29],[3980,"الرادود صالح الدرازي — 33",55],[3979,"الرادود صالح الدرازي — 34",26],[3978,"الرادود صالح الدرازي — 35",45],[3977,"الرادود صالح الدرازي — 36",45]]},{"id":"shobbar","n":"علي شبر","items":[[5231,"السيد علي شبر — 1",6],[5230,"السيد علي شبر — 2",5],[5229,"السيد علي شبر — 3",14],[5228,"السيد علي شبر — 4",12],[5227,"السيد علي شبر — 5",11],[5226,"السيد علي شبر — 6",5],[5225,"السيد علي شبر — 7",11],[5224,"السيد علي شبر — 8",13],[5223,"السيد علي شبر — 9",6],[5222,"السيد علي شبر — 10",15],[5221,"السيد علي شبر — 11",17],[5220,"السيد علي شبر — 12",7],[5219,"السيد علي شبر — 13",13],[5218,"السيد علي شبر — 14",12],[5217,"السيد علي شبر — 15",18],[5216,"السيد علي شبر — 16",13],[5215,"السيد علي شبر — 17",7],[5214,"السيد علي شبر — 18",10],[5213,"السيد علي شبر — 19",9],[5212,"السيد علي شبر — 20",5],[5211,"السيد علي شبر — 21",7],[5210,"السيد علي شبر — 22",6],[5209,"السيد علي شبر — 23",10],[5208,"السيد علي شبر — 24",17],[5207,"السيد علي شبر — 25",4],[5206,"السيد علي شبر — 26",7],[5205,"السيد علي شبر — 27",10],[5204,"السيد علي شبر — 28",20],[5203,"السيد علي شبر — 29",5],[5202,"السيد علي شبر — 30",6],[5201,"السيد علي شبر — 31",10],[5200,"السيد علي شبر — 32",12],[5199,"السيد علي شبر — 33",9],[5198,"السيد علي شبر — 34",12],[5197,"السيد علي شبر — 35",16],[5196,"السيد علي شبر — 36",13],[5195,"السيد علي شبر — 37",14],[5194,"السيد علي شبر — 38",18],[5193,"السيد علي شبر — 39",2],[5192,"السيد علي شبر — 40",14],[5191,"السيد علي شبر — 41",12],[5190,"السيد علي شبر — 42",19],[5189,"السيد علي شبر — 43",2],[5188,"السيد علي شبر — 44",11],[5187,"السيد علي شبر — 45",14],[5186,"السيد علي شبر — 46",19],[5185,"السيد علي شبر — 47",4],[5184,"السيد علي شبر — 48",13],[5182,"السيد علي شبر — 1",11],[5181,"السيد علي شبر — 2",18]]},{"id":"hoseini","n":"محمد الحسيني","items":[[5420,"",7],[5419,"",8],[5418,"",19],[5417,"",17],[5416,"",2],[5415,"",6],[5414,"",14],[5413,"",8],[5412,"",6],[5411,"",7],[5410,"",3],[5409,"",10],[5408,"",12],[5407,"",8],[5406,"",6],[5405,"",9],[5404,"يا والدي — 1",3],[5403,"يا والدي — 2",5],[5402,"يا والدي — 3",5],[5401,"يا والدي — 4",5],[5400,"يا والدي — 5",13],[5399,"يا والدي — 6",5],[5398,"يا والدي — 7",7],[5397,"يا والدي — 8",3],[5396,"يا والدي — 9",5],[5395,"يا والدي — 10",15],[5394,"وغابت الشمس — 1",3],[5393,"وغابت الشمس — 2",10],[5392,"وغابت الشمس — 3",16],[5391,"وغابت الشمس — 4",11],[5390,"وغابت الشمس — 5",8],[5389,"وغابت الشمس — 6",8],[5388,"بنت مسلم — 1",5],[5387,"بنت مسلم — 2",4],[5386,"بنت مسلم — 3",8],[5385,"بنت مسلم — 4",10],[5384,"بنت مسلم — 5",8],[5383,"بنت مسلم — 6",9],[5382,"بنت مسلم — 7",6],[5381,"قصة هموم — 1",3],[5380,"قصة هموم — 2",7],[5379,"قصة هموم — 3",6],[5378,"قصة هموم — 4",7],[5377,"قصة هموم — 5",3],[5376,"قصة هموم — 6",7],[5375,"قصة هموم — 7",14],[5374,"يا عراق — 1",9],[5373,"يا عراق — 2",9],[5372,"يا عراق — 3",5],[5371,"يا عراق — 4",6]]},{"id":"ghassan","n":"غسان الكربلائي","items":[[1548,"",12],[1547,"",9],[1546,"",6],[1545,"استديو — 1",12],[1544,"استديو — 2",13],[1543,"استديو — 3",11],[1542,"محرم 1424هـ — 1",9],[1541,"محرم 1424هـ — 2",32],[1540,"محرم 1424هـ — 3",36],[1539,"محرم 1424هـ — 4",8],[1538,"محرم 1424هـ — 5",10],[1537,"محرم 1424هـ — 6",23],[1536,"محرم 1424هـ — 7",6],[1535,"محرم 1424هـ — 8",12],[1534,"محرم 1424هـ — 9",28],[1533,"محرم 1424هـ — 10",12],[1532,"محرم 1424هـ — 11",9],[1531,"محرم 1424هـ — 12",30],[1530,"محرم 1424هـ — 13",10],[1529,"محرم 1424هـ — 14",29],[1528,"محرم 1424هـ — 15",6],[1527,"محرم 1424هـ — 16",13],[1526,"محرم 1424هـ — 17",16],[1525,"محرم 1424هـ — 18",16],[1524,"محرم 1424هـ — 19",36],[1523,"محرم 1424هـ — 20",16],[1522,"محرم 1424هـ — 21",29],[1521,"محرم 1424هـ — 22",6],[1520,"محرم 1424هـ — 23",10],[1519,"محرم 1424هـ — 24",30],[1518,"محرم 1424هـ — 25",15],[1517,"محرم 1424هـ — 26",33],[1516,"محرم 1424هـ — 27",30]]},{"id":"balady","n":"عبد الأمير البلادي","items":[[5051,"29 صفر 1425هـ — 1",31],[5050,"29 صفر 1425هـ — 2",31],[5049,"21 صفر 1425هـ",43],[5048,"10 محرم 1427هـ — 1",31],[5047,"10 محرم 1427هـ — 2",31],[5046,"10 محرم 1427هـ — 3",31],[5045,"10 محرم 1427هـ — 4",31],[5044,"8 محرم 1426هـ — 1",45],[5043,"8 محرم 1426هـ — 2",45],[5042,"8 محرم 1426هـ — 3",45],[5041,"8 محرم 1426هـ — 4",45],[5040,"استديو «طفلة الحسين» — 1",4],[5039,"استديو «طفلة الحسين» — 2",9],[5038,"استديو «طفلة الحسين» — 3",10],[5037,"استديو «طفلة الحسين» — 4",6],[5036,"استديو «طفلة الحسين» — 5",6],[5035,"استديو «طفلة الحسين» — 6",7],[5034,"استديو «يتيمة» — 1",1],[5033,"استديو «يتيمة» — 2",10],[5032,"استديو «يتيمة» — 3",7],[5031,"استديو «يتيمة» — 4",5],[5030,"استديو «يتيمة» — 5",5],[5029,"استديو «يتيمة» — 6",5],[5028,"استديو «يتيمة» — 7",6],[5027,"استديو «يتيمة» — 8",7],[5026,"استديو «يتيمة» — 9",8],[5025,"استديو «الله أي دم» — 1",4],[5024,"استديو «الله أي دم» — 2",7],[5023,"استديو «الله أي دم» — 3",3],[5022,"استديو «الله أي دم» — 4",15],[5021,"استديو «الله أي دم» — 5",8]]},{"id":"hkadhim","n":"حسين كاظم","items":[[5312,"زهراء الأربعين — 1",4],[5311,"زهراء الأربعين — 2",7],[5310,"زهراء الأربعين — 3",9],[5309,"زهراء الأربعين — 4",8],[5308,"زهراء الأربعين — 5",8],[5307,"زهراء الأربعين — 6",10],[5306,"زهراء الأربعين — 7",5],[5305,"زهراء الأربعين إنكليزي",5],[5304,"أناشيد كربلاء — 1",5],[5303,"أناشيد كربلاء — 2",3],[5302,"أناشيد كربلاء — 3",7],[5301,"أناشيد كربلاء — 4",6],[5300,"أناشيد كربلاء — 5",8],[5299,"أناشيد كربلاء — 6",6],[5298,"أناشيد كربلاء — 7",5],[5297,"نخوات 2 — 1",9],[5296,"نخوات 2 — 2",5],[5295,"نخوات 2 — 3",6],[5294,"نخوات 2 — 4",6],[5293,"نخوات 2 — 5",7],[5292,"نخوات 2 — 6",12],[5291,"نخوات 2 — 7",5],[5290,"نخوات 1 — 1",17],[5289,"نخوات 1 — 2",6],[5288,"نخوات 1 — 3",7],[5287,"نخوات 1 — 4",10],[5286,"نخوات 1 — 5",8],[5285,"نخوات 1 — 6",8],[5284,"نخوات 1 — 7",4],[5283,"صرخة حزن — 1",6],[5282,"صرخة حزن — 2",5],[5281,"صرخة حزن — 3",13],[5280,"صرخة حزن — 4",10],[5279,"صرخة حزن — 5",8],[5278,"آنين الأربعين — 1",7],[5277,"آنين الأربعين — 2",9],[5276,"آنين الأربعين — 3",14],[5275,"آنين الأربعين — 4",9],[5274,"آنين الأربعين — 5",5],[5273,"آنين الأربعين — 6",15],[5272,"آنين الأربعين — 7",10],[5271,"آنين الأربعين — 8",6],[5270,"وغابة الشمس — 1",13],[5269,"وغابة الشمس — 2",17],[5268,"وغابة الشمس — 3",31],[5267,"أركان الهدى — 1",4],[5266,"أركان الهدى — 2",7],[5265,"أركان الهدى — 3",8],[5264,"أركان الهدى — 4",10],[5263,"أركان الهدى — 5",8]]},{"id":"hamadi","n":"علي حمادي","items":[[5162,"الرادود علي حمادي — 1",19],[5161,"الرادود علي حمادي — 2",31],[5160,"الرادود علي حمادي — 3",23],[5159,"الرادود علي حمادي — 4",43],[5158,"الرادود علي حمادي — 5",46],[5157,"الرادود علي حمادي — 6",15],[5156,"الرادود علي حمادي — 7",31],[5155,"الرادود علي حمادي — 8",14],[5154,"الرادود علي حمادي — 9",11],[5153,"الرادود علي حمادي — 10",2],[5152,"الرادود علي حمادي — 11",45],[5151,"الرادود علي حمادي — 12",31],[5150,"الرادود علي حمادي — 13",46],[5149,"الرادود علي حمادي — 14",46],[5148,"الرادود علي حمادي — 15",54],[5147,"الرادود علي حمادي — 16",23],[5146,"الرادود علي حمادي — 17",31],[5145,"الرادود علي حمادي — 18",39],[5144,"الرادود علي حمادي — 19",11],[5143,"الرادود علي حمادي — 20",11],[5142,"الرادود علي حمادي — 21",9],[5141,"الرادود علي حمادي — 22",22],[5140,"الرادود علي حمادي — 23",25],[5139,"الرادود علي حمادي — 24",91],[5138,"الرادود علي حمادي — 25",100],[5137,"الرادود علي حمادي — 26",126],[5136,"الرادود علي حمادي — 27",52],[5135,"الرادود علي حمادي — 28",36],[5134,"الرادود علي حمادي — 29",79],[5133,"الرادود علي حمادي — 30",92],[5132,"الرادود علي حمادي — 31",40],[5131,"الرادود علي حمادي — 32",30],[5130,"الرادود علي حمادي — 33",30],[5129,"الرادود علي حمادي — 34",26],[5128,"الرادود علي حمادي — 35",31],[5127,"الرادود علي حمادي — 36",31],[5126,"الرادود علي حمادي — 37",31],[5125,"الرادود علي حمادي — 38",31]]},{"id":"abdalreda","n":"عبد الرضا النجفي","items":[[1607,"عبد الرضا النجفي — 1",21],[1606,"عبد الرضا النجفي — 2",24],[1605,"عبد الرضا النجفي — 3",33],[1604,"عبد الرضا النجفي — 4",25],[1603,"عبد الرضا النجفي — 5",11],[1602,"عبد الرضا النجفي — 6",4],[1601,"عبد الرضا النجفي — 7",21],[1600,"عبد الرضا النجفي — 8",17],[1599,"عبد الرضا النجفي — 9",22],[1598,"عبد الرضا النجفي — 10",26],[1597,"عبد الرضا النجفي — 11",29],[1596,"عبد الرضا النجفي — 12",22],[1595,"عبد الرضا النجفي — 13",3],[1594,"عبد الرضا النجفي — 14",2],[1593,"عبد الرضا النجفي — 15",10],[1592,"عبد الرضا النجفي — 16",2],[1591,"عبد الرضا النجفي — 17",15],[1590,"عبد الرضا النجفي — 18",16],[1589,"عبد الرضا النجفي — 19",19],[1588,"عبد الرضا النجفي — 20",29],[1587,"عبد الرضا النجفي — 21",9],[1586,"عبد الرضا النجفي — 22",28],[1585,"عبد الرضا النجفي — 23",19],[1584,"عبد الرضا النجفي — 24",24],[1583,"عبد الرضا النجفي — 25",16],[1582,"عبد الرضا النجفي — 26",12],[1581,"عبد الرضا النجفي — 27",15],[1580,"عبد الرضا النجفي — 28",16],[1579,"عبد الرضا النجفي — 29",4],[1578,"عبد الرضا النجفي — 30",18]]},{"id":"jdarazi","n":"جعفر الدرازي","items":[[3976,"« ثأر الله الأعظم » مشترك مع صالح",45],[1577,"",9],[1576,"استديو — 1",2],[1575,"استديو — 2",9],[1574,"استديو — 3",6],[1573,"",31],[1572,"استديو — 1",8],[1571,"استديو — 2",24],[1570,"استديو — 3",10],[1569,"استديو — 4",4],[1568,"استديو — 5",7],[1567,"استديو — 6",4],[1566,"استديو — 7",5],[1565,"استديو — 8",2],[1564,"استديو — 9",2],[1563,"استديو — 10",17],[1562,"استديو — 11",3],[1561,"استديو — 12",7],[1560,"استديو — 13",9],[1559,"استديو — 14",3],[1558,"استديو — 15",3],[1557,"استديو — 16",5],[1556,"استديو — 17",9],[1555,"استديو — 18",3],[1554,"",13],[1553,"",13],[1552,"استديو — 1",9],[1551,"استديو — 2",5],[1550,"",8],[1549,"",30]]},{"id":"sahwan","n":"جعفر سهوان","items":[[5337,"13 محرم مع حسين سهوان",85],[5336,"",31],[5335,"3 محرم 1426هـ",31],[5334,"20 رمضان 1425هـ — 1",23],[5333,"20 رمضان 1425هـ — 2",30],[5332,"",10],[5331,"",3],[5330,"",49],[5329,"",6],[5328,"",20],[5327,"",19],[5326,"",15],[5325,"",10],[5324,"",17],[5323,"11 صفر 1425هـ",44],[5322,"مع عبد الشهيد الثور — 1",23],[5321,"مع عبد الشهيد الثور — 2",32],[5320,"",23],[5319,"",28],[5318,"",10],[5317,"",25],[5316,"",4],[5315,"",24],[5314,"",25],[5313,"",25]]},{"id":"hujayrat","n":"محمد الحجيرات","items":[[5362,"وجه الصباح — 1",8],[5361,"وجه الصباح — 2",7],[5360,"وجه الصباح — 3",10],[5359,"وجه الصباح — 4",15],[5358,"وجه الصباح — 5",3],[5357,"وجه الصباح — 6",11],[5356,"تراث عاشوراء — 1",6],[5355,"تراث عاشوراء — 2",7],[5354,"تراث عاشوراء — 3",11],[5353,"تراث عاشوراء — 4",10],[5352,"تراث عاشوراء — 5",6],[5351,"تراث عاشوراء — 6",10],[5350,"تراث عاشوراء — 7",8],[5349,"تراث عاشوراء — 8",12],[5348,"المسبيات — 1",6],[5347,"المسبيات — 2",7],[5346,"المسبيات — 3",10],[5345,"المسبيات — 4",9],[5344,"المسبيات — 5",8],[5343,"المسبيات — 6",7],[5342,"بنت الهدى 2 مع علي شبر — 1",5],[5341,"بنت الهدى 2 مع علي شبر — 2",6],[5340,"بنت الهدى 2 مع علي شبر — 3",10],[5339,"بنت الهدى 2 مع علي شبر — 4",12],[5338,"بنت الهدى 2 مع علي شبر — 5",9]]},{"id":"adheed","n":"علي العضيد","items":[[5124,"الرادود علي العضيد — 1",6],[5123,"الرادود علي العضيد — 2",13],[5122,"الرادود علي العضيد — 3",6],[5121,"الرادود علي العضيد — 4",2],[5120,"الرادود علي العضيد — 5",11],[5119,"الرادود علي العضيد — 6",13],[5118,"الرادود علي العضيد — 7",4],[5117,"الرادود علي العضيد — 8",16],[5116,"الرادود علي العضيد — 9",17],[5115,"الرادود علي العضيد — 10",6],[5114,"الرادود علي العضيد — 11",10],[5113,"الرادود علي العضيد — 12",5],[5112,"الرادود علي العضيد — 13",3],[5111,"الرادود علي العضيد — 14",17],[5110,"الرادود علي العضيد — 15",6],[5109,"الرادود علي العضيد — 16",3],[5108,"الرادود علي العضيد — 17",9],[5107,"الرادود علي العضيد — 18",3],[5106,"الرادود علي العضيد — 19",2],[5105,"الرادود علي العضيد — 20",7],[5104,"الرادود علي العضيد — 21",9],[5103,"الرادود علي العضيد — 22",7],[5102,"الرادود علي العضيد — 23",12],[5101,"الرادود علي العضيد — 24",6],[5100,"الرادود علي العضيد — 25",10]]},{"id":"rumi","n":"يوسف الرومي","items":[[5679,"الرادود يوسف الرومي — 1",30],[5678,"الرادود يوسف الرومي — 2",30],[5677,"الرادود يوسف الرومي — 3",30],[5676,"الرادود يوسف الرومي — 4",30],[5675,"الرادود يوسف الرومي — 5",45],[5674,"الرادود يوسف الرومي — 6",39],[5673,"الرادود يوسف الرومي — 7",36],[5672,"الرادود يوسف الرومي — 8",44],[5671,"الرادود يوسف الرومي — 9",27],[5670,"الرادود يوسف الرومي — 10",41],[5669,"الرادود يوسف الرومي — 11",22],[5668,"الرادود يوسف الرومي — 12",20],[5667,"الرادود يوسف الرومي — 13",46],[5666,"الرادود يوسف الرومي — 14",25],[5665,"الرادود يوسف الرومي — 15",19],[5664,"الرادود يوسف الرومي — 16",31],[5663,"الرادود يوسف الرومي — 17",27],[5662,"الرادود يوسف الرومي — 18",41],[5661,"الرادود يوسف الرومي — 19",39],[5660,"الرادود يوسف الرومي — 20",43],[5659,"الرادود يوسف الرومي — 21",33],[5658,"الرادود يوسف الرومي — 22",43],[5657,"الرادود يوسف الرومي — 23",44]]},{"id":"hasanisa","n":"حسن عيسى","items":[[5253,"الرادود حسن عيسى — 1",7],[5252,"الرادود حسن عيسى — 2",25],[5251,"الرادود حسن عيسى — 3",3],[5250,"الرادود حسن عيسى — 4",12],[5249,"الرادود حسن عيسى — 5",3],[5248,"الرادود حسن عيسى — 6",14],[5247,"الرادود حسن عيسى — 7",8],[5246,"الرادود حسن عيسى — 8",23],[5245,"الرادود حسن عيسى — 9",35],[5244,"الرادود حسن عيسى — 10",28],[5243,"الرادود حسن عيسى — 11",30],[5242,"الرادود حسن عيسى — 12",21],[5241,"الرادود حسن عيسى — 13",6],[5240,"الرادود حسن عيسى — 14",10],[5239,"الرادود حسن عيسى — 15",25],[5238,"الرادود حسن عيسى — 16",18],[5237,"الرادود حسن عيسى — 17",22],[5236,"الرادود حسن عيسى — 18",5],[5235,"الرادود حسن عيسى — 19",40],[5234,"الرادود حسن عيسى — 20",12],[5233,"الرادود حسن عيسى — 21",24],[5232,"الرادود حسن عيسى — 22",38]]},{"id":"mumin","n":"صالح المؤمن","items":[[5440,"استديو «يا قتيل العبرات» — 1",10],[5439,"استديو «يا قتيل العبرات» — 2",8],[5438,"استديو «يا قتيل العبرات» — 3",11],[5437,"استديو «يا قتيل العبرات» — 4",11],[5436,"استديو «يا قتيل العبرات» — 5",11],[5435,"استديو «يا قتيل العبرات» — 6",5],[5434,"استديو «إلك دمعة» — 1",9],[5433,"استديو «إلك دمعة» — 2",9],[5432,"استديو «إلك دمعة» — 3",8],[5431,"استديو «إلك دمعة» — 4",6],[5430,"استديو «إلك دمعة» — 5",6],[5429,"استديو «إلك دمعة» — 6",6],[5428,"استديو «إلك دمعة» — 7",8],[5427,"استديو «آلام الحسين» — 1",5],[5426,"استديو «آلام الحسين» — 2",10],[5425,"استديو «آلام الحسين» — 3",8],[5424,"استديو «آلام الحسين» — 4",10],[5423,"استديو «آلام الحسين» — 5",12],[5422,"استديو «آلام الحسين» — 6",14],[5421,"استديو «آلام الحسين» — 7",7]]},{"id":"qashqash","n":"نصرات قشاقش","items":[[5784,"استديو",2],[5783,"",9],[5782,"",4],[1621,"",15],[1620,"",12],[1619,"",14],[1618,"",3],[1617,"",10],[1616,"",2],[1615,"",9],[1614,"",6],[1613,"استديو — 1",3],[1612,"استديو — 2",4],[1611,"استديو — 3",5],[1610,"استديو — 4",7],[1609,"استديو — 5",7],[1608,"استديو — 6",1]]}]);
  var latTok = 0;
  var LAT_CATB = {"basem":1,"jalil":2,"nizar":3,"akraf":88,"walid":133,"hamza":32,"abobashir":33,"hasan":34,"abothar":123,"saleh":89,"shobbar":126,"hoseini":131,"ghassan":35,"balady":122,"hkadhim":128,"hamadi":125,"abdalreda":37,"jdarazi":36,"sahwan":129,"hujayrat":130,"adheed":124,"rumi":134,"hasanisa":127,"mumin":132,"qashqash":38};
  LAT.forEach(function (r) { r.c = LAT_CATB[r.id]; });
  function latHttpText(url) {
    var H = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp;
    if (H && H.get) {
      return H.get({ url: url, responseType: "text", headers: { "Referer": LAT_HOME } }).then(function (r) {
        if (!r || r.status < 200 || r.status >= 300) throw new Error("http " + (r && r.status));
        return typeof r.data === "string" ? r.data : "";
      });
    }
    return fetch(url).then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.text(); });
  }
  function latFind(html) {
    var u = "", m = /(?:https?:)?\/\/(?:www\.)?yahosein\.com\/latom\/sound-mp3\/[A-Za-z0-9_\-\/.%]{1,200}?\.mp3/i.exec(html);
    if (m) { u = m[0]; if (u.indexOf("//") === 0) u = "https:" + u; u = u.replace(/^http:/i, "https:"); }
    else {
      m = /["'(=\s]((?:\.\/|\/latom\/)?sound-mp3\/[A-Za-z0-9_\-\/.%]{1,200}?\.mp3)/i.exec(html);
      if (m) { var p = m[1].replace(/^\.\//, ""); u = p.indexOf("/latom/") === 0 ? "https://www.yahosein.com" + p : LAT_HOME + p; }
    }
    return u && trustedUrl(u) ? u : "";
  }
  function latCache(id, url) {
    try {
      var o = JSON.parse(localStorage.getItem("latres") || "{}"); if (!o || typeof o !== "object" || Array.isArray(o)) o = {};
      if (url === undefined) { var c = o[id]; return typeof c === "string" && /\.mp3$/i.test(c) && trustedUrl(c) ? c : ""; }
      o[id] = url; var ks = Object.keys(o); if (ks.length > 800) ks.slice(0, ks.length - 800).forEach(function (k) { delete o[k]; });
      localStorage.setItem("latres", JSON.stringify(o));
    } catch (e) {}
    return "";
  }
  function latResolve(r, it) {
    if (r.direct && it[0] >= 17371 && it[0] <= 17420) return Promise.resolve(r.direct.base + (it[0] - r.direct.off) + ".mp3");
    var c = latCache(it[0]); if (c) return Promise.resolve(c);
    return latHttpText(LAT_HOME + "index.php?file=" + it[0]).then(function (html) {
      var u = latFind(String(html).slice(0, 400000)); if (!u) throw new Error("no link");
      latCache(it[0], u); return u;
    });
  }
  /* جلب القائمة الكاملة للرادود من صفحات الموقع وحفظها بالجهاز */
  function latStored(r) {
    try {
      var o = JSON.parse(localStorage.getItem("latall") || "{}"), a = o && o[r.id];
      if (!Array.isArray(a)) return null;
      var out = a.filter(function (x) { return Array.isArray(x) && x[0] > 0 && x[0] < 10000000 && typeof x[1] === "string" && typeof x[2] === "number"; });
      return out.length ? out : null;
    } catch (e) { return null; }
  }
  function latSave(r, items) {
    try {
      var o = JSON.parse(localStorage.getItem("latall") || "{}"); if (!o || typeof o !== "object" || Array.isArray(o)) o = {};
      o[r.id] = items; localStorage.setItem("latall", JSON.stringify(o)); return true;
    } catch (e) { return false; }
  }
  function latItems(r) { return latStored(r) || r.items; }
  function latParseRows(html) {
    var s = String(html || "").slice(0, 700000), re = /<a\b[^>]*?href\s*=\s*["']?[^"'>\s]*index\.php\?file=(\d{1,7})[^>]*>([\s\S]*?)<\/a>/gi, m, ord = [], info = {};
    while ((m = re.exec(s)) && ord.length < 600) {
      var id = parseInt(m[1], 10); if (!id) continue;
      var t = m[2].replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
      if (!info[id]) { info[id] = { t: "", at: m.index, end: re.lastIndex }; ord.push(id); }
      if (t.length > info[id].t.length) info[id].t = t;
    }
    return ord.map(function (id, i) {
      var f = info[id], stop = i + 1 < ord.length ? info[ord[i + 1]].at : f.end + 1500;
      var dm = /(\d{1,3})\s*د(?![\u0621-\u064A])/.exec(s.slice(f.end, Math.max(f.end, Math.min(stop, f.end + 2000))));
      var t = f.t; if (t.length > 120) t = t.slice(0, 120).replace(/\s+\S*$/, "") + "…";
      var im = /<font[^>]*font-size:\s*8pt[^>]*>([^<]{0,80})<\/font>/i.exec(s.slice(f.end, Math.min(stop, f.end + 600)));
      var inf = im ? im[1].replace(/&nbsp;|&#160;/gi, " ").replace(/\s+/g, " ").trim() : "";
      var row = [id, t, dm ? parseInt(dm[1], 10) : 0]; if (inf && !/^\d/.test(inf)) row.push(inf.slice(0, 60));
      return dm && t ? row : null;
    }).filter(Boolean);
  }
  function latFetchAll(r, onProg) {
    var all = [], seen = {}, maxP = 1, c = r.c;
    function go(p) {
      if (p > maxP || p > 80) return Promise.resolve();
      onProg(p, maxP);
      return latHttpText(LAT_HOME + "index.php?catb=" + c + "&part=" + p).then(function (html) {
        var n = 0; latParseRows(html).forEach(function (x) { if (!seen[x[0]]) { seen[x[0]] = 1; all.push(x); n++; } });
        var re = new RegExp("catb=" + c + "(?:&amp;|&)part=(\\d+)", "g"), mm; while ((mm = re.exec(html))) maxP = Math.max(maxP, Math.min(80, parseInt(mm[1], 10)));
        if (!n) return;
        return new Promise(function (ok) { setTimeout(ok, 350); }).then(function () { return go(p + 1); });
      }, function (e) { if (p === 1) throw e; });
    }
    return go(1).then(function () { if (!all.length) throw new Error("no rows"); return all; });
  }
  function latName(it) { return it[1] || "لطمية"; }
  function renderLat(host) {
    host = host || viewEl;
    var q = el("input", "search"); q.type = "search"; q.placeholder = "ابحث عن رادود أو لطمية...";
    var box = el("div"); host.appendChild(q); host.appendChild(box);
    var st = { r: null, shown: 100 };
    function playIt(r, list, i, fresh) {
      var it = list[i], tok = ++latTok;
      audGet("lat", r.id, it[0]).then(function (bl) {
        if (bl) return URL.createObjectURL(bl);
        toast("جاري التحضير…");
        return latResolve(r, it);
      }).then(function (src) {
        if (tok !== latTok) return;
        playerLoad({
          src: src, fresh: !!fresh, rk: "l:" + r.id + ":" + it[0], title: latName(it) + " (" + it[2] + " د)", artist: r.n,
          next: function () { if (i + 1 < list.length) playIt(r, list, i + 1, true); },
          prev: function () { if (i > 0) playIt(r, list, i - 1, true); }
        });
        if (PL.a) PL.a.onerror = function () { toast("تعذّر تشغيل المقطع. قد يمنع الموقع التشغيل من التطبيق أو الإنترنت ضعيف."); };
      }, function () { if (tok === latTok) toast("تعذّر الوصول لرابط الصوت. تحقق من الإنترنت وجرّب مرة ثانية."); });
    }
    function drawR(r) {
      box.textContent = "";
      var allItems = latItems(r);
      var back = el("button", "chip", "← الرواديد"); back.onclick = function () { st.r = null; draw(); };
      var fe = el("button", "chip", "🔄 جلب كل لطمياته");
      fe.onclick = function () {
        if (!r.c) return;
        if (!confirm("جلب قائمة لطميات " + r.n + " من الموقع؟ قد يأخذ دقيقة.")) return;
        fe.disabled = true;
        latFetchAll(r, function (p, mx) { fe.textContent = "جاري الجلب " + p + "/" + mx; }).then(function (items) {
          latSave(r, items); toast("تم جلب " + items.length + " لطمية"); st.shown = 100; drawR(r);
        }, function () { toast("تعذّر الجلب من الموقع. تحقق من الإنترنت."); fe.disabled = false; fe.textContent = "🔄 جلب كل لطمياته"; });
      };
      var tr = el("div"); tr.style.cssText = "display:flex;gap:8px;flex-wrap:wrap"; tr.appendChild(back); tr.appendChild(fe); box.appendChild(tr);
      box.appendChild(el("div", "fsec", r.n + " (" + allItems.length + ")"));
      var t = norm(q.value.trim());
      var list = allItems.filter(function (it) { return !t || norm(latName(it)).indexOf(t) !== -1; });
      var wrap = el("div", "list");
      list.slice(0, st.shown).forEach(function (it, i) {
        var row = el("div", "hf-row");
        var pl = el("button", "chip hf-yes", "▶"); pl.onclick = function () { playIt(r, list, i, false); };
        var mid = el("div", "hf-mid"); mid.appendChild(el("div", "hf-t", latName(it) + (it[2] ? " (" + it[2] + " د)" : "") + (it[1] ? "" : " #" + it[0]) + (it[3] ? " · " + it[3] : "")));
        var bar = el("span", "dlbar"), fill = el("i"); bar.appendChild(fill); bar.hidden = true; mid.appendChild(bar);
        var dl = el("button", "chip", "⬇ تنزيل");
        function paint() { audGet("lat", r.id, it[0]).then(function (bl) {
          dl.textContent = bl ? "🗑 حذف التنزيل" : "⬇ تنزيل";
          dl.onclick = bl ? function () { idbDo("readwrite", function (s) { return s.delete(audKey("lat", r.id, it[0])); }).then(paint); } : download;
        }); }
        function download() {
          if (!confirm("تنزيل «" + latName(it) + "» (" + it[2] + " د)؟ يفضّل واي فاي.")) return;
          dl.disabled = true; dl.textContent = "…"; fill.style.width = "0%"; bar.hidden = false;
          var ctl = new AbortController(), stall = setTimeout(function () { ctl.abort(); }, 45000);
          function viaFetch(u) {
            return fetch(httpsOnly(u), { signal: ctl.signal }).then(function (rs) {
              if (!rs.ok) throw new Error("http " + rs.status);
              var total = parseInt(rs.headers.get("content-length") || "0", 10), got = 0, chunks = [];
              if (!rs.body || !rs.body.getReader) return rs.blob();
              var rd = rs.body.getReader();
              function pump() {
                return rd.read().then(function (x) {
                  clearTimeout(stall); stall = setTimeout(function () { ctl.abort(); }, 45000);
                  if (x.done) { if (total && got !== total) throw new Error("incomplete"); return new Blob(chunks, { type: "audio/mpeg" }); }
                  chunks.push(x.value); got += x.value.length;
                  if (total) { var p = Math.min(100, Math.round(100 * got / total)); fill.style.width = p + "%"; dl.textContent = p + "%"; }
                  else dl.textContent = (got / 1048576).toFixed(1) + " MB";
                  return pump();
                });
              }
              return pump();
            });
          }
          // إن منع الموقع التنزيل من داخل الصفحة (CORS) نستعمل طلب الجهاز المباشر؛ يحمّل الملف دفعة واحدة فنحدّه بالمقاطع المتوسطة
          function viaNative(u) {
            var H = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp;
            if (!H || !H.get || it[2] > 60) throw new Error("no native");
            dl.textContent = "…"; fill.style.width = "100%";
            return H.get({ url: httpsOnly(u), responseType: "blob", headers: { "Referer": LAT_HOME }, readTimeout: 120000, connectTimeout: 30000 }).then(function (rs) {
              if (!rs || rs.status < 200 || rs.status >= 300 || typeof rs.data !== "string" || rs.data.length < 1000) throw new Error("http " + (rs && rs.status));
              return new Blob([b64Blob(rs.data)], { type: "audio/mpeg" });
            });
          }
          latResolve(r, it).then(function (u) {
            if (it[2] <= 60) { var nh = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp; if (nh && nh.get) return viaNative(u).catch(function () { return viaFetch(u); }); }
            return viaFetch(u);
          }).then(function (bl) {
            return idbDo("readwrite", function (s) { return s.put(bl, audKey("lat", r.id, it[0])); });
          }).then(function () { toast("تم التنزيل"); }, function () { toast(it[2] > 60 ? "المقطع طويل (" + it[2] + " د) وما ينزّل بهالطريقة. يمكنك الاستماع مباشرة." : "تعذّر التنزيل. يمكنك الاستماع مباشرة."); })
            .then(function () { clearTimeout(stall); dl.disabled = false; bar.hidden = true; paint(); });
        }
        paint();
        [pl, mid, dl].forEach(function (x) { row.appendChild(x); }); wrap.appendChild(row);
      });
      if (!list.length) wrap.appendChild(el("div", "empty", "ما لقينا نتيجة"));
      box.appendChild(wrap);
      if (list.length > st.shown) {
        var more = el("button", "chip", "عرض المزيد (" + (list.length - st.shown) + " متبقي)");
        more.onclick = function () { st.shown += 100; drawR(r); };
        box.appendChild(more);
      }
    }
    function draw() {
      if (st.r) { drawR(st.r); return; }
      box.textContent = "";
      var t = norm(q.value.trim());
      var m = LAT.filter(function (r) { return !t || norm(r.n).indexOf(t) !== -1 || latItems(r).some(function (it) { return norm(latName(it)).indexOf(t) !== -1; }); });
      if (!m.length) { box.appendChild(el("div", "empty", "ما لقينا نتيجة")); return; }
      if (!t) {
        var tools = el("div"); tools.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin:0 0 10px";
        var ga = el("button", "chip", "🔄 جلب قوائم كل الرواديد");
        ga.onclick = function () {
          if (!confirm("جلب قوائم الرواديد كلها من الموقع؟ قد تأخذ عدة دقائق، ويفضّل واي فاي.")) return;
          ga.disabled = true; var i = 0, fail = 0;
          (function nxt() {
            if (i >= LAT.length) { toast("انتهى الجلب" + (fail ? " (فشل " + fail + ")" : "")); draw(); return; }
            var r = LAT[i++]; ga.textContent = "جاري الجلب " + i + "/" + LAT.length + " — " + r.n;
            if (!r.c) { nxt(); return; }
            latFetchAll(r, function () {}).then(function (items) { latSave(r, items); }, function () { fail++; }).then(function () { setTimeout(nxt, 400); });
          })();
        };
        var ex = el("button", "chip", "📤 تصدير القوائم");
        ex.onclick = function () {
          var o = {}; LAT.forEach(function (r) { var a = latStored(r); if (a) o[r.id] = a; });
          var text = JSON.stringify(o), P = window.Capacitor && window.Capacitor.Plugins || {};
          if (P.Filesystem && P.Share) {
            P.Filesystem.writeFile({ path: "lat-lists.json", data: text, directory: "CACHE", encoding: "utf8" })
              .then(function (rr) { return P.Share.share({ title: "قوائم اللطميات", files: [rr.uri], dialogTitle: "قوائم اللطميات" }); })
              .catch(function () { copyText(text); toast("تعذّر الحفظ كملف، تم نسخها كنص"); });
          } else { copyText(text); toast("تم نسخ القوائم"); }
        };
        tools.appendChild(ga); tools.appendChild(ex); box.appendChild(tools);
      }
      var list = el("div", "list");
      m.forEach(function (r) {
        var b = el("button", "row"); b.appendChild(el("span", null, r.n + " (" + latItems(r).length + ")")); b.appendChild(el("span", "chev", "‹"));
        b.onclick = function () { st.r = r; drawR(r); };
        list.appendChild(b);
      });
      box.appendChild(list);
    }
    q.addEventListener("input", function () { st.shown = 100; draw(); });
    draw();
  }

  /* ---------------- التقويم الهجري والمناسبات ---------------- */
  var HM = ["محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "شهر رمضان", "شوال", "ذو القعدة", "ذو الحجة"];
  var WD = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  var hfmt = null;
  function parseStarts(o) {
    var out = [];
    Object.keys(o || {}).forEach(function (k) {
      var m = /^(\d{4})-(\d{1,2})$/.exec(k), g = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(o[k]));
      if (m && g) out.push({ y: +m[1], m: +m[2], t: new Date(+g[1], +g[2] - 1, +g[3]).getTime() });
    });
    out.sort(function (a, b) { return a.t - b.t; });
    return out;
  }
  function hijriFromStarts(date) {
    if (!MS || !MS.length) return null;
    var t = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime(), best = null;
    MS.forEach(function (s) { if (s.t <= t) best = s; });
    if (!best) return null;
    var diff = Math.round((t - best.t) / 86400000);
    if (diff <= 29) return { year: best.y, month: best.m, day: diff + 1 };
    if (diff <= 59) {
      var m = best.m + 1, y = best.y; if (m > 12) { m = 1; y++; }
      return { year: y, month: m, day: diff - 29 };
    }
    return null;
  }
  function hAdj() { try { return parseInt(localStorage.getItem("hijriAdj") || "0", 10) || 0; } catch (e) { return 0; } }
  function hSet(n) { try { localStorage.setItem("hijriAdj", String(n)); } catch (e) {} }
  function hijriOf(date) {
    var fs = hijriFromStarts(new Date(date.getFullYear(), date.getMonth(), date.getDate() + hAdj())); if (fs) return fs;
    if (!hfmt) { try { hfmt = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "numeric", year: "numeric" }); } catch (e) { hfmt = null; } }
    if (!hfmt) return null;
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + hAdj(), 12), o = {};
    hfmt.formatToParts(d).forEach(function (p) { if (p.type === "day" || p.type === "month" || p.type === "year") o[p.type] = parseInt(p.value, 10); });
    return o;
  }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function occOn(m, d) { return OCC.filter(function (o) { return o.m === m && o.d === d; }); }
  function firstOfMonth(today, h) { return addDays(today, -(h.day - 1)); }
  function nextMonthStart(first) {
    for (var n = 28; n <= 31; n++) { var x = addDays(first, n), hx = hijriOf(x); if (hx && hx.day === 1) return x; }
    return addDays(first, 30);
  }
  function prevMonthStart(first) {
    for (var n = 28; n <= 31; n++) { var x = addDays(first, -n), hx = hijriOf(x); if (hx && hx.day === 1) return x; }
    return addDays(first, -30);
  }
  function upcoming(today, days) {
    var out = [];
    for (var i = 0; i <= days; i++) {
      var dt = addDays(today, i), h = hijriOf(dt); if (!h) break;
      occOn(h.month, h.day).forEach(function (o) { out.push({ dt: dt, h: h, o: o, left: i }); });
    }
    return out;
  }
  function renderCal() {
    titleEl.textContent = "📅 التقويم والمناسبات";
    var today = new Date(), th = hijriOf(today);
    if (!th) { viewEl.appendChild(el("div", "empty", "هذا الجهاز لا يدعم التقويم الهجري.")); return; }
    var head = el("div", "cal-head");
    head.appendChild(el("div", "cal-d", WD[today.getDay()] + " " + th.day + " " + HM[th.month - 1] + " " + th.year + "هـ"));
    head.appendChild(el("div", "cal-g", today.toLocaleDateString("ar-IQ", { day: "numeric", month: "long", year: "numeric" })));
    var te = occOn(th.month, th.day);
    te.forEach(function (o) { head.appendChild(el("div", "cal-today " + o.k, "اليوم: " + o.t)); });
    viewEl.appendChild(head);

    var cur = firstOfMonth(today, th);
    var adjRow = el("div", "cal-adj");
    adjRow.appendChild(el("span", null, "ضبط اليوم الهجري (حسب رؤية الهلال):"));
    var mi = el("button", "chip", "−1"), pl = el("button", "chip", "+1"), val = el("span", "cal-av", (hAdj() > 0 ? "+" : "") + hAdj());
    mi.onclick = function () { hSet(hAdj() - 1); render(); };
    pl.onclick = function () { hSet(hAdj() + 1); render(); };
    adjRow.appendChild(mi); adjRow.appendChild(val); adjRow.appendChild(pl);
    viewEl.appendChild(adjRow);

    var gridBox = el("div", "cal-box"), detail = el("div", "cal-detail");
    viewEl.appendChild(gridBox); viewEl.appendChild(detail);
    function drawMonth() {
      gridBox.textContent = "";
      var h1 = hijriOf(cur);
      var nav = el("div", "cal-nav");
      var pv = el("button", "chip", "›"), nx = el("button", "chip", "‹");
      pv.onclick = function () { cur = prevMonthStart(cur); drawMonth(); detail.textContent = ""; };
      nx.onclick = function () { cur = nextMonthStart(cur); drawMonth(); detail.textContent = ""; };
      nav.appendChild(pv); nav.appendChild(el("div", "cal-mt", HM[h1.month - 1] + " " + h1.year + "هـ")); nav.appendChild(nx);
      gridBox.appendChild(nav);
      var g = el("div", "cal-grid");
      WD.forEach(function (w) { g.appendChild(el("div", "cal-w", w.slice(0, 3))); });
      for (var i = 0; i < cur.getDay(); i++) g.appendChild(el("div", "cal-c empty"));
      var n = nextMonthStart(cur), len = Math.round((n - cur) / 86400000);
      for (var d = 1; d <= len; d++) (function (d) {
        var dt = addDays(cur, d - 1), oc = occOn(h1.month, d);
        var isT = dt.toDateString() === today.toDateString();
        var c = el("button", "cal-c" + (isT ? " today" : "") + (oc.length ? " has " + oc[0].k : ""));
        c.appendChild(el("b", null, String(d)));
        c.appendChild(el("small", null, String(dt.getDate())));
        c.onclick = function () {
          detail.textContent = "";
          detail.appendChild(el("div", "fsec", d + " " + HM[h1.month - 1] + " " + h1.year + "هـ — " + dt.toLocaleDateString("ar-IQ", { day: "numeric", month: "long" })));
          if (!oc.length) detail.appendChild(el("div", "favempty", "لا توجد مناسبة مسجّلة لهذا اليوم."));
          oc.forEach(function (o) { detail.appendChild(el("div", "cal-ev " + o.k, o.t)); });
        };
        g.appendChild(c);
      })(d);
      gridBox.appendChild(g);
    }
    drawMonth();
    var up = upcoming(today, 45);
    viewEl.appendChild(el("div", "fsec", "⏳ المناسبات القادمة (45 يوماً)"));
    if (!up.length) viewEl.appendChild(el("div", "favempty", "لا توجد مناسبات قريبة."));
    up.forEach(function (u) {
      var r = el("div", "cal-up " + u.o.k);
      r.appendChild(el("div", "cal-ut", u.o.t));
      r.appendChild(el("div", "cal-us", u.h.day + " " + HM[u.h.month - 1] + " — " + (u.left === 0 ? "اليوم" : u.left === 1 ? "غداً" : "بعد " + u.left + " يوماً")));
      viewEl.appendChild(r);
    });
    viewEl.appendChild(el("div", "ainote", (DATA.occasions_note || "") + " اليوم الهجري محسوب بالتقويم الفلكي، فاضبطه بـ(−1/+1) ليوافق رؤية الهلال عندكم."));
  }

  /* ---------------- المسبحة ---------------- */
  var TSB = [
    { n: "تسبيح الزهراء (ع)", seq: [["الله أكبر", 34], ["الحمد لله", 33], ["سبحان الله", 33]] },
    { n: "سبحان الله", seq: [["سبحان الله", 100]] },
    { n: "الحمد لله", seq: [["الحمد لله", 100]] },
    { n: "الله أكبر", seq: [["الله أكبر", 100]] },
    { n: "لا إله إلا الله", seq: [["لا إله إلا الله", 100]] },
    { n: "أستغفر الله", seq: [["أستغفر الله", 100]] },
    { n: "اللهم صلِّ على محمد وآل محمد", seq: [["اللهم صلِّ على محمد وآل محمد", 100]] },
    { n: "حرّة (بدون هدف)", seq: [["", 0]] }
  ];
  function tsGet() {
    try { var o = JSON.parse(localStorage.getItem("tasbih") || "null"); if (o && typeof o.c === "number") return o; } catch (e) {}
    return { m: 0, st: 0, c: 0, tot: 0 };
  }
  function tsSet(o) { try { localStorage.setItem("tasbih", JSON.stringify(o)); } catch (e) {} }
  function tsCustom() {
    try {
      var c = JSON.parse(localStorage.getItem("tscustom") || "[]");
      return Array.isArray(c) ? c.filter(function (x) { return x && typeof x.n === "string" && x.n && typeof x.g === "number"; }).slice(0, 30) : [];
    } catch (e) { return []; }
  }
  function tsAll() {
    return TSB.concat(tsCustom().map(function (x) { return { n: x.n, seq: [[x.n, x.g]], custom: true }; }));
  }
  function renderTasbih() {
    titleEl.textContent = "المسبحة";
    var ALL = tsAll();
    var S = tsGet();
    if (!ALL[S.m] || !ALL[S.m].seq[S.st]) { S = { m: 0, st: 0, c: 0, tot: S.tot || 0 }; }
    var box = el("div", "tsb2");

    var card = el("div", "tcard");
    var cn = el("div", "tcn");
    var big = el("span", "tbig", "0"), of = el("span", "tof", "");
    cn.appendChild(of); cn.appendChild(big);
    var name = el("div", "tname2", "");
    card.appendChild(cn); card.appendChild(name);
    box.appendChild(card);
    var tot = el("div", "tgoal", "");
    box.appendChild(tot);

    var mid = el("div", "tmid");
    var snd = el("button", "tsmall", "");
    var cnt = el("button", "tbtn2");
    cnt.innerHTML = '<svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10l5.2 1.2a2 2 0 0 1 1.5 2.300L18 18a3 3 0 0 1-3 2.500h-3.300a3 3 0 0 1-2.400-1.200L6 15.500a1.500 1.500 0 0 1 2.400-1.800L9 14.300"/></svg><span>اضغط هنا</span>';
    var rs = el("button", "tsmall", "↺");
    rs.setAttribute("aria-label", "تصفير");
    snd.setAttribute("aria-label", "الاهتزاز");
    mid.appendChild(snd); mid.appendChild(cnt); mid.appendChild(rs);
    box.appendChild(mid);

    var chips = el("div", "tchips");
    var addb = el("button", "tchip tplus", "+");
    chips.appendChild(addb);
    box.appendChild(chips);
    var form = el("div", "tform"); form.hidden = true;
    var fn = el("input", "search"); fn.type = "text"; fn.maxLength = 60; fn.placeholder = "اسم الذكر";
    var fg = el("input", "search"); fg.type = "number"; fg.min = 1; fg.max = 100000; fg.placeholder = "العدد المطلوب (اختياري)";
    var fs = el("button", "chip on", "✓ إضافة");
    form.appendChild(fn); form.appendChild(fg); form.appendChild(fs);
    box.appendChild(form);
    viewEl.appendChild(box);

    var vibOn = true;
    try { vibOn = localStorage.getItem("tsvib") !== "0"; } catch (e) {}
    function buzz(ms) { if (vibOn && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} } }
    function drawChips() {
      Array.prototype.slice.call(chips.querySelectorAll(".tchip:not(.tplus)")).forEach(function (n) { n.remove(); });
      ALL.forEach(function (t, i) {
        var c = el("button", "tchip" + (i === S.m ? " on" : ""), t.n);
        c.onclick = function () { S.m = i; S.st = 0; S.c = 0; drawChips(); paint(); };
        if (t.custom) {
          var x = el("span", "tx", "×");
          x.onclick = function (ev) {
            ev.stopPropagation();
            if (!window.confirm("حذف «" + t.n + "»؟")) return;
            var cu = tsCustom(); cu.splice(i - TSB.length, 1);
            try { localStorage.setItem("tscustom", JSON.stringify(cu)); } catch (e) {}
            if (S.m === i) { S.m = 0; S.st = 0; S.c = 0; }
            else if (S.m > i) S.m--;
            ALL = tsAll(); drawChips(); paint();
          };
          c.appendChild(x);
        }
        chips.insertBefore(c, addb);
      });
    }
    function paint() {
      var t = ALL[S.m], q = t.seq[S.st];
      name.textContent = q[0] || (t.n);
      big.textContent = S.c;
      of.textContent = q[1] ? "/ " + q[1] : "";
      var p = q[1] ? Math.min(100, Math.round(100 * S.c / q[1])) : 0;
      cnt.style.setProperty("--p", p + "%");
      tot.textContent = (t.seq.length > 1 ? "المرحلة " + (S.st + 1) + " من " + t.seq.length + " — " : "") + "المجموع الكلي: " + S.tot;
      snd.textContent = vibOn ? "📳" : "🔇";
      tsSet(S);
    }
    cnt.onclick = function () {
      var q = ALL[S.m].seq[S.st];
      S.c++; S.tot++;
      if (q[1] && S.c >= q[1]) {
        buzz([120, 60, 120]);
        if (S.st < ALL[S.m].seq.length - 1) { S.st++; S.c = 0; toast("المرحلة التالية: " + ALL[S.m].seq[S.st][0]); }
        else { toast("اكتمل التسبيح ✓"); S.c = 0; S.st = 0; }
      } else buzz(15);
      paint();
    };
    rs.onclick = function () { S.c = 0; S.st = 0; paint(); };
    snd.onclick = function () { vibOn = !vibOn; try { localStorage.setItem("tsvib", vibOn ? "1" : "0"); } catch (e) {} paint(); };
    addb.onclick = function () { form.hidden = !form.hidden; if (!form.hidden) fn.focus(); };
    fs.onclick = function () {
      var n = fn.value.trim(), g = Math.floor(+fg.value || 0);
      if (!n) { toast("اكتب اسم الذكر"); return; }
      if (g < 0 || g > 100000) { toast("العدد غير صالح"); return; }
      var cu = tsCustom(); cu.push({ n: n, g: g });
      try { localStorage.setItem("tscustom", JSON.stringify(cu)); } catch (e) {}
      ALL = tsAll(); S.m = ALL.length - 1; S.st = 0; S.c = 0;
      fn.value = ""; fg.value = ""; form.hidden = true;
      drawChips(); paint();
    };
    drawChips(); paint();
  }

  /* ---------------- الرئيسية ---------------- */
  function renderMine() {
    titleEl.textContent = "✍️ أذكاري";
    var m = getMine().sort(function (x, y) { return (y.t || 0) - (x.t || 0); });
    var add = el("button", "chip on", "＋ إضافة دعاء / ذكر");
    add.onclick = function () { go({ type: "mineEdit" }); };
    var tl = el("div", "reader-tools"); tl.appendChild(add); viewEl.appendChild(tl);
    if (!m.length) {
      var em = el("div", "favempty");
      em.appendChild(el("div", "fe-i", "✍️"));
      em.appendChild(el("div", "fe-t", "لا توجد أذكار محفوظة بعد"));
      em.appendChild(el("div", "fe-s", "احفظ أدعيتك وأذكارك هنا لتجدها بسهولة في أي وقت."));
      viewEl.appendChild(em);
      return;
    }
    var list = el("div", "list");
    m.forEach(function (x) { list.appendChild(itemRow("my:" + x.id)); });
    viewEl.appendChild(list);
  }

  function renderMineEdit(v) {
    var cur = v.id ? getMine().filter(function (x) { return x.id === v.id; })[0] : null;
    titleEl.textContent = cur ? "تعديل" : "إضافة دعاء / ذكر";
    viewEl.appendChild(el("div", "flab", "العنوان"));
    var ti = el("input", "search"); ti.type = "text"; ti.maxLength = 120;
    ti.placeholder = "عنوان الدعاء"; ti.value = cur ? cur.title : "";
    viewEl.appendChild(ti);
    viewEl.appendChild(el("div", "flab", "النص"));
    var tx = el("textarea", "bk-ta"); tx.style.minHeight = "280px";
    tx.placeholder = "اكتب نص الدعاء أو الذكر هنا..."; tx.value = cur ? cur.text : "";
    viewEl.appendChild(tx);
    var sv = el("button", "chip on", "✓ حفظ");
    sv.onclick = function () {
      var t = ti.value.trim(), body = tx.value.replace(/\s+$/, "");
      if (!t) { toast("اكتب عنواناً"); return; }
      if (!body.trim()) { toast("اكتب النص"); return; }
      if (body.length > MINE_MAX) { toast("النص طويل جداً (الحد " + MINE_MAX + " حرف)"); return; }
      var m = getMine();
      if (cur) {
        m.forEach(function (x) { if (x.id === cur.id) { x.title = t; x.text = body; x.t = Date.now(); } });
      } else {
        m.push({ id: Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36), title: t, text: body, t: Date.now() });
      }
      setMine(m); syncMine(); buildIndex();
      toast("تم الحفظ");
      stack.pop(); render(); window.scrollTo(0, 0);
    };
    var wrap = el("div", "reader-tools"); wrap.appendChild(sv); viewEl.appendChild(wrap);
  }

  function renderHome() {
    titleEl.textContent = "أدعية وزيارات";
    var hh = new Date().getHours();
    var gr = hh < 5 ? "ليلة مباركة" : hh < 12 ? "صباح الخير" : hh < 17 ? "نهارك سعيد" : hh < 20 ? "مساء الخير" : "ليلة مباركة";
    viewEl.appendChild(el("div", "bigh", gr));
    viewEl.appendChild(el("div", "bigs", "تقبّل الله أعمالكم"));
    var search = el("input", "search");
    search.type = "search";
    search.placeholder = "ابحث: كميل، عاشوراء، الثقلين...";
    search.value = query;
    search.setAttribute("enterkeyhint", "search");
    viewEl.appendChild(search);

    var box = el("div");
    viewEl.appendChild(box);

    function draw() {
      box.textContent = "";
      var q = norm(query.trim());
      if (q) {
        var keys = Object.keys(ITEMS).filter(function (k) { return has(INDEX[k], q); });
        var bh = BINDEX.filter(function (x) { return has(x.n, q); }).slice(0, 30);
        var bks = BOOKS.filter(function (b) {
          return has(norm(b.title + " " + (b.author || "") + " " + (b.desc || "")), q) ||
            (b.volumes || []).some(function (v) { return has(norm(v.title || ""), q); });
        }).slice(0, 12);
        if (!keys.length && !bh.length && !bks.length) { box.appendChild(el("div", "empty", "ما لقينا نتيجة")); return; }
        if (bks.length) {
          box.appendChild(el("div", "sec", "الكتب"));
          var bl = el("div", "list");
          bks.forEach(function (b) { bl.appendChild(bookRow(b, function () {})); });
          box.appendChild(bl);
          if (keys.length || bh.length) box.appendChild(el("div", "sec", "الأدعية والنصوص"));
        }
        var list = el("div", "list");
        keys.forEach(function (k) { list.appendChild(itemRow(k)); });
        bh.forEach(function (x) {
          var b = el("button", "row");
          b.appendChild(el("span", null, "📚 " + x.book + " — " + x.title));
          b.appendChild(el("span", "chev", "‹"));
          b.onclick = function () { go({ type: "book", id: x.id, jump: x.i }); };
          list.appendChild(b);
        });
        box.appendChild(list);
        return;
      }
      var last = lastRead();
      var li = getLastItem();
      var rcards = [];
      if (last) {
        var rb = el("button", "resume");
        rb.appendChild(el("span", "rt", "📖 تابع القراءة"));
        rb.appendChild(el("span", "rn", last.book.title));
        rb.appendChild(el("span", "rp", last.chTitle + (last.pct ? " — \u2066" + last.pct + "%\u2069" : "")));
        rb.onclick = function () { openBook(last.book.id); };
        rcards.push({ t: last.t || 0, n: rb });
      }
      if (li) {
        var ib = el("button", "resume");
        var ipct = (li.pct > 0 && li.pct < 98) ? li.pct : 0;
        ib.appendChild(el("span", "rt", "📖 تابع القراءة"));
        ib.appendChild(el("span", "rn", ITEMS[li.k].title));
        ib.appendChild(el("span", "rp", ipct ? "\u2066" + ipct + "%\u2069" : (isRead(li.k) ? "✓ قرأتها" : "اضغط للمتابعة")));
        ib.onclick = function () { go({ type: "item", key: li.k, restore: ipct }); };
        rcards.push({ t: li.t, n: ib });
      }
      rcards.sort(function (a, b) { return b.t - a.t; }).forEach(function (c) { box.appendChild(c.n); });
      var mc = el("button", "resume");
      mc.appendChild(el("span", "rt", "✍️ أذكاري"));
      mc.appendChild(el("span", "rn", getMine().length ? getMine().length + " محفوظ" : "أضف أدعيتك وأذكارك"));
      mc.appendChild(el("span", "rp", "نصوص تكتبها بنفسك وتقرأها بأي وقت"));
      mc.onclick = function () { go({ type: "mine" }); };
      box.appendChild(mc);
      var hcat = CATS.filter(function (c) { return c.id === "c7"; })[0];
      var hks = hcat ? hcat.keys.filter(function (k) { return ITEMS[k]; }) : [];
      if (hks.length) {
        var hk = hks[Math.floor(Date.now() / 86400000) % hks.length], hi = ITEMS[hk];
        var hw = el("div", "hday");
        hw.appendChild(el("div", "hd-h", "🌿 حديث اليوم"));
        var hbody = el("button", "hd-b");
        hbody.appendChild(el("div", "hd-t", hi.title));
        var htx = hi.text.length > 170 ? hi.text.slice(0, 170).replace(/\s+\S*$/, "") + "…" : hi.text;
        hbody.appendChild(el("div", "hd-x", htx));
        if (hi.source) hbody.appendChild(el("div", "hd-s", hi.source));
        hbody.onclick = function () { go({ type: "item", key: hk }); };
        var hfull = hi.title + "\n\n" + hi.text + (hi.source ? "\n\nالمصدر: " + hi.source : "");
        var hrow = el("div", "hd-r");
        var hc = el("button", "chip", "نسخ"), hs = el("button", "chip", "مشاركة");
        hc.onclick = function () { copyText(hfull); };
        hs.onclick = function () {
          if (navigator.share) navigator.share({ title: hi.title, text: hfull }).catch(function () {});
          else copyText(hfull);
        };
        hrow.appendChild(hc); hrow.appendChild(hs);
        hw.appendChild(hbody); hw.appendChild(hrow);
        box.appendChild(hw);
      }
      var dks = Object.keys(ITEMS);
      if (dks.length && !last && !li) {
        var dn = Math.floor(Date.now() / 86400000);
        var dk = dks[dn % dks.length];
        var dc = el("button", "resume daily");
        dc.appendChild(el("span", "rt", "✨ من أدعيتنا اليوم"));
        dc.appendChild(el("span", "rn", ITEMS[dk].title));
        dc.appendChild(el("span", "rp", "اضغط للقراءة"));
        dc.onclick = function () { go({ type: "item", key: dk }); };
        box.appendChild(dc);
      }
      box.appendChild(el("div", "sec", "الأقسام"));
      var grid = el("div", "shelf");
      var tools = el("div", "shelf");
      CATS.forEach(function (c) {
        if (c.parent) return;
        var b = el("button", "cat");
        b.appendChild(el("span", "ic", c.icon));
        b.appendChild(el("span", "nm", c.name));
        b.appendChild(el("span", "ct", (c.keys.length + CATS.reduce(function (n, x) { return n + (x.parent === c.id ? x.keys.length : 0); }, 0)) + " عنوان"));
        b.onclick = function () { go({ type: "cat", id: c.id }); };
        grid.appendChild(b);
      });
      var tb = el("button", "cat sm");
      tb.appendChild(el("span", "ic", "📿"));
      tb.appendChild(el("span", "nm", "المسبحة"));
      tb.appendChild(el("span", "ct", "عدّاد التسبيح"));
      tb.onclick = function () { go({ type: "tasbih" }); };
      tools.appendChild(tb);
      if (BOOKS.length) {
        var lb = el("button", "cat wide");
        lb.appendChild(el("span", "ic", "📚"));
        lb.appendChild(el("span", "nm", "المكتبة"));
        lb.appendChild(el("span", "ct", BOOKS.length + " كتاب"));
        lb.onclick = function () { go({ type: "lib" }); };
      }
      var hb = el("button", "cat sm");
      hb.appendChild(el("span", "ic", "🕋"));
      hb.appendChild(el("span", "nm", "حفظ القرآن"));
      hb.appendChild(el("span", "ct", "جدولك الخاص"));
      hb.onclick = function () { go({ type: "hifz" }); };
      tools.appendChild(hb);
      var cb = el("button", "cat sm");
      cb.appendChild(el("span", "ic", "📅"));
      cb.appendChild(el("span", "nm", "التقويم والمناسبات"));
      cb.appendChild(el("span", "ct", "هجري"));
      cb.onclick = function () { go({ type: "cal" }); };
      tools.appendChild(cb);
      var ab = el("button", "cat wide");
      ab.appendChild(el("span", "ic", "🎧"));
      ab.appendChild(el("span", "nm", "الاستماع"));
      ab.appendChild(el("span", "ct", "قرآن ولطميات"));
      ab.onclick = function () { go({ type: "listen" }); };
      var fb = el("button", "cat wide fav");
      fb.appendChild(el("span", "ic", "⭐"));
      fb.appendChild(el("span", "nm", "المفضلة"));
      fb.appendChild(el("span", "ct", favCount() ? favCount() + " عنصر" : "كتبك وأدعيتك المحفوظة"));
      fb.onclick = function () { go({ type: "favs" }); };
      box.appendChild(grid);
      box.appendChild(el("div", "sec", "أدوات"));
      box.appendChild(tools);
    }
    search.addEventListener("input", function () { query = search.value; draw(); });
    draw();
  }

  function itemRow(k) {
    var b = el("button", "row irow");
    var rdn = isRead(k);
    b.appendChild(el("span", "ibadge" + (rdn ? " done" : ""), rdn ? "✓" : "❖"));
    b.appendChild(el("span", "it", ITEMS[k].title));
    b.appendChild(el("span", "chev", "‹"));
    b.onclick = function () { go({ type: "item", key: k }); };
    return b;
  }

  function renderCat(v) {
    var c = CATS.filter(function (x) { return x.id === v.id; })[0];
    titleEl.textContent = c.icon + " " + c.name;
    var hd = el("div", "cathead");
    hd.appendChild(el("span", "chi", c.icon));
    hd.appendChild(el("span", "chn", c.name));
    hd.appendChild(el("span", "chc", c.keys.length + " عنوان"));
    viewEl.appendChild(hd);
    var list = el("div", "list");
    CATS.filter(function (x) { return x.parent === c.id; }).forEach(function (sc) {
      var b = el("button", "row book");
      var bx = el("span", "bk");
      bx.appendChild(el("span", "bt", sc.icon + " " + sc.name));
      bx.appendChild(el("span", "ba", sc.keys.length + " عنوان"));
      b.appendChild(bx);
      b.appendChild(el("span", "chev", "‹"));
      b.onclick = function () { go({ type: "cat", id: sc.id }); };
      list.appendChild(b);
    });
    c.keys.forEach(function (k) { list.appendChild(itemRow(k)); });
    viewEl.appendChild(list);
  }

  /* ---------------- القراءة ---------------- */
  /* ---------------- بطاقة صورة للمشاركة ---------------- */
  function makeCard(title, text, source) {
    var W = 1080, P = 90, FS = 44, LH = 82, max = 760;
    text = text.replace(/\s+/g, " ").trim();
    if (text.length > max) {
      var cut = text.lastIndexOf(" ", max);
      text = text.slice(0, cut > 300 ? cut : max) + " ...";
    }
    var FONT = '"Noto Naskh Arabic","Traditional Arabic","Amiri",serif';
    var c = document.createElement("canvas"), x = c.getContext("2d");
    function wrap(str, size, weight) {
      x.font = weight + " " + size + "px " + FONT;
      var words = str.split(" "), lines = [], cur = "";
      words.forEach(function (w) {
        var t = cur ? cur + " " + w : w;
        if (x.measureText(t).width > W - 2 * P && cur) { lines.push(cur); cur = w; } else cur = t;
      });
      if (cur) lines.push(cur);
      return lines;
    }
    var tl = wrap(title, 54, "bold"), bl = wrap(text, FS, "normal");
    var sl = source ? wrap("المصدر: " + source, 30, "normal") : [];
    var H = 140 + tl.length * 90 + 70 + bl.length * LH + (sl.length ? 70 + sl.length * 50 : 0) + 190;
    c.width = W; c.height = Math.max(H, 900);
    var g = x.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0, "#0f3d2e"); g.addColorStop(1, "#0b2a20");
    x.fillStyle = g; x.fillRect(0, 0, W, c.height);
    x.strokeStyle = "#d9b86a"; x.lineWidth = 4; x.strokeRect(34, 34, W - 68, c.height - 68);
    x.strokeStyle = "rgba(217,184,106,.45)"; x.lineWidth = 2; x.strokeRect(50, 50, W - 100, c.height - 100);
    x.direction = "rtl"; x.textAlign = "center"; x.textBaseline = "alphabetic";
    var y = 170;
    x.fillStyle = "#f3d98b"; x.font = "bold 54px " + FONT;
    tl.forEach(function (l) { x.fillText(l, W / 2, y); y += 90; });
    y += 10; x.fillStyle = "#d9b86a"; x.fillRect(W / 2 - 80, y, 160, 4); y += 70;
    x.fillStyle = "#ffffff"; x.font = FS + "px " + FONT; x.textAlign = "right";
    bl.forEach(function (l) { x.fillText(l, W - P, y); y += LH; });
    if (sl.length) {
      y += 30; x.fillStyle = "#b9c9bf"; x.font = "30px " + FONT; x.textAlign = "center";
      sl.forEach(function (l) { x.fillText(l, W / 2, y); y += 50; });
    }
    x.fillStyle = "#d9b86a"; x.font = "28px " + FONT; x.textAlign = "center";
    x.fillText("تطبيق أدعية وزيارات", W / 2, c.height - 95);
    return c;
  }

  function shareCard(title, text, source) {
    var c = makeCard(title, text, source);
    c.toBlob(function (blob) {
      if (!blob) { toast("تعذّر إنشاء الصورة"); return; }
      var P = window.Capacitor && window.Capacitor.Plugins || {};
      var fname = "dua-card-" + Date.now() + ".png";
      if (P.Filesystem && P.Share) {
        var fr = new FileReader();
        fr.onload = function () {
          var b64 = String(fr.result).split(",")[1];
          P.Filesystem.writeFile({ path: fname, data: b64, directory: "CACHE" })
            .then(function (r) { return P.Share.share({ title: title, files: [r.uri], dialogTitle: "مشاركة البطاقة" }); })
            .catch(function (e) { if (!e || !/cancel/i.test(String(e.message || e))) toast("تعذّرت المشاركة"); });
        };
        fr.readAsDataURL(blob);
        return;
      }
      var file; try { file = new File([blob], fname, { type: "image/png" }); } catch (e) {}
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: title }).catch(function () {});
        return;
      }
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = fname;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      toast("تم حفظ الصورة");
    }, "image/png");
  }

  function renderItem(v) {
    var it = ITEMS[v.key];
    titleEl.textContent = it.title;

    var tools = el("div", "reader-tools");
    var plus = el("button", "chip", "A+");
    var minus = el("button", "chip", "A−");
    plus.onclick = function () { cfg.fs = Math.min(40, cfg.fs + 2); applyFont(); saveCfg(); };
    minus.onclick = function () { cfg.fs = Math.max(16, cfg.fs - 2); applyFont(); saveCfg(); };
    var cp = el("button", "chip", "نسخ");
    var full = it.title + "\n\n" + it.text + (it.source ? "\n\nالمصدر: " + it.source : "");
    cp.onclick = function () { copyText(full); };
    var sh = el("button", "chip", "مشاركة");
    sh.onclick = function () {
      if (navigator.share) navigator.share({ title: it.title, text: full }).catch(function () {});
      else copyText(full);
    };
    var im = el("button", "chip on", "🖼 بطاقة صورة");
    im.onclick = function () {
      var sel = "";
      try { sel = String(window.getSelection() || "").trim(); } catch (e) {}
      shareCard(it.title, sel || it.text, it.source);
    };
    var rdb = el("button", "chip" + (isRead(v.key) ? " on" : ""), isRead(v.key) ? "✓ قرأتها" : "قرأتها");
    rdb.onclick = function () {
      var on = toggleRead(v.key);
      rdb.className = "chip" + (on ? " on" : "");
      rdb.textContent = on ? "✓ قرأتها" : "قرأتها";
      toast(on ? "تم تسجيلها ضمن ما قرأت" : "أُلغي التسجيل");
    };
    [plus, minus, rdb, cp, sh, im, favChip("items", v.key)].forEach(function (b) { tools.appendChild(b); });
    setLastItem(v.key, v.restore || 0);
    if (v.restore) {
      setTimeout(function () {
        var hh2 = document.documentElement.scrollHeight - window.innerHeight;
        if (hh2 > 0) window.scrollTo(0, hh2 * v.restore / 100);
      }, 90);
    }
    if (it.mine) {
      var eb = el("button", "chip", "✎ تعديل");
      eb.onclick = function () { go({ type: "mineEdit", id: v.key.slice(3) }); };
      var db = el("button", "chip", "🗑 حذف");
      db.onclick = function () {
        if (!window.confirm("حذف «" + it.title + "» نهائياً؟")) return;
        var id = v.key.slice(3);
        setMine(getMine().filter(function (x) { return x.id !== id; }));
        syncMine(); buildIndex();
        toast("تم الحذف");
        stack.pop(); render();
      };
      tools.appendChild(eb); tools.appendChild(db);
    }
    viewEl.appendChild(tools);

    if (it.audio && it.audio.length) {
      var ar = el("div", "reader-tools");
      it.audio.forEach(function (au) {
        var ab = el("button", "chip on", "🎧 استماع" + (au.by ? " — " + au.by : ""));
        ab.onclick = function () {
          playerLoad({ src: (au.u ? trustedUrl(au.u) : (BASE + String(au.f || "").replace(/^[\/.]+/, ""))), rk: "d:" + String(it.id || it.title) + ":" + String(au.u || au.f || au.by || "").slice(0, 120), title: it.title, artist: au.by || "تسجيل صوتي" });
          var a = PL.a, tried = 0, url = a.src;
          a.onerror = function () {
            var code = a.error ? a.error.code : "?";
            if (tried === 0) {
              tried = 1;
              fetch(url).then(function (r) {
                if (!r.ok) throw new Error("HTTP " + r.status);
                return r.blob();
              }).then(function (b) {
                a.src = URL.createObjectURL(new Blob([b], { type: "audio/mpeg" }));
                var p = a.play(); if (p && p.catch) p.catch(function () {});
              }).catch(function (e) {
                toast("خطأ صوت " + code + " | " + (e && e.message ? e.message : e) + " | " + url.split("/").pop());
              });
            } else {
              toast("خطأ صوت " + code + " | " + url.split("/").pop());
            }
          };
        };
        ar.appendChild(ab);
      });
      viewEl.appendChild(ar);
    }

    var paper = el("article", "paper");
    paper.appendChild(el("h2", null, it.title));
    paper.appendChild(el("div", "text", it.text));
    if (it.source) paper.appendChild(el("div", "source", "📚 المصدر: " + it.source));
    viewEl.appendChild(paper);
  }

  // حفظ موضع القراءة داخل الدعاء/الزيارة (لبطاقة "تابع القراءة")
  var itemScrollT = 0;
  window.addEventListener("scroll", function () {
    var top = stack[stack.length - 1];
    if (!top || top.type !== "item") return;
    clearTimeout(itemScrollT);
    itemScrollT = setTimeout(function () {
      if (stack[stack.length - 1] !== top) return;
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var p = h > 0 ? Math.round(window.scrollY / h * 100) : 0;
      setLastItem(top.key, Math.max(0, Math.min(100, p)));
    }, 400);
  }, { passive: true });


  /* ---------------- المكتبة ---------------- */
  function getPos(id) {
    try { return JSON.parse(localStorage.getItem("pos:" + id) || "null"); } catch (e) { return null; }
  }
  function setPos(id, p) {
    try { localStorage.setItem("pos:" + id, JSON.stringify(p)); } catch (e) {}
  }
  function getBm(id) {
    try { var a = JSON.parse(localStorage.getItem("bm:" + id) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function setBm(id, a) {
    try { localStorage.setItem("bm:" + id, JSON.stringify(a)); } catch (e) {}
  }
  function findBook(id) { return BOOKS.filter(function (b) { return b.id === id; })[0]; }

  // آخر كتاب مقروء (لبطاقة "تابع القراءة")
  function lastRead() {
    var best = null;
    BOOKS.forEach(function (b) {
      var p = getPos(b.id);
      if (p && p.t && (!best || p.t > best.p.t)) best = { book: b, p: p };
    });
    if (!best) return null;
    if (best.book.kind === "scan") {
      var vv = (best.book.volumes || []).filter(function (x) { return x.id === best.p.vol; })[0];
      if (!vv) return null;
      return { book: best.book, chTitle: vv.title + " – صفحة " + i2p(vv, best.p.ch || 0), pct: best.p.pct || 0, t: best.p.t };
    }
    var i = Math.min(best.p.ch || 0, best.book.chapters.length - 1);
    return { book: best.book, chTitle: best.book.chapters[i].title, pct: best.p.pct || 0, t: best.p.t };
  }

  /* ---------------- تثبيت الكتب ---------------- */
  var MAXPIN = 5;
  function getPins() {
    try { var a = JSON.parse(localStorage.getItem("pins") || "[]"); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function togglePin(id) {
    var p = getPins(), i = p.indexOf(id);
    if (i >= 0) p.splice(i, 1);
    else {
      if (p.length >= MAXPIN) { alert("الحد الأقصى " + MAXPIN + " كتب مثبّتة. أزل تثبيت كتاب أولاً."); return false; }
      p.push(id);
    }
    try { localStorage.setItem("pins", JSON.stringify(p)); } catch (e) {}
    return true;
  }
  function pinBtn(id) {
    var on = getPins().indexOf(id) !== -1;
    var b = el("span", "pinb" + (on ? " on" : ""), "📌");
    b.setAttribute("role", "button");
    b.setAttribute("aria-label", on ? "إلغاء التثبيت" : "تثبيت الكتاب");
    b.onclick = function (e) {
      e.stopPropagation();
      if (togglePin(id)) render();
    };
    return b;
  }

  function bookRow(b, onFav) {
    var btn = el("button", "row book");
    var box = el("span", "bk");
    box.appendChild(el("span", "bt", b.title));
    box.appendChild(el("span", "ba", b.author));
    var p = getPos(b.id);
    if (b.kind === "scan") box.appendChild(el("span", "bp", b.volumes.length + " جزء"));
    else if (p && p.pct) box.appendChild(el("span", "bp", "تمت قراءة \u2066" + p.pct + "%\u2069"));
    var cv = el("img", "bcov"); cv.alt = ""; cv.loading = "lazy";
    cv.onerror = function () { cv.remove(); };
    coverSrc(cv, b.id);
    btn.appendChild(cv);
    btn.appendChild(box);
    btn.appendChild(pinBtn(b.id));
    btn.appendChild(favStar("books", b.id, onFav));
    btn.appendChild(el("span", "chev", "‹"));
    btn.onclick = function () { go({ type: "book", id: b.id }); };
    return btn;
  }

  function renderLib() {
    titleEl.textContent = "📚 المكتبة";
    var rb = el("button", "chip", "🔄 تحديث المحتوى (نسخة " + VERSION + ")");
    rb.style.margin = "8px 12px";
    rb.onclick = function () { checkUpdate(true); };
    viewEl.appendChild(rb);
    var list = el("div", "list");
    var pins = getPins().filter(function (id) { return findBook(id); });
    var ordered = pins.map(findBook).concat(BOOKS.filter(function (b) { return pins.indexOf(b.id) === -1; }));
    var cats = [];
    ordered.forEach(function (b) { if (!b.cat) list.appendChild(bookRow(b)); else if (cats.indexOf(b.cat) < 0) cats.push(b.cat); });
    cats.forEach(function (c) {
      list.appendChild(el("div", "fsec", c));
      ordered.forEach(function (b) { if (b.cat === c) list.appendChild(bookRow(b)); });
    });
    if (!BOOKS.length) list.appendChild(el("div", "empty", "لا توجد كتب بعد"));
    viewEl.appendChild(list);
  }

  function renderFavs() {
    titleEl.textContent = "⭐ المفضلة";
    var ban = el("div", "shahada");
    ban.appendChild(el("div", "orn", "✦ ❖ ✦"));
    ban.appendChild(el("div", "sh-t", SHAHADA));
    ban.appendChild(el("div", "orn", "✦"));
    viewEl.appendChild(ban);
    var f = getFavs();
    var bks = f.books.map(findBook).filter(Boolean);
    var its = f.items.filter(function (k) { return ITEMS[k]; });
    var recsF = f.recs || [];
    if (!bks.length && !its.length && !recsF.length) {
      var em = el("div", "favempty");
      em.appendChild(el("div", "fe-i", "☆"));
      em.appendChild(el("div", "fe-t", "ما عندك شيء بالمفضلة بعد"));
      em.appendChild(el("div", "fe-s", "اضغط ☆ جنب أي كتاب في المكتبة، أو ☆ للمفضلة داخل أي دعاء أو زيارة، وتظهر هنا."));
      viewEl.appendChild(em);
      return;
    }
    if (bks.length) {
      viewEl.appendChild(el("div", "fsec", "📚 الكتب (" + bks.length + ")"));
      var l1 = el("div", "list");
      bks.forEach(function (b) { l1.appendChild(bookRow(b, function () { render(); })); });
      viewEl.appendChild(l1);
    }
    if (recsF.length) {
      viewEl.appendChild(el("div", "fsec", "🎧 القرّاء المفضلون (" + recsF.length + ")"));
      var l3 = el("div", "list"); viewEl.appendChild(l3);
      loadReciters().then(function (all) {
        recsF.forEach(function (id) {
          var r = all.filter(function (x) { return x.id === id; })[0]; if (!r) return;
          var b = el("button", "row"); b.appendChild(el("span", null, r.name));
          b.appendChild(favStar("recs", id, function () { render(); })); b.appendChild(el("span", "chev", "‹"));
          b.onclick = function () { go({ type: "listen", rec: id }); };
          l3.appendChild(b);
        });
      }, function () { l3.appendChild(el("div", "empty", "تعذّر تحميل القرّاء (تحقق من الإنترنت).")); });
    }
    if (its.length) {
      viewEl.appendChild(el("div", "fsec", "📜 أدعية وزيارات (" + its.length + ")"));
      var l2 = el("div", "list");
      its.forEach(function (k) {
        var b = el("button", "row");
        b.appendChild(el("span", null, ITEMS[k].title));
        b.appendChild(favStar("items", k, function () { render(); }));
        b.appendChild(el("span", "chev", "‹"));
        b.onclick = function () { go({ type: "item", key: k }); };
        l2.appendChild(b);
      });
      viewEl.appendChild(l2);
    }
  }

  var sheetEl = null, scrollTimer = null, restoring = false, curBook = null, io = null;

  function barH() {
    var b = $("bar"), t = viewEl.querySelector(".reader-tools.sticky");
    return (b ? b.offsetHeight : 0) + (t ? t.offsetHeight : 0);
  }

  function chapEls() { return viewEl.querySelectorAll(".chap, .spage"); }

  function currentPos() {
    var chs = chapEls(), h = barH() + 12, idx = 0, r = 0;
    for (var i = 0; i < chs.length; i++) {
      var rc = chs[i].getBoundingClientRect();
      if (rc.top <= h) { idx = i; r = rc.height ? Math.max(0, Math.min(1, (h - rc.top) / rc.height)) : 0; }
      else break;
    }
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var pct = max > 0 ? Math.round(100 * (window.pageYOffset || 0) / max) : 0;
    return { ch: idx, r: r, pct: Math.max(0, Math.min(100, pct)), t: Date.now() };
  }

  function savePos() {
    if (!curBook || restoring) return;
    var top = stack[stack.length - 1];
    if (!top || !isReader(top)) return;
    if (curBook.kind === "scan") {
      if (top.type !== "vol") return;
      var p = currentPos(); p.vol = top.vol; setPos(curBook.id, p); return;
    }
    setPos(curBook.id, currentPos());
  }

  function restoreTo(i, r) {
    var chs = chapEls();
    if (!chs.length) return;
    i = Math.max(0, Math.min(chs.length - 1, i));
    restoring = true;
    function doIt() {
      var rc = chs[i].getBoundingClientRect();
      var y = (window.pageYOffset || 0) + rc.top + (r || 0) * rc.height - barH() - 8;
      window.scrollTo(0, Math.max(0, y));
    }
    requestAnimationFrame(function () {
      doIt();
      setTimeout(function () { doIt(); restoring = false; }, 250);
    });
  }

  function closeSheet() {
    if (sheetEl && sheetEl.parentNode) sheetEl.parentNode.removeChild(sheetEl);
    sheetEl = null;
  }

  function openIndex(book) {
    closeSheet();
    var cur = currentPos().ch, bms = getBm(book.id), onlyBm = false;
    sheetEl = el("div", "sheet");
    sheetEl.onclick = function (e) { if (e.target === sheetEl) closeSheet(); };
    var panel = el("div", "panel");
    var head = el("div", "ph");
    head.appendChild(el("strong", null, "الفهرس"));
    var f = el("button", "chip", "⭐ العلامات");
    head.appendChild(f);
    var x = el("button", "chip", "إغلاق");
    x.onclick = closeSheet;
    head.appendChild(x);
    panel.appendChild(head);
    var list = el("div", "pl");
    panel.appendChild(list);
    function draw() {
      list.textContent = "";
      var n = 0;
      book.chapters.forEach(function (c, i) {
        var mark = bms.indexOf(c.id) !== -1;
        if (onlyBm && !mark) return;
        n++;
        var b = el("button", "pi" + (i === cur ? " cur" : ""));
        b.appendChild(el("span", null, c.title));
        if (mark) b.appendChild(el("span", "star", "⭐"));
        b.onclick = function () { closeSheet(); restoreTo(i, 0); };
        list.appendChild(b);
      });
      if (!n) list.appendChild(el("div", "empty", "ما عندك علامات بعد. اضغط ☆ جنب عنوان أي فصل."));
    }
    f.onclick = function () { onlyBm = !onlyBm; f.classList.toggle("on", onlyBm); draw(); };
    draw();
    sheetEl.appendChild(panel);
    document.body.appendChild(sheetEl);
  }

  function renderBook(v) {
    var book = findBook(v.id);
    if (!book) { stack.pop(); render(); return; }
    if (book.kind === "scan") { curBook = null; renderVolumes(book); return; }
    curBook = book;
    titleEl.textContent = book.title;

    var tools = el("div", "reader-tools sticky");
    var plus = el("button", "chip", "A+");
    var minus = el("button", "chip", "A−");
    function resize(d) {
      var p = currentPos();
      cfg.fs = Math.max(16, Math.min(40, cfg.fs + d)); applyFont(); saveCfg();
      restoreTo(p.ch, p.r);
    }
    plus.onclick = function () { resize(2); };
    minus.onclick = function () { resize(-2); };
    var idx = el("button", "chip", "☰ الفهرس");
    idx.onclick = function () { openIndex(book); };
    [plus, minus, idx, favChip("books", book.id)].forEach(function (b) { tools.appendChild(b); });
    viewEl.appendChild(tools);
    tools.style.top = ($("bar").offsetHeight - 1) + "px";

    var paper = el("article", "paper");
    var bms = getBm(book.id);
    book.chapters.forEach(function (c) {
      var sec = el("section", "chap");
      var h = el("h2");
      h.appendChild(el("span", null, c.title));
      var st = el("button", "bm", bms.indexOf(c.id) !== -1 ? "⭐" : "☆");
      st.setAttribute("aria-label", "علامة");
      st.onclick = function () {
        var a = getBm(book.id), k = a.indexOf(c.id);
        if (k === -1) { a.push(c.id); st.textContent = "⭐"; toast("تمت إضافة علامة"); }
        else { a.splice(k, 1); st.textContent = "☆"; }
        setBm(book.id, a);
      };
      h.appendChild(st);
      sec.appendChild(h);
      sec.appendChild(el("div", "text", c.text));
      paper.appendChild(sec);
    });
    if (book.source) paper.appendChild(el("div", "source", "📚 " + book.source));
    viewEl.appendChild(paper);

    // الرجوع لنفس المكان
    buildSplit();
    var saved = getPos(book.id);
    if (v.jump !== undefined) restoreTo(v.jump, 0);
    else if (saved) restoreTo(saved.ch || 0, saved.r || 0);
  }

  /* ---------------- الكتب المصوّرة (صور صفحات) ---------------- */
  var pageLbl = null, curOff = 1, curVol = null;
  function p2i(vol, p) {
    var m = vol.pm;
    if (!m) return p - vol.off;
    var a = m[0][1];
    for (var k = 0; k < m.length; k++) if (p >= m[k][0]) a = m[k][1];
    return p + a;
  }
  function i2p(vol, i) {
    var m = vol.pm;
    if (!m) return i + vol.off;
    var a = m[0][1];
    for (var k = 0; k < m.length; k++) if (i >= m[k][0] + m[k][1]) a = m[k][1];
    return i - a;
  }
  var BASE = REMOTE_URL.replace(/[^\/]*$/, "");
  var dlBusy = {};
  var _db = null;
  function idb() {
    if (!_db) _db = new Promise(function (res, rej) {
      var r = indexedDB.open("scanbooks", 1);
      r.onupgradeneeded = function () { r.result.createObjectStore("p"); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return _db;
  }
  function idbDo(mode, fn) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction("p", mode), rq = fn(tx.objectStore("p"));
        tx.oncomplete = function () { res(rq && rq.result); };
        tx.onerror = tx.onabort = function () { rej(tx.error); };
      });
    });
  }
  function vkey(b, v) { return b.id + ":" + v.id + ":"; }
  function isDown(b, v) { return idbDo("readonly", function (s) { return s.get(vkey(b, v) + "done"); }).then(function (x) { return !!x; }, function () { return false; }); }
  function delVol(b, v) {
    var k = vkey(b, v);
    return idbDo("readwrite", function (s) { return s.delete(IDBKeyRange.bound(k, k + "￿")); });
  }
  function fmtMB(n) { return n + " ميغا"; }

  function b64Blob(b64) {
    var bin = atob(b64), n = bin.length, u = new Uint8Array(n);
    for (var i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function getPart(book, part, add, undo) {
    var urls = [];
    if (trustedUrl(book.packBase)) urls.push(book.packBase.replace(/\/?$/, "/") + part.f);
    urls.push(BASE + part.f);
    var P = window.Capacitor && window.Capacitor.Plugins || {};
    function viaFetch(u) {
      var mine = 0;
      // مهلة توقف: إذا ما وصلت بيانات 45 ثانية نقطع الاتصال بدل الانتظار للأبد
      var ctrl = window.AbortController ? new AbortController() : null, st = null;
      function kick() { if (!ctrl) return; clearTimeout(st); st = setTimeout(function () { ctrl.abort(); }, 45000); }
      kick();
      return fetch(u, ctrl ? { signal: ctrl.signal } : undefined).then(function (r) {
        kick();
        if (!r.ok) throw new Error("http " + r.status);
        if (!r.body || !r.body.getReader) {
          return r.arrayBuffer().then(function (ab) { mine += ab.byteLength; add(ab.byteLength); return [new Blob([ab])]; });
        }
        var rd = r.body.getReader(), chunks = [];
        function pump() {
          return rd.read().then(function (x) {
            if (x.done) return chunks;
            kick();
            chunks.push(x.value); mine += x.value.length; add(x.value.length);
            return pump();
          });
        }
        return pump();
      }).then(function (c) { clearTimeout(st); return c; }, function (e) { clearTimeout(st); undo(mine); throw e; });
    }
    function viaNative(u) {
      if (!P.CapacitorHttp) return Promise.reject(new Error("no native"));
      return P.CapacitorHttp.get({ url: u, responseType: "blob", readTimeout: 120000, connectTimeout: 30000 }).then(function (r) {
        if (r.status !== 200) throw new Error("http " + r.status);
        var u8 = b64Blob(r.data); add(u8.length); return [u8];
      });
    }
    function tryAt(i) {
      if (i >= urls.length) return Promise.reject(new Error("all failed"));
      return viaFetch(urls[i]).catch(function () { return tryAt(i + 1); });
    }
    return tryAt(0).catch(function () {
      var j = 0;
      function nat() {
        if (j >= urls.length) return Promise.reject(new Error("all failed"));
        return viaNative(urls[j++]).catch(nat);
      }
      return nat();
    });
  }

  function downloadVol(b, v, onProg) {
    var total = 0;
    v.parts.forEach(function (p) { p.sizes.forEach(function (n) { total += n; }); });
    if (!(total > 0)) return Promise.reject(new Error("bad sizes"));
    var got = 0, pn = 0;
    function doPart(pi) {
      if (pi >= v.parts.length) return Promise.resolve();
      var part = v.parts[pi];
      return getPart(b, part, function (n) { got += n; onProg(Math.min(1, got / total)); }, function (n) { got -= n; })
      .then(function (chunks) {
        var blob = new Blob(chunks, { type: "image/webp" });
        var sum = part.sizes.reduce(function (a, n) { return a + n; }, 0);
        if (blob.size !== sum) throw new Error("size mismatch");
        var start = pn, off = 0;
        pn += part.sizes.length;
        return idbDo("readwrite", function (s) {
          part.sizes.forEach(function (n, i) {
            s.put(blob.slice(off, off + n, "image/webp"), vkey(b, v) + (start + i));
            off += n;
          });
        });
      }).then(function () { return doPart(pi + 1); });
    }
    return doPart(0).then(function () {
      return idbDo("readwrite", function (s) { return s.put(true, vkey(b, v) + "done"); });
    });
  }

  function openBook(id) {
    var b = findBook(id), p = getPos(id);
    if (b && b.notice) {
      var nk = "nt_" + b.id;
      try { if (!sessionStorage.getItem(nk)) { sessionStorage.setItem(nk, "1"); alert("⚠ تنبيه قبل القراءة\n\n" + b.notice.join("\n\n")); } } catch (e) {}
    }
    if (b && b.kind === "scan" && p && p.vol) {
      var v = b.volumes.filter(function (x) { return x.id === p.vol; })[0];
      if (v) {
        isDown(b, v).then(function (ok) {
          stack.push({ type: "book", id: id });
          if (ok) stack.push({ type: "vol", id: id, vol: v.id });
          render(); window.scrollTo(0, 0);
        });
        return;
      }
    }
    go({ type: "book", id: id });
  }


  /* ---------- الأغلفة: تُحفظ بالجهاز فتبقى بدون إنترنت ---------- */
  var coverSeen = {};
  function coverFetch(id) {
    return fetch(BASE + "covers/" + id + ".jpg", { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.blob();
    }).then(function (bl) {
      if (!bl || !bl.size) throw new Error("empty");
      return idbDo("readwrite", function (s) { return s.put(bl, "cover:" + id); }).then(function () { return bl; }, function () { return bl; });
    });
  }
  function coverSrc(img, id) {
    idbDo("readonly", function (s) { return s.get("cover:" + id); }).then(function (bl) { return bl || null; }, function () { return null; }).then(function (bl) {
      if (bl) {
        img.src = URL.createObjectURL(bl);
        if (!coverSeen[id] && navigator.onLine !== false) { coverSeen[id] = 1; coverFetch(id).catch(function () {}); }
      } else {
        coverFetch(id).then(function (b2) { img.src = URL.createObjectURL(b2); }, function () { img.onerror && img.onerror(); });
      }
    });
  }
  function prefetchCovers() {
    var list = BOOKS.map(function (b) { return b.id; }), i = 0;
    (function next() {
      if (i >= list.length || navigator.onLine === false) return;
      var id = list[i++];
      idbDo("readonly", function (s) { return s.get("cover:" + id); }).then(function (bl) {
        if (bl) return next();
        coverFetch(id).then(next, next);
      }, next);
    })();
  }

  function renderVolumes(book) {
    titleEl.textContent = book.title;
    var box = el("div");
    var bc = el("img", "bigcov"); bc.alt = "";
    bc.onerror = function () { bc.remove(); };
    coverSrc(bc, book.id);
    box.appendChild(bc);
    box.appendChild(el("div", "volinfo", book.desc || ""));
    if (book.notice) {
      var nb = el("div", "bnotice");
      nb.appendChild(el("div", "bn-h", "⚠ تنبيه قبل القراءة"));
      book.notice.forEach(function (t) { nb.appendChild(el("div", "bn-p", t)); });
      box.appendChild(nb);
    }
    var fr = el("div", "favrow"); fr.appendChild(favChip("books", book.id)); box.appendChild(fr);
    var list = el("div", "list");
    var saved = getPos(book.id);
    book.volumes.forEach(function (v) {
      var btn = el("button", "row book");
      var bx = el("span", "bk");
      bx.appendChild(el("span", "bt", v.title));
      bx.appendChild(el("span", "ba", v.pages + " صفحة · " + fmtMB(v.mb)));
      var st = el("span", "bp", "⬇ اضغط للتحميل");
      bx.appendChild(st);
      var bar = el("span", "dlbar"); var fill = el("i"); bar.appendChild(fill); bar.hidden = true;
      bx.appendChild(bar);
      btn.appendChild(bx);
      var del = el("span", "chip", "🗑 حذف"); del.hidden = true;
      btn.appendChild(del);
      var state = false;
      function paint() {
        if (dlBusy[book.id + v.id]) { return; }
        st.textContent = state ? ("✓ محمّل" + (saved && saved.vol === v.id ? " — وصلت صفحة " + i2p(v, saved.ch || 0) : "")) : "⬇ اضغط للتحميل";
        del.hidden = !state;
      }
      isDown(book, v).then(function (ok) { state = ok; paint(); });
      del.onclick = function (e) {
        e.stopPropagation();
        if (!confirm("حذف " + v.title + " من الجهاز؟ (تقدر تحمّله مرة ثانية)")) return;
        delVol(book, v).then(function () { state = false; paint(); toast("تم الحذف"); });
      };
      btn.onclick = function () {
        if (dlBusy[book.id + v.id]) return;
        if (state) { go({ type: "vol", id: book.id, vol: v.id }); return; }
        dlBusy[book.id + v.id] = true; bar.hidden = false; st.textContent = "جاري التحميل 0%";
        downloadVol(book, v, function (f) { fill.style.width = Math.round(f * 100) + "%"; st.textContent = "جاري التحميل " + Math.round(f * 100) + "%"; })
          .then(function () { state = true; toast("تم التحميل"); })
          .catch(function () { toast("فشل التحميل — تأكد من الإنترنت وحاول مرة ثانية"); })
          .then(function () { delete dlBusy[book.id + v.id]; bar.hidden = true; paint(); });
      };
      list.appendChild(btn);
    });
    box.appendChild(list);
    if (book.source) box.appendChild(el("div", "source", "📚 " + book.source));
    viewEl.appendChild(box);
  }


  /* ---------------- اشرح الصفحة عبر تطبيق ذكاء اصطناعي (مشاركة) ---------------- */
  var AI_Q = "هذه صفحة من كتاب أدعية/حديث شيعي. اشرح لي بالعربية المبسّطة ما هو مكتوب فيها فقط بناءً على النص الظاهر، " +
    "ولا تضف حديثاً أو معلومة من عندك أو من الذاكرة، وإن كان شيء غير واضح فقل ذلك. ";
  function blobToJpegBlob(bl) {
    return new Promise(function (res, rej) {
      var u = URL.createObjectURL(bl), im = new Image();
      im.onload = function () {
        var c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
        var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0);
        URL.revokeObjectURL(u); c.toBlob(function (b) { b ? res(b) : rej(new Error("img")); }, "image/jpeg", 0.9);
      };
      im.onerror = function () { URL.revokeObjectURL(u); rej(new Error("img")); };
      im.src = u;
    });
  }
  function aiShare(book, vol, idx) {
    closeSheet();
    sheetEl = el("div", "sheet");
    sheetEl.onclick = function (e) { if (e.target === sheetEl) closeSheet(); };
    var panel = el("div", "panel");
    var head = el("div", "ph");
    head.appendChild(el("strong", null, "🤖 اشرح صفحة " + i2p(vol, idx)));
    var x = el("button", "chip", "إغلاق"); x.onclick = closeSheet; head.appendChild(x);
    panel.appendChild(head);
    var box = el("div", "aibox");
    var q = el("textarea", "aiq"); q.rows = 2;
    q.placeholder = "اكتب الموضع اللي ما فهمته أو سؤالك (اختياري). اتركه فارغاً لشرح الصفحة كلها.";
    var go = el("button", "chip on", "إرسال لتطبيق الذكاء الاصطناعي");
    box.appendChild(q); box.appendChild(go);
    var orGo = el("button", "chip on", "✨ اشرح داخل التطبيق (OpenRouter)");
    var orOut = el("div", "aiout"); orOut.hidden = true;
    var cfg = el("details", "aicfg");
    cfg.appendChild(el("summary", null, "⚙ إعداد مفتاح OpenRouter"));
    var kin = el("input", "hf-in"); kin.type = "password"; kin.placeholder = "مفتاح OpenRouter (sk-or-...)";
    var min = el("input", "hf-in"); min.type = "text"; min.placeholder = "اسم النموذج (يقبل الصور)";
    var kv = "", mv = "";
    try { kv = localStorage.getItem("orkey") || ""; mv = localStorage.getItem("ormodel") || ""; } catch (e) {}
    kin.value = kv; min.value = mv || "~openai/gpt-latest";
    var ksv = el("button", "chip", "حفظ");
    ksv.onclick = function () {
      try { localStorage.setItem("orkey", kin.value.trim()); localStorage.setItem("ormodel", min.value.trim()); } catch (e) {}
      toast("تم الحفظ");
    };
    cfg.appendChild(kin); cfg.appendChild(min); cfg.appendChild(ksv);
    cfg.appendChild(el("div", "ainote", "المفتاح يُحفظ على جهازك فقط ولا يُرسل إلا إلى openrouter.ai. لا تشاركه مع أحد. الاستخدام يُحسب على رصيدك في OpenRouter. اختر نموذجاً يدعم الصور."));
    if (!kv) cfg.open = true;
    box.appendChild(orGo); box.appendChild(orOut); box.appendChild(cfg);
    box.appendChild(el("div", "ainote", "يفتح قائمة المشاركة: اختر Claude أو Gemini أو أي تطبيق عندك. نص السؤال يُنسخ تلقائياً، الصقه إذا لم يظهر. الشرح آلي وقد يخطئ."));
    panel.appendChild(box);
    sheetEl.appendChild(panel);
    document.body.appendChild(sheetEl);
    orGo.onclick = function () {
      var key = "", model = "";
      try { key = (localStorage.getItem("orkey") || "").trim(); model = (localStorage.getItem("ormodel") || "").trim(); } catch (e) {}
      if (!key) { cfg.open = true; toast("أدخل المفتاح واحفظه أولاً"); return; }
      if (!model) model = "~openai/gpt-latest";
      var text = AI_Q + (q.value.trim() ? "المطلوب تحديداً: " + q.value.trim() : "اشرح الصفحة كلها.");
      orGo.disabled = true; orOut.hidden = false; orOut.textContent = "جاري الشرح…";
      idbDo("readonly", function (s) { return s.get(vkey(book, vol) + idx); })
        .then(function (bl) { if (!bl) throw new Error("nopage"); return blobToJpegBlob(bl); })
        .then(function (jb) {
          return new Promise(function (res, rej) {
            var fr = new FileReader(); fr.onload = function () { res(String(fr.result)); }; fr.onerror = rej; fr.readAsDataURL(jb);
          });
        })
        .then(function (url) {
          return fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json", "X-OpenRouter-Title": "Adiya wa Ziyarat" },
            body: JSON.stringify({ model: model, messages: [{ role: "user", content: [
              { type: "text", text: text }, { type: "image_url", image_url: { url: url } } ] }] })
          });
        })
        .then(function (r) {
          return r.json().then(function (j) {
            if (!r.ok) throw new Error((j && j.error && j.error.message) || ("http " + r.status));
            var m = j && j.choices && j.choices[0] && j.choices[0].message;
            if (!m || !m.content) throw new Error("لا يوجد رد");
            return typeof m.content === "string" ? m.content : JSON.stringify(m.content);
          });
        })
        .then(function (t) { orOut.textContent = t + "\n\n— شرح آلي وقد يخطئ، راجع أهل العلم."; })
        .catch(function (e) {
          var m = String(e && e.message || e);
          orOut.textContent = m === "nopage" ? "الصفحة غير محمّلة بعد." : "تعذّر الشرح: " + m;
        })
        .then(function () { orGo.disabled = false; });
    };
    go.onclick = function () {
      var text = AI_Q + (q.value.trim() ? "المطلوب تحديداً: " + q.value.trim() : "اشرح الصفحة كلها.");
      try { if (navigator.clipboard) navigator.clipboard.writeText(text); } catch (e) {}
      go.disabled = true;
      idbDo("readonly", function (s) { return s.get(vkey(book, vol) + idx); })
        .then(function (bl) { if (!bl) throw new Error("nopage"); return blobToJpegBlob(bl); })
        .then(function (jb) {
          var P = window.Capacitor && window.Capacitor.Plugins || {}, fname = "page-" + Date.now() + ".jpg";
          if (P.Filesystem && P.Share) {
            return new Promise(function (res, rej) {
              var fr = new FileReader();
              fr.onload = function () { res(String(fr.result).split(",")[1]); };
              fr.onerror = rej; fr.readAsDataURL(jb);
            }).then(function (b64) { return P.Filesystem.writeFile({ path: fname, data: b64, directory: "CACHE" }); })
              .then(function (r) { return P.Share.share({ text: text, files: [r.uri], dialogTitle: "اشرح عبر…" }); });
          }
          var file = new File([jb], fname, { type: "image/jpeg" });
          if (navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file], text: text });
          throw new Error("nosupport");
        })
        .then(function () { toast("تم، الصق السؤال إذا لم يظهر"); }, function (e) {
          var m = String(e && e.message || e);
          if (!/cancel|abort/i.test(m)) toast(m === "nopage" ? "الصفحة غير محمّلة بعد" : "تعذّرت المشاركة");
        }).then(function () { go.disabled = false; });
    };
  }

  function zoomGet() { try { return +localStorage.getItem("scanzoom") || 100; } catch (e) { return 100; } }

  function renderScan(v) {
    var book = findBook(v.id), vol = book && book.volumes.filter(function (x) { return x.id === v.vol; })[0];
    if (!vol) { stack.pop(); render(); return; }
    curBook = book; curOff = vol.off; curVol = vol;
    titleEl.textContent = book.title + " – " + vol.title;
    var zoom = zoomGet();

    var tools = el("div", "reader-tools sticky");
    var zi = el("button", "chip", "🔍+"), zo = el("button", "chip", "🔍−");
    var idxb = el("button", "chip", "☰ الفهرس");
    var star = el("button", "chip", "☆ علامة");
    var aib = el("button", "chip", "🤖 اشرح");
    var spb = el("button", "chip", "⫼ " + ["عادي", "علوي/سفلي", "جانبي"][splitMode()]);
    spb.onclick = function () {
      var n = (splitMode() + 1) % 3; setSplitMode(n);
      render();
    };
    pageLbl = el("span", "pglbl", "");
    [zo, zi, idxb, star, pageLbl].forEach(function (b) { tools.appendChild(b); });
    viewEl.appendChild(tools);
    tools.style.top = ($("bar").offsetHeight - 1) + "px";

    var wrap = el("div", "scanbox");
    var pages = [];
    function applyZoom() {
      pages.forEach(function (p) { p.style.width = zoom + "%"; });
    }
    for (var i = 0; i < vol.pages; i++) {
      var d = el("div", "spage");
      d.style.aspectRatio = String(vol.dims[i] || 0.7);
      d.dataset.i = i;
      pages.push(d); wrap.appendChild(d);
    }
    applyZoom();
    viewEl.appendChild(wrap);
    if (book.source) viewEl.appendChild(el("div", "source", "📚 " + book.source));

    function setZoom(z) {
      var p = currentPos();
      zoom = Math.max(100, Math.min(300, z));
      try { localStorage.setItem("scanzoom", String(zoom)); } catch (e) {}
      applyZoom(); restoreTo(p.ch, p.r);
    }
    zi.onclick = function () { setZoom(zoom + 50); };
    zo.onclick = function () { setZoom(zoom - 50); };
    aib.onclick = function () { aiShare(book, vol, currentPos().ch); };
    function jump(pg) { closeSheet(); restoreTo(Math.max(0, Math.min(vol.pages - 1, pg)), 0); }
    function bmKey(i) { return vol.id + ":" + i; }
    star.onclick = function () {
      var a = getBm(book.id), k = bmKey(currentPos().ch), j = a.indexOf(k);
      if (j === -1) { a.push(k); toast("تمت إضافة علامة"); } else { a.splice(j, 1); toast("أُزيلت العلامة"); }
      setBm(book.id, a);
    };
    idxb.onclick = function () {
      closeSheet();
      sheetEl = el("div", "sheet");
      sheetEl.onclick = function (e) { if (e.target === sheetEl) closeSheet(); };
      var panel = el("div", "panel");
      var head = el("div", "ph");
      head.appendChild(el("strong", null, "الفهرس"));
      var x = el("button", "chip", "إغلاق"); x.onclick = closeSheet; head.appendChild(x);
      panel.appendChild(head);
      var go1 = el("div", "gopage");
      var inp = el("input"); inp.type = "number"; inp.placeholder = "رقم الصفحة"; inp.inputMode = "numeric";
      var gb = el("button", "chip on", "اذهب");
      gb.onclick = function () { var n = parseInt(inp.value, 10); if (n) jump(p2i(vol, n)); };
      go1.appendChild(inp); go1.appendChild(gb);
      panel.appendChild(go1);
      var list = el("div", "pl");
      (vol.toc || []).forEach(function (t) {
        var b = el("button", "pi");
        b.appendChild(el("span", null, t.t));
        b.appendChild(el("span", "pn", "ص " + t.p));
        b.onclick = function () { jump(p2i(vol, t.p)); };
        list.appendChild(b);
      });
      var bms = getBm(book.id).filter(function (k) { return k.indexOf(vol.id + ":") === 0; })
        .map(function (k) { return +k.split(":")[1]; }).sort(function (a, b) { return a - b; });
      if (bms.length) {
        list.appendChild(el("div", "pgroup", "⭐ علاماتك"));
        bms.forEach(function (i) {
          var b = el("button", "pi");
          b.appendChild(el("span", null, "صفحة " + i2p(vol, i)));
          b.onclick = function () { jump(i); };
          list.appendChild(b);
        });
      }
      panel.appendChild(list);
      sheetEl.appendChild(panel);
      document.body.appendChild(sheetEl);
    };

    // تحميل الصور عند الاقتراب منها فقط، وتفريغها عند الابتعاد (لتوفير الذاكرة)
    io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var d = e.target;
        if (e.isIntersecting) {
          if (d.firstChild || d._ld) return;
          d._ld = true;
          idbDo("readonly", function (s) { return s.get(vkey(book, vol) + d.dataset.i); }).then(function (bl) {
            d._ld = false;
            if (!bl || d.firstChild || !io) return;
            var im = new Image(); im.alt = "";
            im.src = d._url = URL.createObjectURL(bl);
            d.appendChild(im);
          }, function () { d._ld = false; });
        } else if (d.firstChild) {
          d.removeChild(d.firstChild);
          if (d._url) { URL.revokeObjectURL(d._url); d._url = null; }
        }
      });
    }, { rootMargin: "1500px 0px" });
    pages.forEach(function (p) { io.observe(p); });

    var saved = getPos(book.id);
    if (v.jump !== undefined) restoreTo(v.jump, 0);
    else if (saved && saved.vol === vol.id) restoreTo(saved.ch || 0, saved.r || 0);
    pageLbl.textContent = "ص " + i2p(vol, saved && saved.vol === vol.id ? saved.ch || 0 : 0);
  }

  window.addEventListener("scroll", function () {
    if (!curBook) return;
    if (pageLbl) { var cp = currentPos(); pageLbl.textContent = "ص " + i2p(curVol || {off: curOff}, cp.ch); }
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(savePos, 350);
  }, { passive: true });
  document.addEventListener("visibilitychange", function () { if (document.hidden) savePos(); });
  window.addEventListener("pagehide", savePos);

  /* ---------------- الإعدادات ---------------- */
  function sw(checked, onchange) {
    var l = el("label", "switch");
    var i = document.createElement("input");
    i.type = "checkbox"; i.checked = checked;
    i.onchange = function () { onchange(i.checked); };
    l.appendChild(i); l.appendChild(document.createElement("span"));
    return l;
  }
  function row(label, sub, control) {
    var r = el("div", "set");
    var lb = el("div", "lb");
    lb.appendChild(document.createTextNode(label));
    if (sub) lb.appendChild(el("span", "sub", sub));
    r.appendChild(lb);
    r.appendChild(control);
    return r;
  }
  function timeInput(value, onchange) {
    var t = document.createElement("input");
    t.type = "time"; t.value = value;
    t.onchange = function () { if (t.value) onchange(t.value); };
    return t;
  }

  function renderSettings() {
    titleEl.textContent = "الإعدادات";

    var rem = el("section", "card");
    rem.appendChild(el("h3", null, "🔔 التذكيرات"));

    function onChange() { saveCfg(); scheduleAll(true); }

    rem.appendChild(row("حديث يومي قصير", "كل يوم بوقتك (مثلاً وقت الدوام)",
      sw(cfg.daily.on, function (v) { cfg.daily.on = v; onChange(); })));
    rem.appendChild(row("وقت الحديث اليومي", null,
      timeInput(cfg.daily.time, function (v) { cfg.daily.time = v; onChange(); })));
    rem.appendChild(row("تذكير عند الغياب", "إذا ما فتحت التطبيق لعدة أيام",
      sw(cfg.away.on, function (v) { cfg.away.on = v; onChange(); })));
    rem.appendChild(row("دعاء الصباح", "كل يوم",
      sw(cfg.sabah.on, function (v) { cfg.sabah.on = v; onChange(); })));
    rem.appendChild(row("وقت دعاء الصباح", null,
      timeInput(cfg.sabah.time, function (v) { cfg.sabah.time = v; onChange(); })));
    rem.appendChild(row("دعاء كميل", "ليلة الجمعة (الخميس)",
      sw(cfg.kumil.on, function (v) { cfg.kumil.on = v; onChange(); })));
    rem.appendChild(row("وقت دعاء كميل", null,
      timeInput(cfg.kumil.time, function (v) { cfg.kumil.time = v; onChange(); })));
    rem.appendChild(row("دعاء الندبة", "صباح الجمعة",
      sw(cfg.nudba.on, function (v) { cfg.nudba.on = v; onChange(); })));
    rem.appendChild(row("وقت دعاء الندبة", null,
      timeInput(cfg.nudba.time, function (v) { cfg.nudba.time = v; onChange(); })));
    rem.appendChild(el("p", "note",
      "قد يتأخر وصول الإشعار دقائق حسب توفير الطاقة. للدقة: الإعدادات ← التطبيقات ← هذا التطبيق ← البطارية ← بدون قيود."));
    viewEl.appendChild(rem);

    var look = el("section", "card");
    look.appendChild(el("h3", null, "🎨 المظهر"));
    var themeWrap = el("div", "reader-tools");
    [["auto", "تلقائي"], ["light", "فاتح"], ["dark", "داكن"]].forEach(function (p) {
      var b = el("button", "chip", (cfg.theme === p[0] ? "✓ " : "") + p[1]);
      b.onclick = function () { cfg.theme = p[0]; saveCfg(); applyTheme(); render(); };
      themeWrap.appendChild(b);
    });
    look.appendChild(themeWrap);
    var navWrap = el("div", "reader-tools");
    [["normal", "عادي"], ["glass", "زجاجي"]].forEach(function (p) {
      var b = el("button", "chip", (cfg.nav === p[0] ? "✓ " : "") + p[1]);
      b.onclick = function () { cfg.nav = p[0]; saveCfg(); applyTheme(); render(); };
      navWrap.appendChild(b);
    });
    look.appendChild(row("شكل الشريط السفلي", null, navWrap));
    if (cfg.nav === "glass") {
      var gr = document.createElement("input");
      gr.type = "range"; gr.min = 0; gr.max = 100; gr.step = 5; gr.value = cfg.glass;
      gr.oninput = function () { cfg.glass = +gr.value; applyTheme(); saveCfg(); };
      look.appendChild(row("شفافية الزجاج", "يسار: شفاف أكثر — يمين: معتم أكثر", gr));
    }
    look.appendChild(row("صورة الخلفية", "القبة والمنارتان خلف التطبيق",
      sw(!!cfg.bg, function (v) { cfg.bg = v; applyTheme(); saveCfg(); render(); })));
    if (cfg.bg) {
      var bgr = document.createElement("input");
      bgr.type = "range"; bgr.min = 0; bgr.max = 100; bgr.step = 5; bgr.value = cfg.bga;
      bgr.oninput = function () { cfg.bga = +bgr.value; applyTheme(); saveCfg(); };
      look.appendChild(row("وضوح الخلفية", "يسار: خافتة — يمين: أوضح", bgr));
    }
    var rng = document.createElement("input");
    rng.type = "range"; rng.min = 16; rng.max = 40; rng.step = 2; rng.value = cfg.fs;
    rng.oninput = function () { cfg.fs = +rng.value; applyFont(); saveCfg(); };
    look.appendChild(row("حجم خط القراءة", null, rng));
    viewEl.appendChild(look);

    var rdc = el("section", "card");
    rdc.appendChild(el("h3", null, "📖 القراءة"));
    var lsr = document.createElement("input");
    lsr.type = "range"; lsr.min = 16; lsr.max = 30; lsr.step = 1; lsr.value = Math.round((cfg.lh || 2.1) * 10);
    lsr.oninput = function () { cfg.lh = +lsr.value / 10; applyFont(); saveCfg(); };
    rdc.appendChild(row("تباعد الأسطر", null, lsr));
    rdc.appendChild(row("وضع القراءة الهادئ", "ورقة بلون مريح للعين",
      sw(!!cfg.calm, function (v) { cfg.calm = v; applyFont(); saveCfg(); })));
    rdc.appendChild(row("إبقاء الشاشة مضيئة", "أثناء قراءة الأدعية والكتب",
      sw(!!cfg.awake, function (v) {
        cfg.awake = v; saveCfg();
        if (v && !navigator.wakeLock) toast("جهازك لا يدعم هذه الميزة من داخل التطبيق");
        applyAwake();
      })));
    viewEl.appendChild(rdc);

    var bk = el("section", "card");
    bk.appendChild(el("h3", null, "💾 النسخ الاحتياطي"));
    bk.appendChild(el("p", "note", "قرأت " + readCount() + " عنصراً. تُحفظ علاماتك ومفضلتك وموضع قراءتك والإعدادات فقط (بدون أي كلمات سر)."));
    var bkr = el("div", "reader-tools");
    var bs = el("button", "chip on", "💾 حفظ نسخة احتياطية");
    bs.onclick = saveBackupFile;
    var bc = el("button", "chip", "نسخ كنص");
    bc.onclick = function () { copyText(backupText()); };
    bkr.appendChild(bs); bkr.appendChild(bc);
    bk.appendChild(bkr);
    var fl = document.createElement("input");
    fl.type = "file"; fl.accept = ".json,.txt,application/json,text/plain"; fl.style.display = "none";
    fl.onchange = function () {
      var f = fl.files && fl.files[0]; if (!f) return;
      if (f.size > 5000000) { toast("الملف كبير جداً"); return; }
      var fr = new FileReader();
      fr.onload = function () { doRestore(String(fr.result || "")); };
      fr.onerror = function () { toast("تعذّرت قراءة الملف"); };
      fr.readAsText(f);
    };
    var bf = el("button", "chip", "📂 استرجاع من ملف");
    bf.onclick = function () { fl.click(); };
    var rr = el("div", "reader-tools");
    rr.appendChild(bf); rr.appendChild(fl);
    bk.appendChild(rr);
    var ta = el("textarea", "bk-ta");
    ta.placeholder = "أو الصق النسخة الاحتياطية هنا…";
    bk.appendChild(ta);
    var bp = el("button", "chip", "استرجاع من النص");
    bp.onclick = function () { if (ta.value.trim()) doRestore(ta.value); else toast("الصق النسخة أولاً"); };
    bk.appendChild(bp);
    viewEl.appendChild(bk);

    var about = el("section", "card");
    about.appendChild(el("h3", null, "ℹ️ عن التطبيق"));
    about.appendChild(el("p", "note",
      "أدعية وزيارات وأحاديث بمصادرها الشيعية. يعمل بدون إنترنت. " +
      "راجع النصوص والمصادر من الكتب المعتمدة عند الاعتماد عليها."));
    about.appendChild(el("p", "note",
      "هذا التطبيق غير ربحي ومجاني بالكامل، أُنشئ خدمةً لمحبّي أهل البيت (عليهم السلام) " +
      "وابتغاءً لوجه الله تعالى. لا إعلانات ولا اشتراكات ولا جمع بيانات، ويُمنع بيعه أو الاتجار به."));
    about.appendChild(el("p", "note",
      "الكتب المصوّرة في المكتبة محفوظة حقوق طباعتها لدور النشر وأصحابها، وهي للقراءة الشخصية فقط، " +
      "ولا يجوز نشرها أو توزيعها. وإن كنتَ صاحب حقٍّ وتودّ حذف كتابك فسنحذفه فوراً."));
    viewEl.appendChild(about);
  }

  /* ---------------- الإشعارات (أندرويد) ---------------- */
  function native() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }
  function LN() {
    return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications;
  }

  // أحاديث قصيرة للإشعارات (تُؤخذ من قسم الأحاديث)
  var QUOTES = [];
  function buildQuotes() {
    var ks = [];
    CATS.forEach(function (c) { if (c.id === "c7" || c.parent === "c7") ks = ks.concat(c.keys); });
    QUOTES = ks
      .map(function (k) { return { key: k, title: ITEMS[k].title, text: ITEMS[k].text, source: ITEMS[k].source }; });
  }
  buildQuotes();

  function parseTime(s) {
    var p = (s || "08:00").split(":");
    return { hour: parseInt(p[0], 10) || 0, minute: parseInt(p[1], 10) || 0 };
  }
  function quoteFor(dayNumber) {
    return QUOTES.length ? QUOTES[((dayNumber % QUOTES.length) + QUOTES.length) % QUOTES.length] : null;
  }
  function quoteBody(q) {
    return { body: q.text, largeBody: q.text + (q.source ? "\n📚 " + q.source : "") };
  }

  var scheduling = false, schedAgain = false;
  async function scheduleAll(askPermission) {
    if (!native()) {
      if (askPermission) toast("التذكيرات تعمل داخل تطبيق الأندرويد");
      return;
    }
    var ln = LN();
    if (!ln) return;
    if (scheduling) { schedAgain = true; return; }   // طلب جديد أثناء الجدولة: نعيدها بعد الانتهاء بآخر الإعدادات
    scheduling = true;
    try {
      var perm = await ln.checkPermissions();
      if (perm.display !== "granted") {
        perm = await ln.requestPermissions();
      }
      if (perm.display !== "granted") {
        if (askPermission) toast("فعّل إذن الإشعارات من إعدادات الهاتف");
        scheduling = false;
        if (schedAgain) { schedAgain = false; scheduleAll(false); }
        return;
      }

      try {
        if (ln.checkExactNotificationSetting) {
          var ex = await ln.checkExactNotificationSetting();
          if (ex && ex.exact_alarm !== "granted" && ln.changeExactNotificationSetting && askPermission) {
            // نسأل مرة واحدة فقط كل 7 أيام، وبطلب من المستخدم (لا عند فتح التطبيق)
            var lastAsk = 0;
            try { lastAsk = +localStorage.getItem("exactAsk") || 0; } catch (e) {}
            if (Date.now() - lastAsk > 7 * 86400000) {
              try { localStorage.setItem("exactAsk", String(Date.now())); } catch (e) {}
              toast("فعّل «المنبّهات والتذكيرات» ليصل التنبيه بالدقيقة");
              await ln.changeExactNotificationSetting();
            }
          }
        }
      } catch (e) {}

      var pending = await ln.getPending();
      if (pending.notifications && pending.notifications.length) {
        await ln.cancel({ notifications: pending.notifications.map(function (n) { return { id: n.id }; }) });
      }

      var list = [];
      function add(n) { n.channelId = "duas"; list.push(n); }

      // الأيام في كاباسيتور: 1 = الأحد ... 7 = السبت (الخميس 5، الجمعة 6)
      if (cfg.sabah.on) {
        var t1 = parseTime(cfg.sabah.time);
        add({ id: 1, title: "🌅 دعاء الصباح", body: "حان وقت دعاء الصباح",
          schedule: { on: { hour: t1.hour, minute: t1.minute }, allowWhileIdle: true }, extra: { key: "dua_sabah" } });
      }
      if (cfg.kumil.on) {
        var t2 = parseTime(cfg.kumil.time);
        add({ id: 2, title: "🌙 ليلة الجمعة", body: "حان وقت دعاء كميل",
          schedule: { on: { weekday: 5, hour: t2.hour, minute: t2.minute }, allowWhileIdle: true }, extra: { key: "dua_kumil" } });
      }
      if (cfg.nudba.on) {
        var t3 = parseTime(cfg.nudba.time);
        add({ id: 3, title: "🕌 صباح الجمعة", body: "حان وقت دعاء الندبة",
          schedule: { on: { weekday: 6, hour: t3.hour, minute: t3.minute }, allowWhileIdle: true }, extra: { key: "dua_nudba" } });
      }

      var now = new Date();

      // حديث يومي: نجدول 30 يوماً قادمة، وتُجدّد كل مرة يُفتح فيها التطبيق
      if (cfg.daily.on && QUOTES.length) {
        var td = parseTime(cfg.daily.time);
        for (var i = 0; i < 30; i++) {
          var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, td.hour, td.minute, 0);
          if (d <= now) continue;
          var q = quoteFor(Math.floor(d.getTime() / 86400000));
          var b = quoteBody(q);
          add({ id: 1000 + i, title: "📜 " + q.title, body: b.body, largeBody: b.largeBody,
            schedule: { at: d, allowWhileIdle: true }, extra: { key: q.key } });
        }
      }

      // تذكير الغياب: بعد 3 و7 و14 يوماً من آخر فتح
      if (cfg.away.on && QUOTES.length) {
        var ta = cfg.daily.on ? parseTime(cfg.daily.time) : { hour: 18, minute: 0 };
        [3, 7, 14].forEach(function (days, idx) {
          var d2 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, ta.hour, ta.minute, 0);
          var q2 = quoteFor(Math.floor(d2.getTime() / 86400000) + idx + 3);
          var b2 = quoteBody(q2);
          add({ id: 4 + idx, title: "🌿 اشتقنا لك", body: b2.body, largeBody: b2.largeBody,
            schedule: { at: d2, allowWhileIdle: true }, extra: { key: q2.key } });
        });
      }

      if (list.length) await ln.schedule({ notifications: list });
      if (askPermission) toast("تم حفظ التذكيرات");
    } catch (e) {
      if (askPermission) toast("تعذّر ضبط التذكيرات");
      try { console.error(e); } catch (x) {}
    }
    scheduling = false;
    if (schedAgain) { schedAgain = false; scheduleAll(false); }
  }

  async function setupNative() {
    if (!native()) return;
    var ln = LN();
    var AppPlugin = window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    try {
      if (ln && ln.createChannel) {
        await ln.createChannel({ id: "duas", name: "التذكيرات", description: "تذكيرات الأدعية والأحاديث",
          importance: 4, visibility: 1, vibration: true });
      }
    } catch (e) {}
    if (ln) {
      ln.addListener("localNotificationActionPerformed", function (ev) {
        var extra = (ev.notification && ev.notification.extra) || {};
        if (extra.key && ITEMS[extra.key]) {
          stack = [{ type: "home" }, { type: "item", key: extra.key }];
          render();
        }
      });
    }
    if (AppPlugin) {
      AppPlugin.addListener("backButton", function () {
        if (!goBack()) AppPlugin.exitApp();
      });
    }
    scheduleAll(false);
  }

  /* ---------------- تشغيل ---------------- */
  btnBack.onclick = goBack;
  btnSettings.onclick = function () {
    if (stack[stack.length - 1].type !== "settings") go({ type: "settings" });
  };

  /* ---------------- تحديث المحتوى من الإنترنت ---------------- */
  function checkUpdate(manual) {
    if (!window.fetch) { if (manual) toast("المتصفح لا يدعم التحديث"); return; }
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, manual ? 30000 : 15000);
    if (manual) toast("جاري التحديث…");
    fetch(REMOTE_URL + "?t=" + Date.now(), { cache: "no-store", signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        var cl = parseInt(r.headers.get("content-length") || "0", 10);
        if (cl > 12e6) throw new Error("too big");
        return r.text();
      })
      .then(function (txt) {
        if (txt.length > 12e6) throw new Error("too big");   // حد أقصى قبل التحليل
        return JSON.parse(txt);
      })
      .then(function (d) {
        clearTimeout(timer);
        if (!validData(d)) { if (manual) toast("الملف غير صالح"); return; }
        if (d.version <= VERSION) { if (manual) toast("المحتوى محدّث (نسخة " + VERSION + ")"); return; }
        applyData(d);
        try { localStorage.setItem("remoteData", JSON.stringify(d)); } catch (e) {}
        buildQuotes();
        buildIndex();
        var top = stack[stack.length - 1];
        if (top.type === "item" && !ITEMS[top.key]) stack = [{ type: "home" }];
        if (top.type === "cat" && !CATS.some(function (c) { return c.id === top.id; })) stack = [{ type: "home" }];
        render();
        scheduleAll(false);
        toast("تم تحديث المحتوى (نسخة " + d.version + ")");
      })
      .catch(function (e) { clearTimeout(timer); if (manual) toast("تعذّر التحديث: " + (e && e.message ? e.message : "اتصال")); });
  }

  applyTheme();
  applyFont();
  render();
  setupNative();
  checkUpdate(false);
  setTimeout(prefetchCovers, 2500);
  window.addEventListener("online", function () { setTimeout(prefetchCovers, 1000); });
})();
