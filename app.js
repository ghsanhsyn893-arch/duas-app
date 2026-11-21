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
  var LAT = [{ id: "basem", n: "باسم الكربلائي", direct: { base: LAT_HOME + "sound-mp3/basem/basem", off: 15811 }, items: [[17420,"يا قلبي يا صابر علي من تكابر بعد ليلة وحده حبيبك يهاجر",20,"إصدار يقلبي يصابر"],[17419,"كل زلمنا الليلة يمنا من يطلع المصباح تطلع مهج وارواح",34,"إصدار يقلبي يصابر"],[17418,"حيرني الدهر بحسين وعلي ثقل همه",8,"إصدار يقلبي يصابر"],[17417,"حسين حسين يا حسين مولى .. جينا نمشي لكربلا مضيعينها",7,"إصدار يقلبي يصابر"],[17416,"يا مهدينا الضلع ما ننسى ثاره .. وعلي جدك علي هجموا لداره",18,"إصدار يا مهدينا الضلع"],[17415,"تندب زينب وتنادي بدمعات العين",4,"إصدار يا مهدينا الضلع"],[17414,"وجمرة السم غيرت هالوالي يا مسموم",9,"إصدار يا مهدينا الضلع"],[17413,"جابر ما دريت شصار بالطف ونواحيه",11,"إصدار يا مهدينا الضلع"],[17412,"ليش العالم احتار والقلب شب بنار",17,"إصدار يا مهدينا الضلع"],[17411,"يا مهدينا الضلع ما ننسى ثاره .. وعلي جدك علي هجموا لداره",28,"إصدار يا مهدينا"],[17410,"حنت وناحت فاطمة",3,"إصدار يا مهدينا"],[17409,"بالأحزان يصرخ علي والعبرات دم تهلي",11,"إصدار يا مهدينا"],[17408,"شكثر تصبر يا من صبرك جزع من عنده بتارك",10,"إصدار يا مهدينا"],[17407,"يا مدرك الثار البدار البدار شن على حرب عداك المغار",18,"إصدار يا مدرك الثار"],[17406,"مصايب شافت الزهرا بعمرها",11,"إصدار يا مدرك الثار"],[17405,"أرى قبراً به الزهرا أم المعصومة الحيرا",19,"إصدار يا مدرك الثار"],[17404,"يحق لمقلتي تهمي الدموعا على من رضضوا منها الضلوعا",15,"إصدار يا لما تنسى ثارك"],[17403,"يا لما تنسى ثارك ملينا انتظارك",27,"إصدار يا لما تنسى ثارك"],[17402,"فاطمة البسمار لمن صابها يا علي وجهت ليك عتابها",5,"إصدار يا لما تنسى ثارك"],[17401,"يا لعفتك بطف كربلا جيتك وياي العايلة",18,"إصدار يا لعفتك بطف"],[17400,"يالرضا بهاي المصيبة كم قلب يسعر لهيبه",28,"إصدار يا لعفتك بطف"],[17399,"دمك للمحب عبرة",5,"إصدار يا لعفتك بطف"],[17398,"هاك قصة هالمصاب وشاهده وانظر لحال العقيلة الماجدة",5,"إصدار يا لعفتك بطف"],[17397,"يا كنز علم المصطفى يا إمام لولاكم دين الهدى ما استقام",36,"إصدار يا كنز علم المصطفى"],[17396,"يا باب الحوائج يا إمام الكون سبع سنين ظليت بسجن هارون",5,"إصدار يا كنز علم المصطفى"],[17395,"يا باب الحوائج حاجتي يمك",9,"إصدار يا كنز علم المصطفى"],[17394,"هذا اللي صار بعد المختار غصبوا حقي وما رحموني وهجموا عالدار",13,"إصدار يا فاطمة"],[17393,"نتأمل يومك يا المهدي وصوتك ننتظره",14,"إصدار يا فاطمة"],[17392,"فضة بحزنها تنادي مظلومة بنت الهادي",15,"إصدار يا فاطمة"],[17391,"هذا صوت حسين ظهر من نحره يخاطب البضعة يقله يا الزهرا",5,"إصدار يا فاطمة"],[17390,"أنوحن والمدامع عالوجن نهرا",6,"إصدار يا فاطمة"],[17389,"أم الحزن زينب يم القتل مرحب",16,"إصدار يا فاطمة"],[17388,"أم أبيها من سينجيها من مآسيها",9,"إصدار يا فاطمة"],[17387,"الواثبين لظلم آل محمد ومحمد ملقى بلا تكفين",7,"إصدار يا فاطمة"],[17386,"مولاي علي خير ولي فارس خيبر",12,"إصدار يا علي"],[17385,"علياً يا علياً يا علياً يا علياً",13,"إصدار يا علي"],[17384,"طول الوداع الوصي",7,"إصدار يا علي"],[17383,"أمير المؤمنين يا شاه مردان",14,"إصدار يا علي"],[17382,"علي يا علي .. رزء به الدين قد هدت قوائمه",10,"إصدار يا علي"],[17381,"جمال الكون بشفافك القلب مفتون باوصافك",9,"إصدار يا علي"],[17380,"انت نبراس الكرامة بس الك تحلى الزعامة",22,"إصدار يا علي"],[17379,"أنا حبي علي وغرامي علي",11,"إصدار يا علي"],[17378,"لو تنشد عن اول زاير بالناس راح وقصده ينول زيارة عباس",16,"إصدار يا عباس"],[17377,"اجيتك والدمع يهمي",14,"إصدار يا عباس"],[17376,"يا ريح الهاب وياك وديني ازور حباب غياب عن عيني",18,"إصدار يا عباس"],[17375,"يا حسين أطفالك بحمايه عطشانة وتنظره",14,"إصدار يا عباس"],[17374,"هاي اطفالي تنظر جودك هاي اطفالي",9,"إصدار يا عباس"],[17373,"العلم عالقاع يا حيدر يا بوي ومنك اتعذر",17,"إصدار يا عباس"],[17372,"يا حِمانا يا رجانا غيبوا بدرك ضيعوا قبرك",40,"إصدار يا حِمانا"],[17371,"كبد الحسن متقطعة بسم المنية",8,"إصدار يا حِمانا"],[17370,"يا بن من دمه جرى بمحرابة الحسن عمك",8,"إصدار يا حِمانا"],[17369,"من البين يا حسين من صغري وشاب الراس",11,"إصدار يا حسين"],[17368,"محتار كم لوعة شفت محتار امشي والتفت",11,"إصدار يا حسين"],[17367,"لا تسل ماذا جرى إنه دمي جرى",13,"إصدار يا حسين"],[17366,"كل قطرة دم بشرياني تهتف باسمك يا حسين",23,"إصدار يا حسين"],[17365,"قلي يا الميمون وين والينا راح ابو السجاد لو يرد لينا",10,"إصدار يا حسين"],[17364,"قد أوهنت جلدي الديار الخالية",8,"إصدار يا حسين"],[17363,"يا موعود يوم الثار هاليوم",15,"إصدار يا بنت موسى"],[17362,"أبكيت عين السما يا بنت موسى فما يبكي بكائي دما اذ انت للجبار من اعظم الاسرار",22,"إصدار يا بنت موسى"],[17361,"رسول الله بغيابه وصى بالعترة",11,"إصدار يا بنت موسى"],[17360,"يا كرار بالشدة طحنا يا كرار أولادك احنا",10,"إصدار يا باب فاطمة"],[17359,"يا شيعتي يا شيعتي ما تطفى نار مصيبتي",13,"إصدار يا باب فاطمة"],[17358,"يا باب فاطمة جريح ندوبه عادت بقلب المسلمين جروحا",6,"إصدار يا باب فاطمة"],[17357,"ضلع الشمس مكسور",13,"إصدار يا باب فاطمة"],[17356,"قل للمغيب تحت أطباق الثرى.. إن كنت تسمع صرختي وندائيا",7,"إصدار يا باب فاطمة"],[17355,"سل أربعاً فطمت أكنافها السحب عن ساكنيها متى عن أفقها غربوا",8,"إصدار يا باب فاطمة"],[17354,"حيدر.. اسم تعشقه الأسماء",9,"إصدار يا باب فاطمة"],[17353,"حرت وعيوني ما ينشف دمعها صدق ام الحسن كسروا ضلها ؟ اريد تجاوبوني",15,"إصدار يا باب فاطمة"],[17352,"يا أم البنين .. لا تدعوني ويك ام البنين",4,"إصدار يا أم البنين"],[17351,"حزناً بكينا لما رأينا مصيبة السجاد",23,"إصدار يا أم البنين"],[17350,"تصيح ام البنين الهم لفاني",10,"إصدار يا أم البنين"],[17349,"أنا ام البنين وعهدي وفيته وبالاربعة قلب الزهرا واسيته",5,"إصدار يا أم البنين"],[17348,"أم البنين بهالاسم بارينا سماها",15,"إصدار يا أم البنين"],[17347,"عشاق الحسين عشاق الحسين .. خذ يا سيدي عهد الوفا والله يشهد",7,"إصدار وينك يا غايبنه"],[17346,"من نوصل لعباس تتعطر الانفاس",25,"إصدار وينك يا غايبنه"],[17345,"صرختها ما بين الجمع يا أبت قد كسروا ضلعي",13,"إصدار ويل لمن عاداها"],[17344,"فاطم الزهراء ستحضر فانتبهوا يا أهل المحشر",22,"إصدار ويل لمن عاداها"],[17343,"آه واويلاه ماتت فاطمة وبالحزن والنوح ظل حامي الحمى",6,"إصدار ويل لمن عاداها"],[17342,"شيعوا نعش الطاهرة المظلومة وداعة الله صيحوا يا مهضومة",7,"إصدار ويل لمن عاداها"],[17341,"يا شايل نعش الوالي ريض مشيتك",11,"إصدار ولي الله"],[17340,"واعليا واشهيدا وامظلوما.. يا سيف الطبر والينا",6,"إصدار ولي الله"],[17339,"آه عليك يا المرتضى",7,"إصدار ولي الله"],[17338,"سيف الله انطبر بالسيف وتخضب بمحرابه",10,"إصدار ولي الله"],[17337,"رأسك أم قلبك المختار قد خضب عرض الجبار",12,"إصدار ولي الله"],[17336,"داحي الباب شلون انصاب",13,"إصدار ولي الله"],[17335,"جينا لارض النجف ودخلناها بقعة من جنة عدن شفناها",9,"إصدار ولي الله"],[17334,"الفضا تغير عقب حيدر قلت يظهر بدا المحشر",9,"إصدار ولي الله"],[17333,"I wanted you to stay .. Ali",8,"إصدار ولي الله"],[17332,"وعدك وينه وعدك وينه صاحت زينب وعدك وينه",32,"إصدار وعدك وينه"],[17331,"زينب وتحشم واليها",7,"إصدار وعدك وينه"],[17330,"آه يا حسين ومصابه.. لاجله العين سكابه",12,"إصدار وعدك وينه"],[17329,"تحلى الراية بس لكفك تحلى الراية",6,"إصدار وعدك وينه"],[17328,"وسط القلب يا حسين نارك وناري شيطفي هالنارين نارك وناري",33,"إصدار وسط القلب"],[17327,"الليلة اندفن جسم الحسن تسبح مدامعنا دموم",16,"إصدار وسط القلب"],[17326,"أغرى اللعين جعدة والسم انبث قطعت كبد الحسن",5,"إصدار وسط القلب"],[17325,"يا الهادي ارد احكيلك مصيبتي يا بوي وارد اشرح هضم محنتي",7,"إصدار وديعة خليلك"],[17324,"وديعة خليلك اجت تشتكيلك حزينة بوجودك يا حامي دخيلك",26,"إصدار وديعة خليلك"],[17323,"تمنيت الأجل يا بوي يلفيني",7,"إصدار وديعة خليلك"],[17322,"سيدتي فاطمة يا زهراء بليل أظلم طلبت يدفنوها",8,"إصدار وديعة خليلك"],[17321,"هذا انت عباس هذا انت يا ابن الكرار",11,"إصدار وحي القوافي"],[17320,"يا دنيا ما ظل والي حتى اطفالي راحوا تالي يا دنيا هضموا حالي",11,"إصدار وحي القوافي"],[17319,"للعباس اجت زينب وطفل حسين وياها",13,"إصدار وحي القوافي"],[17318,"صلى عليك مليك السماء جسم صريع بالعراء",12,"إصدار وحي القوافي"],[17317,"شيعتي يا كرام يا عظام المقام فاندبوا يا حسين بفؤاد حزين",13,"إصدار وحي القوافي"],[17316,"حسين حسين غريب غريب يا ابن البتول الشافعة يا ابن الوديعة تودعه",13,"إصدار وحي القوافي"],[17315,"يا بو السبطين جيت بلا عين يا حيدر بقطع الكفين ما عفت حسين",13,"إصدار وجود الوجود"],[17314,"هل هو سر في ذاتي أم هو صومي وصلاتي",15,"إصدار وجود الوجود"],[17313,"لا السجن يحجبه ولا السجان نار الكليم ونوره صنوان",14,"إصدار وجود الوجود"],[17312,"حسين يا حسين .. سبحان الذي أسرى من مثواك بالأسرى والسجاد في المسرى للشامات",6,"إصدار وجود الوجود"],[17311,"جابر ما دريت شصار بالطف ونواحيه وما تدري خدر زينب راح ومشت مسبية",13,"إصدار وجود الوجود"],[17310,"بالله استعدي للبواكي يا ام البنين ردوا يتامى وانذبح عباس وحسين",7,"إصدار وجود الوجود"],[17309,"وافطمتاه .. واعجبا يستأذن الأمين عليهم ويهجم الخؤون - ورا الباب اختفت فاطم",8,"إصدار وافاطمتاه"],[17308,"ما ننسى مصابك يا الزهرا بنت المختار المعصومة",3,"إصدار وافاطمتاه"],[17307,"حرت وعيوني ما ينشف دمعها صدق ام الحسن كسروا ضلها ؟ اريد تجاوبوني",8,"إصدار وافاطمتاه"],[17306,"تبكيك عيني عبرة ساجمة يا زهرة الفردوس يا فاطمة",6,"إصدار وافاطمتاه"],[17305,"الدهر عقبك غدر بينا يا هادينا يا هادينا",7,"إصدار وافاطمتاه"],[17304,"يا يوم علي حسبنا الله وللقلب نداء واعلياه",13,"إصدار واعليا"],[17303,"يا شايلين النعش رحتوا بالنعش وين ؟ ما تسمعوني الحسن هل يصرخ والحسين",6,"إصدار واعليا"],[17302,"ناعي الموت صاح ونعى الله من هالفاجعة",9,"إصدار واعليا"],[17301,"غيل مولانا غاب رجوانا واعليا واعليا",17,"إصدار واعليا"],[17300,"تهدمت والله أركان الهدى",3,"إصدار واعليا"],[17299,"يا حسين يا شهيد يا تريب الخد في أرض الطفوف",11,"إصدار واحسيناه"],[17298,"واذبيحا غسلته الماضيات واحسينا واقتيلا كفنته الذاريات",8,"إصدار واحسيناه"],[17297,"حسينا واحسينا واحسينا واحسينا",10,"إصدار واحسيناه"],[17296,"حسين حسين حسين حسيناه.. بكتك أملاك السما يا حسين",7,"إصدار واحسيناه"],[17295,"انا الغريب بقيت بين آل امية جيش برجال وخيل داروا علي",10,"إصدار واحسيناه"],[17294,"أناشدكم واريد تجاوبوني إمام بيا شريعة تحاربوني",12,"إصدار واحسيناه"],[17293,"يا حبيبي يا حسين نور عيني نور عيني يا حسين",8,"إصدار هو الروح"],[17292,"هو الروح نادى فأبكى السماء علي توضا بفيض الدماء",24,"إصدار هو الروح"],[17291,"علي خير من صلى وصاما علي باسمه الدين استقاما",22,"إصدار هو الروح"],[17290,"آه واويلاه يا شيعة علي",11,"إصدار هو الروح"],[17289,"يا شيعتي يا شيعتي ما تطفا جمرة لوعتي",9,"إصدار هنا يا جابر"],[17288,"لمن دفن جثة عزيز الزهرا كم طعنة شاف بهالجسد كم طبرة",18,"إصدار هنا يا جابر"],[17287,"هذي جسوم أم أقمار وتلك نار أم أنوار ؟",12,"إصدار هنا يا جابر"],[17286,"عالغاضرية الضعن لمن أشرف بيا حالة وبيا عين صدوا للطف",15,"إصدار هنا يا جابر"],[17285,"يحق لمقلتي تهمي الدموعا على من رضضوا منها الضلوعا",19,"إصدار هل أنبأ المسمار"],[17284,"هل أنبأ المسمار خير الورى هل حدثته الباب عما جرى",28,"إصدار هل أنبأ المسمار"],[17283,"يا الكاظم بحبك هتف وجداني وباسمك يردد قلبي ولساني",7,"إصدار هذا الغريب"],[17282,"وين اليقصد ويسكب الدمعة وبصوت الحزن من بعد ينعى",7,"إصدار هذا الغريب"],[17281,"هذا الغريب منين وين اهله راحوا وين ؟",26,"إصدار هذا الغريب"],[17280,"جينا ننشد كربلا مضيعينها بيها زينب قالوا ميسرينها",5,"إصدار هذا الغريب"],[17279,"آه عليك يا المرتضى",2,"إصدار هاي الادوار"],[17278,"يا معبود متى يعود مهدينا",8,"إصدار نوحي"],[17277,"نوحي على الأولاد يا زهرا الحزينه واحد في كربلا وواحد في المدينة",23,"إصدار نوحي"],[17276,"عترة صاف منبعهم خاسر من لا يتبعهم",31,"إصدار نوحي"],[17275,"صار الفرح نوح ودمع طفوا الشمع طفوا الشمع",22,"إصدار نوح ودمع"],[17274,"وينك يا داحي الباب بوي يا بوي",10,"إصدار نداء الروح"],[17273,"هاك اسمع نداء الروح ما بين العرش والروح",13,"إصدار نداء الروح"],[17272,"رب العرش وياك والمصطفى وصاك",16,"إصدار نداء الروح"],[17271,"ويلي على المسموم ويلي على المهموم",4,"إصدار نجمة سهيل"],[17270,"لا تلومني لو هاجت احزاني يا سلمان",7,"إصدار نار بين الأضلاع"],[17269,"آه واويلاه يا أم البنين جئت من غدر زماني أحتمي",8,"إصدار نار بين الأضلاع"],[17268,"إذا ضاقت بنا الدنيا نناديها وكم من حاجة بالله تقضيها",9,"إصدار نار بين الأضلاع"],[17267,"يا آل قومي عدنا إليكم والدمع يجري حزناً عليكم",24,"إصدار نار"],[17266,"هضموني هضموني يا بوي هضموني سكنة العزيزة وسلوتك",14,"إصدار نار"],[17265,"نار نار قلبي العطشان نار فقد الوليان",20,"إصدار نار"],[17264,"العلم عالقاع يا حيدر يا بوي ومنك اتعذر",14,"إصدار نار"],[17263,"يا الاربعة الطيبين ودعوني ودعوني خل يضل يمي حسين بعيوني بعيوني",17,"إصدار منبع الآهات"],[17262,"يا دنيا مهلاً ودعيني أجري عبراتي لبنيني",7,"إصدار منبع الآهات"],[17261,"أبد والله يا زهرا ما ننسى حسينيا",3,"إصدار منبع الآهات"],[17260,"لفقده مدامعنا دما نجريها وراية حزن عالية نخليها",12,"إصدار مصاب الباقر"],[17259,"ما ننسى مصاب الباقر ما ننسى بفيض الدمع والعبرى نبقى نجدد ذكراه",24,"إصدار مصاب الباقر"],[17258,"دمعي على الخدين حزناً هما لباقر العلم والمسلما",13,"إصدار مصاب الباقر"],[17257,"هذا انت خوي وهاي فضوة خيمنا والشاطي ما هو بعيد ها وينا يمنة",9,"إصدار لن ننسى"],[17256,"عشاق الحسين عشاق الحسين .. خذ يا سيدي عهد الوفا والله يشهد",8,"إصدار لن ننسى"],[17255,"آه واويلاه يا أم البنين جئت من غدر زماني أحتمي",2,"إصدار لن ننسى"],[17254,"أبد والله لن ننسى حسيناً وذا عهد ومعهود علينا",25,"إصدار لن ننسى"],[17253,"يا بو السبطين جيت بلا عين يا حيدر بقطع الكفين ما عفت حسين",36,"إصدار للعباس أجت زينب"],[17252,"قلبي عاشق كربلا شلون افارق كربلا",5,"إصدار للعباس أجت زينب"],[17251,"يا حيدر بباب الدار تسمع صرختي ووني ما تنهض تحاميني شنهو العوقك عني",15,"إصدار لحن الدماء"],[17250,"يا قل هو الله أحد يا با الحسن هاك العهد ما نعوف حبك للأبد",10,"إصدار لحن الدماء"],[17249,"قتلى يحن اليها البيت والحجر شوقاً وتبكيهم الآيات والسور.. أين الحسين وقتلى من بني حسن",9,"إصدار لحن الدماء"],[17248,"يا بحر الدمع حاكيني وين القى الصبر دليني",12,"إصدار لحن الدماء"],[17247,"إلهي باسمك الاعظم واسراره الهي رد غريب الدار لدياره",11,"إصدار لحن الدماء"],[17246,"يا مدرك الثار البدار البدار شن على حرب عداك المغار",9,"إصدار لحن الدماء"],[17245,"أرضي الجراح وكربلاء سمائي ولواء مقطوع اليدين لوائي",6,"إصدار لحن الدماء"],[17244,"مهلاً مهلاً يا ابن الزهرا .. هذا علي المرتضى تبكي له الزهراء",17,"إصدار لبيك يا حسين"],[17243,"عابس يصيح بصوت يا من تسمعوني جنني حب حسين لا لا تلوموني",16,"إصدار لبيك يا حسين"],[17242,"طلعن خوات حسين طلعن يسألنه وحدك اجيت النا وين التكفلنا",13,"إصدار لبيك يا حسين"],[17241,"ريحانة المصطفى يا كعبة للوفا المجد فيك اكتفى يا ساكناً في الروح",18,"إصدار لبيك يا حسين"],[17240,"حيدر يا حيدر حيدر .. لحسين نحن عشقنا وبصوت الحق نطقنا",8,"إصدار لبيك يا حسين"],[17239,"لا تنسوني يا شيعة شكد هضموني يا شيعة",25,"اصدار لا تنسوني يا شيعه"],[17238,"نحبه انقضى وما حضر واحد يمه بس ابن عمه",5,"اصدار لا تنسوني يا شيعه"],[17237,"تلك الأضاحي من بني عمرو العلا قد مزقوها بالقنا في كربلا",18,"اصدار لا تنسوني يا شيعه"],[17236,"جرى سر الإله وليت شعري دماء أم شعاع العرش يجري",17,"اصدار كليم الحسين"],[17235,"هالنوح يا زهرا على منهو تنوحين نوحك على المسموم لو نوحك على حسين",9,"اصدار كليم الحسين"],[17234,"يا من تساق المنايا طوع راحته",9,"اصدار كليم الحسين"],[17233,"ها هي الهيجاء في صدر السماء ونجوم في مضامير الوغا تستبق",9,"اصدار كليم الحسين"],[17232,"أبا الحسن يا علي بن موسى الرضا",8,"اصدار كليم الحسين"],[17231,"أنت القرآن ومعناه وعلى جرحك صلى الله",4,"اصدار كليم الحسين"],[17230,"الليلة اندفن جسم الحسن تسبح مدامعنا دموم",5,"إصدار كلهم أولادي"],[17229,"ما ننسى رقية وهضم لوعتها",9,"إصدار كلهم أولادي"],[17228,"لأبكين عليك بدل الدمع دماً",26,"إصدار كلهم أولادي"],[17227,"هالنوح يا زهرا على منهو تنوحين نوحك على المسموم لو نوحك على حسين",10,"إصدار كلهم أولادي"],[17226,"يا حبيبي يا حسين نور عيني نور عيني يا حسين",11,"إصدار كلهم أولادي"],[17225,"يا تريب الخد في رمضا الطفوف ليتني دونك نهباً للسيوف",10,"إصدار كسروا ضلعها"],[17224,"الوادم لو لفاها الليل تعد الليل للونسة",5,"إصدار كسروا ضلعها"],[17223,"شحالها شافت اخوها بعينها جثته بدم ركبته مغسلينها",21,"إصدار كسروا ضلعها"],[17222,"يا شاطي الموت حاكيني انا العباس تدريني اريد الماي",10,"اصدار كربلاء"],[17221,"والله لن أنساك يا كربلا لو قطعوني مفصلاً مفصلاً",13,"اصدار كربلاء"],[17220,"لبيك يا حسين لبيك يا حسين هالصرخة باسمك سيدي رفعناها حسين حسين",5,"اصدار كربلاء"],[17219,"كربلائي أنا كربلائي أنا بل حسيني أنا بل حسيني أنا",11,"اصدار كربلاء"],[17218,"عشاق الحسين عشاق الحسين .. خذ يا سيدي عهد الوفا والله يشهد",6,"اصدار كربلاء"],[17217,"تنذبح ظامي خابت احلامي وانا كانت ظنتي انت تحضر دفنتي",10,"اصدار كربلاء"],[17216,"بالخيم فرحة وبشاير بالحرب خيل وعساكر وانت يا جسام حاير",14,"اصدار كربلاء"],[17215,"يا حسين من العين حبك ينبع مجراه",10,"اصدار كربلاء"],[17214,"يا حسين ما تنشف بعد دمعتي سهم اللي صابك صابني بكبدتي",11,"إصدار كان موسى"],[17213,"يا المهدي يومك صار تترقبك أنظار عين الطليعة",10,"إصدار كان موسى"],[17212,"يا أيها النبأ العظيم إليك في ابنيك مني أعظم الأنباء",12,"إصدار كان موسى"],[17211,"قسماً بدمائك يا حيدر وبشبلك محزوك المنحر ماض بولائي",12,"إصدار كان موسى"],[17210,"حماي الدخل يا حسين كل الوادم يشهدون",15,"إصدار كان موسى"],[17209,"الك قلبي انفجع عبد الله يا بني احس نحري انقطع عبد الله يا بني",8,"إصدار كان موسى"],[17208,"The Symbol of Streth",7,"إصدار كان موسى"],[17207,"يا شيعتي رغم عداي وقت العطش ذكروني",12,"إصدار قوس السماء"],[17206,"تلطم الناس صدوراً بالكفوف وأنا ألطم رأسي بالسيوف",11,"إصدار قوس السماء"],[17205,"كل قطرة دم بشرياني تهتف باسمك يا حسين روحي شلون تظل بجسمي من اذكر جسمك يا حسين",20,"إصدار قوس السماء"],[17204,"طفح الدمع وقال أنت قوس أم هلال",7,"إصدار قوس السماء"],[17203,"طفلة وشفت حيدر جدي من ارض النجف حاضر عندي",16,"إصدار قوس السماء"],[17202,"حيرني الدهر بحسين وعلي ثقل همه لا أقدر اعوفنه ولا اقدر اظل يمه",11,"إصدار قوس السماء"],[17201,"إن قتلونا أو تركونا فالأمر موحد دمنا قرر لن نتغير عن آل محمد",16,"إصدار قوس السماء"],[17200,"نطبرهامة بسيف وقامة ننزل موكب للتطبير",11,"إصدار قوس السماء"],[17199,"يا شيعتي يا شيعتي ما تطفا نار مصيبتي قلبي حزن لاجل الحسن",26,"إصدار قلبي حزن"],[17198,"يا جفني صب دمعك دما لفقد الحسن ومصيبته",6,"إصدار قلبي حزن"],[17197,"هذا انت خوي وهاي فضوة خيمنا والشاطي ما هو بعيد ها وينا يمنة",12,"إصدار قلبي حزن"],[17196,"لبيك يا حسين لبيك يا حسين هالصرخة باسمك سيدي رفعناها حسين حسين",8,"إصدار قلبي حزن"],[17195,"على المسموم مهمومة حسن مظلوم من يومه",6,"إصدار قلبي حزن"],[17194,"حسين حسين يا ابني الما كنت يمه.. غايب عني نور العين غايب عني",9,"إصدار قلبي حزن"],[17193,"بالطف لو كنت موجود يوم العاشر بعاشور .. تلقى الغايب الموعود يم حسين جده يزور",13,"إصدار قلبي حزن"],[17192,"وصيتي يا أمتي تمسكوا بعترتي",8,"إصدار قد مات محمد"],[17191,"وا أسفاً وا أسفا آه لفقد المصطفى",15,"إصدار قد مات محمد"],[17190,"هذا رسول الله صوت الأسى ينعاه",20,"إصدار قد مات محمد"],[17189,"إن مات محمد أو حجبا تنقلب الأمة منقلباً",31,"إصدار قد مات محمد"],[17188,"عباس قربت ساعة اللترجاها هذي اليتامى تلوج يا ضنواها",12,"إصدار فيه أحتار القلم"],[17187,"فيه احتار القلم عنه يروي العلم يمناه يسراه بحران لله",27,"إصدار فيه أحتار القلم"],[17186,"غيرتك ولواك والنهار ناداك منك يريد الجود هذا ونظر وزنود",25,"إصدار فيه أحتار القلم"],[17185,"يا عباس جيب الماي لسكينة",8,"إصدار فدوى للحسين"],[17184,"يا حسين يا حسين عشاقك يسمونا",10,"إصدار فدوى للحسين"],[17183,"فدوى لحسين أقدم كل بنيني وانسى الهموم لو ان سالم يجيني",15,"إصدار فدوى للحسين"],[17182,"حب حسين يسري بدمي",16,"إصدار فدوى للحسين"],[17181,"يا صاحب الراية سلملي جهدك شلك بالعلقمي ومايه",17,"إصدار فدوى للحسين"],[17180,"أخبرك يا رسول الله الجفن ما فارق العبرة",13,"إصدار فدوى للحسين"],[17179,"لا تلومني لو هاجت احزاني يا سلمان",11,"إصدار فاطم معناها طه"],[17178,"فاطم معناها طه قد أذاه من آذاها",32,"إصدار فاطم معناها طه"],[17177,"إن جن ليلي مقلتي يجري الأسى فيها جمراً يحاكيها يبكي ويبكيها",9,"إصدار فاطم معناها طه"],[17176,"عضيدك انا وابن امك اجيتك للدفن يمك",16,"إصدار غضبة الجبار"],[17175,"يا شيعتي ما تطفا جمرة لوعتي",21,"إصدار غضبة الجبار"],[17174,"ثأر مضى فات الزمن يا ابن الحسن .. صبت مصائب وأنت غائب يا غضبة الجبار",39,"إصدار غضبة الجبار"],[17173,"ابكي على اولادي فنوا بالسيف والسم وابكي على بوهم قتيل لابن ملجم",8,"إصدار غريب طوس"],[17172,"مهمومة هالليلة الروح ما تدري لا وين تروح",43,"إصدار غريب طوس"],[17171,"لمصيبته نواسي الرسول وعترته",12,"إصدار غريب طوس"],[17170,"من مقلتي تجري دما أبكي غريب الدار",26,"إصدار غريب الدار"],[17169,"لبو محمد غريب الدار",6,"إصدار غريب الدار"],[17168,"على الكاظم لنوحن واجذب الونة",7,"إصدار غريب الدار"],[17167,"بلهفة وحنين قصدنا لزيارتك غربة وأخذنا الشوق يم حضرتك يا علي",9,"إصدار غريب الدار"],[17166,"يا حسين هاي عيالك يا حسين هاي اطفالك",11,"إصدار عودة السبايا"],[17165,"من اليسر يا عباس رجعت ضعوني اقعد يا راعي النوماس عاين متوني",15,"إصدار عودة السبايا"],[17164,"قف بالطفوف وجد بفيض الأدمع إن كنت ذا حزن وقلب موجع",13,"إصدار عودة السبايا"],[17163,"ذبيح مسلب ابن امي مشيت وعفته عالغبرا",13,"إصدار عودة السبايا"],[17162,"يومك فجعنا يا بو حسين يا بو حسين",13,"إصدار عالمشرعة خليني"],[17161,"عد من عفتني يا عباس يا عباس",17,"إصدار عالمشرعة خليني"],[17160,"عزتنا عزتنا بالكرار عزتنا",23,"إصدار عالمشرعة خليني"],[17159,"عالمشرعة خليني جسم القمر لمن طاح أدركني يا خوي صاح",7,"إصدار عالمشرعة خليني"],[17158,"صلى عليك مليك السماء جسم صريع بالعراء",39,"إصدار ضمير الجماد"],[17157,"أمسى المسا والنار ما خلت لنا خيام",9,"إصدار ضمير الجماد"],[17156,"أنا زينب وانت راعي الراية من السبي يا با الفضل شكاية",8,"إصدار صوت الراية"],[17155,"نستنكر كل رموز الإرهاب كيف تفجر أضرحة الأطياب",34,"إصدار صبرا يا آل محمد"],[17154,"زينب تلطم على الراس وتنادي يا مهر حسين",15,"إصدار صبرا يا آل محمد"],[17153,"النوايب صوبني عليل ونايبات الطف لوني",14,"إصدار صبرا يا آل محمد"],[17152,"جفت ينابيع الجود فاض الدمع جاريه",14,"إصدار صبر الحسن"],[17151,"بين الأسى والشجن قد غاب بدر السنن مات الإمام الحسن ريحانة المؤتمن",35,"إصدار صبر الحسن"],[17150,"الله يا حامي الشريعة الله أتقر وهي كذا مروعة الله يا حامي الشريعة",12,"إصدار صبر الحسن"],[17149,"قل لابن العسكريين انا عراقي",15,"إصدار صادق القول"],[17148,"أنا جعفر قال لنا صادق القول أنا حجة الله وقلبي قد براه مسجداً",25,"إصدار صادق القول"],[17147,"يا صاحب العصر الأمان الأمان من هذه الدنيا وهذا الزمان",7,"إصدار شهالعجايب"],[17146,"شهالعجايب وانت غايب يا المهدي شفنا غيوم تمطر دمع وهموم",29,"إصدار شهالعجايب"],[17145,"أخاف من اعوفك بعد ما أشوفك إذا ما تجيني أقدر ظروفك",17,"إصدار شهالعجايب"],[17144,"أبد والله يا زهرا ما ننسى حسينيا",8,"إصدار شهالعجايب"],[17143,"يا من بكيت على أم البنين دماً أبشر بجنة عدن تذهب الألما",15,"إصدار شمس العزة"],[17142,"من ذا يعين أم البنين بدموع فيواسي طه أبكى الزهراء بكاها",13,"إصدار شمس العزة"],[17141,"ليش ما وصتهم يشيعوها ويم ولدها الأربع يدفنوها",4,"إصدار شمس العزة"],[17140,"لا تدعوني ويك أم البنين تذكريني بليوث العرين",6,"إصدار شمس العزة"],[17139,"غابت شمس العزة والإيثار نار بين الأضلاع ولهذا صاح الناعي ماتت أم الأربعة الأطهار",19,"إصدار شمس العزة"],[17138,"السلام عليك يا أم البنين",14,"إصدار شمس العزة"],[17137,"يا لوعة الزهرا صاحت يا بو العترة لوعني فرقاك بوي",38,"إصدار شجون فاطمة"],[17136,"حسين حسين يا ابني الما كنت يمه.. غايب عني نور العين غايب عني",11,"إصدار شجون فاطمة"],[17135,"شيعة حسين الغريب بكربلا بساعة الموت اصبحوا انصار اله",20,"إصدار شجون فاطمة"],[17134,"يم الشريعة طايح لواكم بطيحة علمنا حرقوا خيمنا",14,"إصدار شجر الأراك"],[17133,"يا الغايب الك صدرين مكسورة يا مهدينا",10,"إصدار شاء القضاء"],[17132,"وحق اللي على عرشه تفرد بكل كبرياءه",22,"إصدار شاء القضاء"],[17131,"على كمدي على جلدي أعينوني أعينوني",34,"إصدار شاء القضاء"],[17130,"يا مهدينا أدركنا بالله لا تتركنا قم واهتف الثار الثار",13,"إصدار سواد الليل"],[17129,"يا عين جودي فوق الخدود ثم قولي عند المسير السلام على الكفيل",11,"إصدار سواد الليل"],[17128,"آه واويلاه يا أم البنين جئت من غدر زماني أحتمي",7,"إصدار سواد الليل"],[17127,"هايم بحبك انا يا ابن الزكية وما ازل عن حبك ليوم المنية",13,"إصدار سواد الليل"],[17126,"مسلم حاير ضل بالكوفة مسلم حاير ريتك حاضر يا بو الحملة ريتك حاضر",11,"إصدار سواد الليل"],[17125,"ضل يجري دمع العين عالراية والكفين",17,"إصدار سواد الليل"],[17124,"حرم عندي وحق جدي سواد الليل امهلوني",12,"إصدار سواد الليل"],[17123,"يا العايش بوسط الروح يا ساكن اصبي عيني",12,"إصدار سواد الليل"],[17122,"يا أيها المسموم هل أنت الغريب في داره أم جدك الهادي الحبيب",17,"إصدار سهم الغدر"],[17121,"ويلي على المسموم ويلي على المهموم",7,"إصدار سهم الغدر"],[17120,"هذا انت خوي وهاي فضوة خيمنا والشاطي ما هو بعيد ها وينا يمنة",8,"إصدار سهم الغدر"],[17119,"نعش الذي تشيع خله الصبر يجزع كل ما سهم يشرع نبع الغضب ينبع",27,"إصدار سهم الغدر"],[17118,"أغرى اللعين جعدة والسم انبث قطعت كبد الحسن",5,"إصدار سهم الغدر"],[17117,"يا حسين ارخصلك هالاخوة جربهم ساعات النخوة",27,"إصدار سلام على الخد التريب"],[17116,"سلام الله على الخد التريب .. سلام الله على الشيب الخضيب",28,"إصدار سلام على الخد التريب"],[17115,"حسين يا حسين ما بين الصفا ومروى تسعى بالحجيج الناس",11,"إصدار سلام"],[17114,"ما أنسى عاشور ذبحوا زلمنا حرقوا خيمنا",12,"إصدار سلام"],[17113,"لما هوى جسمك في كربلا تجسدت في قتلك الأنبياء",10,"إصدار سلام"],[17112,"عطشانة اليتامى يا شاطي السلامة.. نزلنا يمك ضيوف يريت امواجك تشوف",11,"إصدار سلام"],[17111,"ضيعتك من ايدي عبد الله يا وليدي",11,"إصدار سلام"],[17110,"طفلة وشفت بالنوم جن والدي المظلوم يمي ويحاكيني ويقلي كافي اللوم",12,"إصدار سلام"],[17109,"سلام سلام يا حسين على كل طعنة وكل طبرة بجسمك سلام سلام",9,"إصدار سلام"],[17108,"صحت شيصير ردت تفسير شفت بالطف هاي العجايب",11,"إصدار سلام"],[17107,"يوم راحوا كل هلي وما ظلت خيام وين اخوي حسين وينه",14,"إصدار سلام"],[17106,"المن هالشمع ولمن الحنه جاسم من دما نحره تحنا",10,"إصدار سلام"],[17105,"الجراحات والدم المطلول أين عكف الزمان منها خميل يا حسين",11,"إصدار سلام"],[17104,"إحنا انصارك من أفكار فكرتنا تظهر نرخص دمنا وتعلمنا بجامعة حيدر",9,"إصدار سلام"],[17103,"صوت النبي المصطفى لقبرك ظهر هاتفه يا المجتبى وينعاك",5,"إصدار سراب"],[17102,"صوت المنادي ناعياً أدمى قلوب الناس هذا فراق المجتبى لحسين والعباس",7,"إصدار سراب"],[17101,"هاليوم لاجل الحسن ومصيبته مالوم وتهل الدمع شيعته",8,"إصدار سراب"],[17100,"تسمو لتبكي في ألم ترنو خيالاً من علم روحي فتلثم تربك",3,"إصدار سراب"],[17099,"زينب نادتك يا حسين بهونك رايده تنشدك شيعنا اخوك اليوم",6,"إصدار سراب"],[17098,"قل لابن العسكريين انا عراقي",18,"إصدار سامراء كالبقيع"],[17097,"هي عيني لاحت وفؤادي يتقطع لمصاب الهادي قد أنّ الصخر لبلواه جمرة أحزاني تنعاه",17,"إصدار سامراء كالبقيع"],[17096,"عشاق الحسين عشاق الحسين .. خذ يا سيدي عهد الوفا والله يشهد",5,"إصدار سامراء كالبقيع"],[17095,"أندبوا الموعود بالقلب الفجيع إن سامراء صارت كالبقيع",8,"إصدار سامراء كالبقيع"],[17094,"تحكيلك الزوار ناشدها ناشدها يتلاله بالانوار مرقدها مرقدها طفلة رقية",13,"إصدار زيارات"],[17093,"يا القاصد لقبر حسين اوقف وانحني ببابه هل دمعك على الخدين واسجد قبل اعتابه",14,"إصدار زيارات"],[17092,"يا يوم اشوف اعتابك واوقف حزين بباك وارجع ازورك يا حيدر وارجع ازورك",15,"إصدار زيارات"],[17091,"معصومة هاي اخت الرضا هاي النجيبة ماتت غريبة فاطمة ماتت غريبة",11,"إصدار زيارات"],[17090,"بعينك لو ان ضاق الفضا اقصد يا زاير للرضا",14,"إصدار زيارات"],[17089,"هاي ام الاكبر هاي ساهر جفنها وتعاين من بعيد جثث ابنها",11,"إصدار روح الأمين"],[17088,"صرخة ضمير حشاي تسمع صداها",7,"إصدار روح الأمين"],[17087,"جاءت اليه من السماء وبكفها ثوب البهاء قالت وادمعها دماء خذ ثوب مجدك يا حسين",19,"إصدار روح الأمين"],[17086,"يا بني الضيعتني بضيعتك مني دوهني زماني بك دوهني",9,"إصدار ذكريات 2 - مع قدماء الرواديد"],[17085,"بعد غيبة طويلة رجع ضعن العقيلة يا بو فاضل تلقاها رجع ضعن العقيلة",20,"إصدار ذكريات 2 - مع قدماء الرواديد"],[17084,"علي يا علي أول رجل من الكون صدقت دعوة دينك",10,"إصدار ذكريات 2 - مع قدماء الرواديد"],[17083,"أنا ام البنين ودهري ذبني - مع حمزة الزغير",17,"إصدار ذكريات 2 - مع قدماء الرواديد"],[17082,"نار بدليلي تسعر ما تنطفي يا الاكبر",11,"إصدار ذكريات 1 - مع قدماء الرواديد"],[17081,"لأصرخن صراخاً فوق أعنان السماء لأبكين عليك بدل الدمع دما",14,"إصدار ذكريات 1 - مع قدماء الرواديد"],[17080,"سهم النايبة بعيني وين اللي يدليني درب المشرعة منين يا قطعة الكفين",15,"إصدار ذكريات 1 - مع قدماء الرواديد"],[17079,"يا وليدي خلي الماي لا تطلب الماي",9,"إصدار ذكريات 1 - مع قدماء الرواديد"],[17078,"يا معبود متى يعود مهدينا",4,"إصدار حيدر حضرها"],[17077,"السلام عليك يا أم البنين يا أماً للعباس مقطوع اليمين",9,"إصدار حيدر حضرها"],[17076,"أم الشبيبة ماتت كئيبة بوحشة قبرها حيدر حضرها",17,"إصدار حيدر حضرها"],[17075,"صحنا وبدمع حزين يا أمير المؤمنين يا إمام الأمة يا خير العباد",4,"إصدار جرحك جدد كل جروحي"],[17074,"جرحك جدد كل جروحي هاي الليلة زينب انا ولاجلك نوحي هاي الليلة",22,"إصدار جرحك جدد كل جروحي"],[17073,"دار المرتضى بهاليوم ظل بس الحزن بيها",9,"إصدار جرح علي"],[17072,"بالأحزان يصرخ علي والعبرات دم تهلي",9,"إصدار جرح علي"],[17071,"يا حادي عشر نور بسما العصمة واختارك الباري تاسع اليمة",7,"إصدار جرح جبدك"],[17070,"صوت جبريل ينادي شيعوا نعش الجواد",12,"إصدار جرح جبدك"],[17069,"شكثر تصبر يا من صبرك جزع من عنده بتارك",8,"إصدار جرح جبدك"],[17068,"ذوبت يا بن المصطفى قلبي من بكاك",7,"إصدار جرح جبدك"],[17067,"جرح كبدك حفر لحدك متت وحدك مثل جدك",29,"إصدار جرح جبدك"],[17066,"يا حسين حادي ضعونا عزم على الشيل",6,"إصدار جرح الحبيب"],[17065,"ويلي على المسموم قضى العمر مهموم",5,"إصدار جرح الحبيب"],[17064,"يا حبيبي يا حسين نور عيني نور عيني يا حسين",10,"إصدار جرح الحبيب"],[17063,"زينب بالمعارة تصيح وما ظل من ولي عندي",5,"إصدار ثبت حق لدينا"],[17062,"ثبت الحق لدينا وبذكراك اهتدينا",18,"إصدار ثبت حق لدينا"],[17061,"اسمع ينادي حسين لا تنسوني يا شيعتي بشرب العذب ذكروني",22,"إصدار ثبت حق لدينا"],[17060,"يا حسين للدين انت روحه وذاته دمك كتاب الله حفظ آياته",6,"إصدار ترفق أيها السيف"],[17059,"ترفق أيها السيف الصقيل أتدري يا ترى من ذا قتيل",26,"إصدار ترفق أيها السيف"],[17058,"ترفق أيها السيف الصقيل أتدري يا ترى من ذا قتيل",7,"إصدار ترفق أيها السيف"],[17057,"التفت واصرخ يا حماي الضعينة يا عباس يا عباس",11,"إصدار ترفق أيها السيف"],[17056,"يا شاطي الموت حاكيني انا العباس تدريني اريد الماي",24,"إصدار تأريخ الاحزان"],[17055,"هاك دمع عيني يا أم الحسين .. لك في الأحشاء قبر كلما مر الزمان",19,"إصدار تأريخ الاحزان"],[17054,"لا صبر يا بن العسكري فشرعة الهادي النبي استنصرت انصارها",7,"إصدار تأريخ الاحزان"],[17053,"سوري البنيته طايح لقيته .. يا ابني يا علي من بين ايدي تروح",12,"إصدار تأريخ الاحزان"],[17052,"تاريخ الأحزان جروحي أنا فاطم أم المذبوح",26,"إصدار تأريخ الاحزان"],[17051,"ماذا غدا يجري يا طلعة الفجر لا تهجعي وابك معي يا طلعة الفجر",10,"إصدار بني هاشم"],[17050,"وحرام تستريح أيها الجفن الجريح إن بي قلب يصيح يا حبيبي يا حسين",13,"إصدار بني هاشم"],[17049,"ليلاً ونهاراً من مكة سار حسين ذو اللواء ومصباح السماء",9,"إصدار بني هاشم"],[17048,"سافر عزيز الزهراء للغاضرية ويا بنين الطيبين هاي المسية",8,"إصدار بني هاشم"],[17047,"يا عباس يا ضوى عيوني يا عباس رجعت ضعوني",10,"إصدار بني هاشم"],[17046,"الله الله .. عاشت بنو هاشم بالحسين نفديهم بالروح واليدين",8,"إصدار بني هاشم"],[17045,"الوداع حسين يا بن امي الوداع باشر ابقى محيرة والخيم متوجرة",9,"إصدار بني هاشم"],[17044,"نزلت ضيوم الفاجعة عالمشرعة وراعي العلم جف النهر من منبعه",8,"إصدار بني هاشم"],[17043,"يحق لمقلتي تهمي الدموعا على من رضضوا منها الضلوعا",10,"إصدار بنت محمد"],[17042,"يا الما تنسى ثارك ملينا انتظارك",13,"إصدار بنت محمد"],[17041,"دفعوا باب الدار بوي .. وبصدري المسمار بوي",13,"إصدار بنت محمد"],[17040,"نقسم بالضلع المهشوم يا زهراء لو كنا وياك بهاليوم",11,"إصدار بنت محمد"],[17039,"أماه يا أماه.. للأمهات يشكو الحنان تحت أقدامها الجنان",14,"إصدار بنت محمد"],[17038,"الله قد أرادها لعرشه استعادها قال ارجعي ايتها الزكية لربك راضية مرضية",14,"إصدار بنت محمد"],[17037,"شلون نجمعه دمعة وجمرة لمصابك يا ام العترة",7,"إصدار بنت محمد"],[17036,"دارك يا علي كانت امس دار الإمامة هالليلة صفت يا با الحسن دار اليتامى",11,"إصدار بنت محمد"],[17035,"يا بن امي جارت الدنيا علينا يا اخي انا من الأسر أتينا",13,"إصدار بنت علي"],[17034,"يا الزاير طوف طوف طوف حضرتها وبعينك شوف هيبتها",18,"إصدار بنت علي"],[17033,"يا دهري يا غدار انا العقيلة بت حيدر الكرار حامي دخيله",13,"إصدار بنت علي"],[17032,"من ظلم الدهر قلبي انكسر خوي يا عباس مثلي من صبر عندك خبر خوي يا عباس",17,"إصدار بنت علي"],[17031,"خوي شبيدي يا بن الزكية عنك رحت دمعي يكت يا بن الزكية",13,"إصدار بنت علي"],[17030,"إن كان عندك عبرة تجريها فانزل بأرض الطف كي نسقيها",10,"إصدار بنت علي"],[17029,"ياريح الهاب وياك وديني ازور حباب غياب عن عيني",17,"إصدار بنات الحسين"],[17028,"يا بوي شلي بعمري وتيمت من زغري",20,"إصدار بنات الحسين"],[17027,"قبل ما تروح وتهاجر يا طير الصاف تاليني اخذني وياك لاحبابي وعلى الجنحان خليني",13,"إصدار بنات الحسين"],[17026,"عقب عزنا يا بو سكينة صرنا نتستر بيدينا",12,"إصدار بنات الحسين"],[17025,"تقاسمتي الرزايا مع القوم الضحايا.. سكينة الطهر سلام سلام",10,"إصدار بنات الحسين"],[17024,"هكذا جسم محمد مزقته النصول.. ذا شبيه الرسول بين جرد الخيول",21,"إصدار بكاء السماء"],[17023,"من يطلع المصباح تطلع مهج وارواح.. كل زلمنا الليلة يمنا ليلة عاشر ليلة رهبة",20,"إصدار بكاء السماء"],[17022,"يا الغايب بثارك قوم نامت عين فجارة.. عالمسموم واويلاه",14,"إصدار بعين الشهادة"],[17021,"يا صاحب الزمان يا سيدي الأمان .. يا يوم شمسك بالسماء نشوفها",7,"إصدار بعين الشهادة"],[17020,"دمع الأصول يفيض بعين الشهادة أمسى الحسن مسموم وهذا العهد مرسوم",23,"إصدار بعين الشهادة"],[17019,"بأي ذنب فجروا المرقدين واستكبروا إذ هدموا القبتين",11,"إصدار بعين الشهادة"],[17018,"ويلي على الكرار ويلي على حامي الجار ريضوا بنعش المرتضى",6,"إصدار بعد ما أشوفك"],[17017,"طفلة وتهضموها لمن تعيفوها عد من تخلوها وياكم اخذوها",15,"إصدار بعد ما أشوفك"],[17016,"حسين يا حسين حب القضاء جاري هبت رياح البين والأمر للجبار",7,"إصدار بعد ما أشوفك"],[17015,"أخاف من اعوفك بعد ما أشوفك إذا ما تجيني أقدر ظروفك",13,"إصدار بعد ما أشوفك"],[17014,"أنا علي أنا القتيل من غير جرم دمي يسيل",13,"إصدار بعد ما أشوفك"],[17013,"إن الذي رباني ملقى على الكثبان جداه من يرعاني",12,"إصدار بعد ما أشوفك"],[17012,"هالليلة العباس بوادي وانت بوادي يا علي",11,"إصدار بعد ما أشوفك"],[17011,"يا الغايب لثارك قوم نامت عين فجارة",8,"إصدار بدر الإمامة"],[17010,"أمسى العالم يعيش بظلامه وتغير نظامه هالليلة انفقد بدر الإمامة",33,"إصدار بدر الإمامة"],[17009,"يا جدي تسمع شكوتي.. خانت أيامي والقلب ضامي .. ريتك تشاهد حالتي عالترب دامي",13,"إصدار بحر الزود"],[17008,"لو تجري ليل نهار دمعي يا دمعي ما تطفي هاي النار دمعي يا دمعي",14,"إصدار بحر الزود"],[17007,"يا عباس انا اختك زينب اشكيلك واسمع شكواي",14,"إصدار بحر الزود"],[17006,"انهض وسل بتارك يا المهدي واطلب ثارك والباب قوم انشدها",13,"إصدار بحر الزود"],[17005,"يا شيال بحر الجود ريّض والنعش رده",13,"إصدار بحر الجود"],[17004,"لا تغفل ترى مسافر عضيدك",10,"إصدار بحر الجود"],[17003,"شالوا الجنازة والوديعة تصيح يا حسين بجنازة المسموم ريض يا ضوا العين",9,"إصدار بحر الجود"],[17002,"حادي الضعن نوخ رحلي هاي المدينة ودار أهلي بالطف عفت قبر المظلوم",30,"إصدار بحر الجود"],[17001,"قلي يا الميمون وين والينا راح ابو السجاد لو يرد لينا",6,"إصدار باب النجاة"],[17000,"يا ابني صرخت يا حسين ضلعك وضلعي غيرن وضعي وما نشف دمعي",6,"إصدار باب النجاة"],[16999,"شيعتي يا كرام يا عظام المقام فاندبوا يا حسين بفؤاد حزين",3,"إصدار باب النجاة"],[16998,"يا سائلي عن كربلا ها هي فانظر لها بعينك الباكية",3,"سيدي يا حسين أنت نور اليقين هتفت كربلاء يا منار الإباء"],[16997,"أخذ الأصل والجوهر وتمسك بهالمنظر أخدم بصافي النية ما يخيبك راعيّ",13,"إصدار باب النجاة"],[16996,"يا مهدينا الوعد وينه",17,"إصدار أين الطالب"],[16995,"يا مهدينا الضلع ما ننسى ثاره .. وعلي جدك علي هجموا لداره",14,"إصدار أين الطالب"],[16994,"يا غائباً عنا ولست بغائب لا زلت مثل الشمس بين سحائب",1,"إصدار أين الطالب"],[16993,"طال الوعد طال يا موعود يا موعود",8,"إصدار أين الطالب"],[16992,"أين معز الأولياء.. أين الطالب بدم المقتول بكربلاء",7,"إصدار أين الطالب"],[16991,"أما تدري بما يجري فهل ترضى .. عاف صبري شحمل صدرك يا مهدينا",10,"إصدار أين الطالب"],[16990,"هالدنيا عاشت كلها بخيالك من دمك اخذت صورة جمالك",13,"إصدار آية الصبر"],[16989,"أبد والله لن ننسى حسيناً وذا عهد ومعهود علينا",14,"إصدار آية الصبر"],[16988,"كربلا لا تهجعي ههنا وابكي معي ههنا اقتل صبراً بسيوف الألم",15,"إصدار آية الصبر"],[16987,"صاحب الأمر ضاقت الصدور فينا",4,"إصدار آية الصبر"],[16986,"زينب هالمسية تصيح وين المرتضى وينه ؟",12,"إصدار آية الصبر"],[16985,"إن جن ليلي مقلتي يجري الأسى فيها جمراً يحاكيها يبكي ويبكيها",5,"إصدار آية الصبر"],[16984,"يا مظلوم يا مظلوم بارينا رافع شانك",5,"إصدار أنت ثاري"],[16983,"يا مظلوم يا مظلوم نجري الدمع لمصابك",9,"إصدار أنت ثاري"],[16982,"آه يشكو للمنايا",8,"إصدار أنت ثاري"],[16981,"إمامي وطاعتي واجب أمثل نهيك وأمرك علومي من بحر علمك ثباتي من جبل صبرك",17,"إصدار أنت ثاري"],[16980,"أنت ثاري وثأر الله يا إمامي",10,"إصدار أنت ثاري"],[16979,"أنا المقتول في الطف قطيع الرأس والهفي",24,"إصدار أنت ثاري"],[16978,"أبناؤك الأحرار يا فاطمة نحو ربوع نصرها قادمة",13,"إصدار أنا الزهراء"],[16977,"أنا الزهراء وما أدري كسرك أصعب لو كسري",14,"إصدار أنا الزهراء"],[16976,"أمك أنا يا حسين طفلك وين دليني صار الجرح جرحين بالطفلين واسيني",19,"إصدار أنا الزهراء"],[16975,"يا عيني ابكي ودمعك خل يهل دم على الزهراء وضلعها اللي تهشم",7,"إصدار أمنا الزهراء"],[16974,"يا موت انشدك يا غاية عندك اكشف لي سرها.. قال انا قاصد للزهرا رايد آخذ عمرها",22,"إصدار أمنا الزهراء"],[16973,"يا ديان موتي حان واغوثاه ادركني يا الله",25,"إصدار أمنا الزهراء"],[16972,"يا أمنا الزهرا قومي اهجري القبرا وأنت أدرى.. ما زالت النار تحكي لك الدار",30,"إصدار أمنا الزهراء"],[16971,"ويلي عالزهرا المهمومة انوحن والمدامع عالوجن نهرا",5,"إصدار أمنا الزهراء"],[16970,"كف الدفع باب الدار شوف شترك من آثار",33,"إصدار أم النبي"],[16969,"طلعت من كوكب العرش تقول من يدانيني أنا أم الرسول",10,"إصدار أم النبي"],[16968,"الواثبين لظلم آل محمد ومحمد ملقى بلا تكفين",15,"إصدار أم النبي"],[16967,"ماتت بنت وصي الله فلندعوا إنا لله",36,"إصدار أم المصائب"],[16966,"غريب يا ابن هند كيف تجرا بأن تأتي بنا للشام أسرى",31,"إصدار أم المصائب"],[16965,"أخاف من اعوفك بعد ما أشوفك إذا ما تجيني أقدر ظروفك",33,"إصدار أم المصائب"],[16964,"ليش ما وصتهم يشيعوها ويم ولدها الأربع يدفنوها",5,"إصدار أم البنين الأطهار"],[16963,"يا أم البنين المؤمن يحضره المختار لو نزلوه بقبره وام البنين الاطهار كرمها رب القدرة",22,"إصدار أم البنين الأطهار"],[16962,"السلام عليك يا أم البنين أم البنين الطيبة الطاهرة ماتت حزينة وثاكلة",13,"إصدار أم البنين الأطهار"],[16961,"كل محب بالجنة اطمأنت نفسه لارض وسما الخالق وبدره وشمسه",13,"إصدار أم الأقمار"],[16960,"بعد كسر الضلع هل أغمضت عين ؟ إنني أسأل يا أم الحسين",8,"إصدار أم الأقمار"],[16959,"أم البنين الحرة مهمومة تجري العبرة يم بت محمد هالليلة يم بت محمد",24,"إصدار أم الأقمار"],[16958,"ويلي على المسموم قضى العمر مهموم",7,"إصدار إلهي"],[16957,"عجايب يا رسول الله وغرايب يا ابو العترة الحسن قبره بحماك شلون ترضى ينهدم قبره",7,"إصدار إلهي"],[16956,"إلهي باسمك الاعظم واسراره الهي رد غريب الدار لدياره",31,"إصدار إلهي"],[16955,"هذا علي مع الرسول كل بدمع الأسى يقول يا حسيناً يا ذبيح",11,"إصدار النبي محمد"],[16954,"سيد الرسل يفتح رسل ولأمته يعاتبها ما يضل عذر يوم الحشر والخالق يحاسبها",15,"إصدار النبي محمد"],[16953,"سل كربلا كم من حشى لمحمد نهبت بها وكم استجثت من يد",6,"إصدار النبي محمد"],[16952,"عفت قبري بدمع يجري أنوح ومهجتي تنادي أصيح أنا النبي الهادي",14,"إصدار النبي محمد"],[16951,"مصاب الجرى بعاشور غيب شمس وبدور غيبت بنينك يا الهادي وينك",12,"إصدار النبي محمد"],[16950,"أقمار الغوالب غابت بالحراير يا المصطفى وريحانتك قطعوا وريده",8,"إصدار النبي محمد"],[16949,"ونة وحسرة ونوح ايتام زينب ردت من الشام",7,"إصدار المحكمة"],[16948,"ليش يا دهري شلك عليّ.. مو خلص صبري ارحم شوي",12,"إصدار المحكمة"],[16947,"يا سهم العين احكي وياي انت اصعب لو سهم الماي",13,"إصدار المحكمة"],[16946,"زهراء يا أماه نشكوا إليك الآه بالدمع والأحزان عدنا إلى الأوطان",10,"إصدار المحكمة"],[16945,"جاوب يراس الرمح كل منحر الشايله كم لوعة وشكم جرح شتعرف يا هالعايلة",15,"إصدار المحكمة"],[16944,"يا ثار الله وحامي الملة هالحب كله يصيح حسين",12,"إصدار المحكمة"],[16943,"أسأل وين وانا بحيرة عن حسين مو عن غيره",9,"إصدار المحكمة"],[16942,"يا شيعة لا تلوموني ... مصيبة تهدم الأكوان يوضحها علي السجاد",17,"إصدار الكون يبكي"],[16941,"جابر ما دريت شصار بالطف ونواحيه وما تدري خدر زينب راح ومشت مسبية",13,"إصدار الكون يبكي"],[16940,"أكواننا تبكي على خير الملا أين رسول الله",33,"إصدار الكون يبكي"],[16939,"بعطش قلبي اعتنيتك نبع صافي لقيتك خيالك ساكن بعيني ولا لحظة نسيتك - العباس",11,"إصدار العدل السماوي"],[16938,"عجت العصرين واسود الفضا من طحت يا حسين يا ابن المرتضى",6,"إصدار العدل السماوي"],[16937,"زينب لفت يم حسين لكن قابعة بالهم",11,"إصدار العدل السماوي"],[16936,"جاءت اليه من السماء - بانت مشعشعة الجبين - خذ ثوب مجدك يا حسين",9,"إصدار العدل السماوي"],[16935,"لي حزن يعقوب لا ينفك ذا لهب بصرع نصب عيني لا الدم الكذب",13,"إصدار العدل السماوي"],[16934,"حياتي لست أرضاها إذا ما العز يرعاها حسيناه ثار الله",14,"إصدار العدل السماوي"],[16933,"الله يا حامي الشريعة الله أتقر وهي كذا مروعة الله يا حامي الشريعة",9,"إصدار العدل السماوي"],[16932,"دمك يساوي العدل السماوي وجهك تجسد محمد",12,"إصدار العدل السماوي"],[16931,"شفت بالنار خيمة مستعرة ذكرت الدار وفاطمة الزهرا",22,"إصدار السماء انفطرت"],[16930,"جينا ننعاهد ما نترك نهجك يا القائد.. انت القائد واحنا جنودك",12,"إصدار السماء انفطرت"],[16929,"السماء انفطرت والنجوم انكدرت حينما غاب الحسين - مع زيارة الإمام الحسين عليه السلام",32,"إصدار السماء انفطرت"],[16928,"يا مسموم جينا لدارك صرنا اليوم من زوارك ذكراك يا الكاظم تعيش ويانا",14,"إصدار السم في أحشاء موسى"],[16927,"يا قلب ذوب ويا دمع عين التفجر للذي قضى بسجن الرجس قلبه مفطر",9,"إصدار السم في أحشاء موسى"],[16926,"السم في أحشاء موسى سرى من ذا يواسي اليوم خير الورى",18,"إصدار السم في أحشاء موسى"],[16925,"اخذتي زهرة سنيني يا دنيا.. بعد قولي شتطلبيني يا دنيا",15,"إصدار السم في أحشاء موسى"],[16924,"يا زهرا يا زهرا يا زهرا يا ابنة الهادي ويا أم الهداة",5,"إصدار الزهراء في كربلاء"],[16923,"هذا حسين ههنا قد مزقوه بالقنا يا فاطمة يا فاطمة",10,"إصدار الزهراء في كربلاء"],[16922,"عليل ينادي بالعبرة أظنها حضرت الزهراء",16,"إصدار الزهراء في كربلاء"],[16921,"بيا حالة شافت فاطمة عبد الله مخضوب بدما",12,"إصدار الزهراء في كربلاء"],[16920,"بت حيدر بعبرة تستقبل الزهرا واشتنفع الحسرة",13,"إصدار الزهراء في كربلاء"],[16919,"أم البنين الحرة مهمومة تجري العبرة يم بت محمد هالليلة يم بت محمد",12,"إصدار الزهراء في كربلاء"],[16918,"يا علي وحدك حضرته بايدك دفنته يا علي",12,"إصدار الرزايا"],[16917,"مجروح قلب المختار ويسيل دمع الكرار والزهرا تبكي دموم",17,"إصدار الرزايا"],[16916,"لولا سقوط جنين فاطمة لما أودى لها في كربلاء جنين",10,"إصدار الرزايا"],[16915,"كلما نذكر نوقف بمحراب نذكر نورك اللي غاب",19,"إصدار الرزايا"],[16914,"انقضت ليلة وبعد ليلة تمر بينا تودعنا وتيتمنا يا والينا",15,"إصدار الرزايا"],[16913,"شحسبت من ودعتني انا زينب يا العفتني يوي عقبك يتمتني",14,"إصدار الرزايا"],[16912,"تذكر كسرها بمحنة دهرها تعنى لقبرها وراح حسين",13,"إصدار الرزايا"],[16911,"آه واويلاه يا حيدر علي العالم العلوي انفجع بمصابه",11,"إصدار الآية الكبرى"],[16910,"مولاي علي خير ولي فارس خيبر برجاك بحماك في ساعة المحشر",6,"إصدار الآية الكبرى"],[16909,"يا الطايح بمحرابك اهتز العرش لمصابك هز العرش لمصابك",16,"إصدار الآية الكبرى"],[16908,"يا حيدر قوم واسكب العبرة الحسن مظلوم عاين لقبره",14,"إصدار الامام الحسن المسموم"],[16907,"يا سائلاً أين الإحسان اليوم أمسى في الأكفان قولوا اذا تلك السنن تحيا بمن بعد الحسن ؟",15,"إصدار الامام الحسن المسموم"],[16906,"وسط القلب يا حسين نارك وناري شيطفي هالنارين نارك وناري",14,"إصدار الامام الحسن المسموم"],[16905,"كبدك وكبدي يا ابن الزكية بين سم وسهم والأشد يا ألم",13,"إصدار الامام الحسن المسموم"],[16904,"عالغبرة مطروح يا ابن امي يا ابن امي",9,"إصدار أصرخ ليل نهار ياكرار"],[16903,"يا با الحسن ظليت عقبك غريبة ما تنخمد للموت نار المصيبة",19,"إصدار أصرخ ليل نهار ياكرار"],[16902,"حرت وعيوني ما ينشف دمعها صدق ام الحسن كسروا ضلها ؟ اريد تجاوبوني",16,"إصدار أصرخ ليل نهار ياكرار"],[16901,"أصرخ ليل نهار يا كرار يا كرار",14,"إصدار أصرخ ليل نهار ياكرار"],[16900,"ردت اعرف المظلوم يعود لدياره هالليلة بالقرآن خذت استخارة",31,"إصدار اسأل المظلوم"],[16899,"ذبني الدهر يا جسام قلبي انفطر يا جسام",12,"إصدار اسأل المظلوم"],[16898,"بأي ذنب فجروا المرقدين واستكبروا إذ هدموا القبتين",20,"إصدار اسأل المظلوم"],[16897,"آه واويلاه يا أم البنين جئت من غدر زماني أحتمي",10,"إصدار اسأل المظلوم"],[16896,"جينا لزينب متعنيها بمصيبة أمها نواسيها",18,"إصدار أخذتي زهرة سنيني"],[16895,"تبكيكي عيني زهرة ساجمة يا زهرة الفردوس يا فاطمة",7,"إصدار أخذتي زهرة سنيني"],[16894,"اخذتي زهرة سنيني يا دنيا.. بعد قولي شتطلبيني يا دنيا",29,"إصدار أخذتي زهرة سنيني"],[16893,"يا أيها الأكبر تسقى من الكوثر إذهب إلى المختار ما أقصر الأعمار",18],[16892,"عبد الله يا ابني دهرك سلبني .. يا زهرة سنين العمر عبد الله يبني",12],[16891,"يا ابن يا الأكبر طالت النومة بعدك تراني اليوم مظلومة",9],[16890,"بآهاتي لقوني زينب تعرفوني بالغرب عفتوني للوطن ردوني",17,"أودعكم يا خوتي واسكب العبرة اغص بلوعتي واتلوى بالحسرة"],[16889,"يا من جهلت العدل والصدق أين قم واتجه بالقلب نحو الحسين",5],[16888,"زينب يا التنشدوني عليها بالخرابة منزليها",10],[16887,"تلك الأضاحي من بني عمرو العلا قد مزقوها بالقنا في كربلا",7],[16886,"مر القبر يا كرار وبناتك تعناها شوف شحالها بهالليل من ودعت واليها",15],[16885,"بين الذبيح وبلا دفن بين الرهين وسط السجن.. يا ما صحت يا ما نحت هالمنذبح مظلوم",13],[16884,"غريباً أرى يا غريب الطفوف توسد خديك كثبانها",13,"إصدار للبكاء بقية"],[16883,"لا تعذلونا ههنا كربلاء في دمنا والنحر والمصرع",6,"مشترك مع حمزة الزغير"],[16882,"يا حسين ذا ندائي يا حسين في سمائي يا حسين",9],[16881,"ألا يا حيدر.. منادي المحشر فليت نداك بالطف بهذا المنحر",9],[16880,"ليلى نادت ليش يا وليدي عفتني آه يا بني .. وبسهم هجرك يا الاكبر صوبتني",4],[16879,"يا زوار انحبوا وابكوا علي بنت حسين انا واسمي رقية",8],[16878,"يا وليدي يا دم يسيل بوريدي يا عبد الله يا وليدي",9],[16877,"إنا لله .. ذبح الحسين بكربلا ظام فواويلاه.. إنا لله",8],[16876,"يا غايبنا بخطر أصبح وضعنا وغيابك فجعنا إلك يا ابن الحسن آخر دمعنا",8,"إصدار صوت الراية"],[16875,"قد عدت والأيتام نروي لك الآلام بالرأس جئنا سل أين كنا نروي لك الآلام",13,"إصدار صوت الراية"],[16874,"ثورة وبالطف مولدها زينب صارت قائدها.. ثورة بنت الكرار",9,"إصدار صوت الراية"],[16873,"ليت القيود لها لسان محدِّث تروي لنا ما قد خفا من أنة السجاد",10,"إصدار صوت الراية"],[16872,"وينك يا عباس .. كف الحقد لمن وصل ثغر حسين وينك يا عباس",8,"إصدار صوت الراية"],[16871,"تسيل كل دمعة على خدودي وتصيح .. واحسيناه واحسيناه",8,"إصدار صوت الراية"],[16870,"خذ ولائي كربلائي خذ ولائي كربلائي.. لو تعبن الرجلين اوصل زحف لحسين",12,"إصدار صوت الراية"],[16869,"ألا خذني من الحزن حميم سال من جفني",5],[16868,"نوحي على الأولاد يا زهرا الحزينه واحد في كربلا وواحد في المدينة",6],[16867,"أنت بعدي سر عهدي يا جلال الله .. يا ابن امي كل همي للذي تلقاه .. يا حسين",9],[16866,"ناح على سبط الرسول الندى ومن تخوم العشر جاء الصدى لقد أصيب الحسن المجتبى",7],[16865,"أنا المسموم يا زهراء فقومي وافتحي القبرا",13],[16864,"طفلة وتهضموها لمن تعيفوها عد من تخلوها وياكم اخذوها",17,"مشترك مع الشاعر جابر الكاظمي"],[16863,"اجتنا يا العقيلة رسالة من العليلة تقول الهم لفاني",21,"مشترك مع الشاعر جابر الكاظمي"],[16862,"قبل ما تروح وتهاجر يا طير الصاف تاليني اخذني وياك لاحبابي وعلى الجنحان خليني",19,"مشترك مع الشاعر جابر الكاظمي"],[16861,"يا مسافر ويت تريد لا ترحل عني بعيد ما اقدر اتصبر لا ترحل عني بعيد",21,"مشترك مع الشاعر جابر الكاظمي"],[16860,"تبا لك يا أمتي بدر هوى من عترتي هذا علي هذا علي",14,"مشترك مع الشاعر جابر الكاظمي"],[16859,"يا آل سفيان كفى يا أمة الطغيان هذا شبيه المصطفى يا امة الطغيان",21,"مشترك مع الشاعر جابر الكاظمي"],[16858,"حضر بالطف رسول الله وتحير فقد جاسم اشد لو فقد الاكبر",21,"مشترك مع الشاعر جابر الكاظمي"],[16857,"حضر عندك علي جدك.. سميك يا علي الاكبر ينوح بمصرعك حيدر",23],[16856,"آه لمصابك يا زين عبادها زلزل العالم وسبع شدادها",7],[16855,"قلبك سفينة نوح يا خامس اهل النوح ببحر المصايب شفت العجايب",23],[16854,"راية محمد خليها بايدك سجل ملاحم من دم وريدك",24,"عباس اجت وكبدتي عليك مدمية"],[16853,"يا حسين حادي ضعونا عزم على الشيل",16],[16852,"شلون اصبر على الآه واترك نحيبي بيدي دفنت بالقاع جثة حبيبي",26],[16851,"ويلي على المسموم قضى العمر مهموم",6],[16850,"جاءت اليه من السماء وبكفها ثوب البهاء قالت وادمعها دماء خذ ثوب مجدك يا حسين",26],[16849,"هاي ام الاكبر هاي ساهر جفنها وتعاين من بعيد جثث ابنها",12],[16848,"الله قد أرادها لعرشه استعادها قال ارجعي ايتها الزكية لربك راضية مرضية",13],[16847,"عبرنا الحزن بالتهليل والتسبيح .. نقسم بالضلع المهشوم يا زهراء لو كنا وياك بهاليوم",11],[16846,"يحق لمقلتي تهمي الدموعا على من رضضوا منها الضلوعا",9],[16845,"دارك يا علي كانت امس دار الإمامة هالليلة صفت يا با الحسن دار اليتامى",11],[16844,"شلون انجمعن دمعة وجمرة لمصابك يا ام العترة",7],[16843,"يا الما تنسى ثارك ملينا انتظارك",13],[16842,"حرقوا باب الدار بوي .. وبصدري المسمار بوي",13],[16841,"عايلة وايتام من الشام ردينا خل عندي هموم يا مظلوم خلينا",20],[16840,"عذبني درب الشام ما طبق جفني ونام",20],[16839,"حضر عندك علي جدك.. سميك يا علي الاكبر ينوح بمصرعك حيدر",14,"استديو"],[16838,"الرأس المقطوع يا حيدر يا حيدر.. في رمح مرفوع يا حيدر يا حيدر",11],[16837,"ميعادك صار صار صار يا الاكبر.. مطلوب بثار ثار ثار من حيدر",19],[16836,"سلام الله على الخد التريب .. سلام الله على الشيب الخضيب",15],[16835,"حضر بالطف رسول الله وتحير فقد جاسم اشد لو فقد الاكبر",16],[16834,"يا وليدي كل حن القلب حنيته وعليك ضلعي بالحزن حنيته - القاسم",22],[16833,"هاي امي الربتني ولهذا الموقف رادتني بالمدمع نادتني وياك استشهد وصتني",17],[16832,"حسين حسين حسين.. يا حسين حادي ضعونا عزم على الشيل",6],[16831,"يا سائلي عن فاطمة مصابها ما أعظمه .. ناعي الاسى يصرخ في المدينة",12],[16830,"أقصدوني فأنا اسمي الحسين اقصدوني انا كهف الخائفين",10],[16829,"ناحت سكنة وزينب يمها وانشغلت كل وحدة بهمها",9],[16828,"رقية فزت من النوم مرعوبة وتدير العين مذهولة فكر ظلت تتلفت يسار يمين",9],[16827,"هاي الطاهرة اللي قدمت اربع كواكب لاذت بالايمة وجاورت اربع مراقد",10],[16826,"نارين شبوها القوم نارين تسعر لليوم ضلعين انهشمت للعترة ضلع حسين وضلع الزهرا",9],[16825,"يا الغايب ما تهتم لو عندك انصار ولثارك تتقدم يا صاحب الثار",11],[16824,"بشعوري انرسمت الصورة وبديت انحب اجى المهدي لضريح السيدة زينب",3],[16823,"يا علي.. ما أعلم بيا يوم بيا ساعة أظهر.. وبسافي آخذ ثار دمك يا الاكبر",14],[16822,"يا مهدي بريد القلب وافاك يا مهدي.. سئمت العيش لولاك يا مهدي",9],[16821,"انا المنتظر حجة الباري لثارك يا قمر طال انتظاري",6],[16820,"بالطف لو كنت موجود يوم العاشر بعاشور .. تلقى الغايب الموعود يم حسين جده يزور",11],[16819,"العليلة تنوح على المذبوح بقلب مجروح تحاكي الليل",9],[16818,"يا معبود متى يعود مهدينا",4],[16817,"يا دنيا .. اخذتي زهرة سنيني يا دنيا.. بعد قولي شتطلبيني يا دنيا",17],[16816,"حسين يا شهيد.. يا حسين يا حسين.. أيها الناس اسمعوني وانسبوني جدي محمد والكل يشهد",30],[16815,"يا قلبي يا صابر علي من تكابر بعد ليلة وحده حبيبك يهاجر",15],[16814,"وهج الظما نزف الدما يحكي فما في الحزن واويلاه",8],[16813,"أصلي عليك أبا الفرقدين عراق علي عراق الحسين",9],[16812,"يا مسموم ناح العرش لمصابك.. صاحت عقيلة حيدر يا بن امي دمع اختك جرى",12],[4673,"كل قطرة دم بشرياني تهتف بإسمك يا حسين",21,"(قراءة2)"],[4672,"شفت بالنار خيمة مستعرة ذكرت الدار وفاطمة الزهراء",24,"(قراءة2)"],[4671,"قالوها اصحاب العبر والأمثال أطباع هاي الدنيا كل يوم بحال",7],[4670,"آمنه بحبك يا حسين انت المنقظ دنيا ودين",25],[4669,"حرم عندي وحق جدي سواد الليل أمهلوني",21,"(قراءة2)"],[4668,"الدمع وعيني ما افترقا وليوم مصابك قد خلقا",19],[4667,"ام البنين اليوم تسأل عن المظلوم",26],[4666,"آه يا حسين ومصابه",2],[4665,"يهل تنشد على مسلم قتل وانقتل بالحومة",9],[4664,"يالأكبر يالأكبر يوليدي يالأكبر عاين امك تنحب يمك",21],[4663,"يا سائلي عن كربلاء ها هيا فنظر لها بعينك الباكية",4],[4662,"وأربع بدور الدهر أخفاها أم البنين تنادي",6],[4661,"هجمت العسكر وخيمتنا تسعر بوي يا حيدر",23],[4660,"آه يبني ياالأكبر آه يبني يالأكبر",13],[4659,"وأريد العهد منك يالقلت بحماي ما انت القلت قومي لكربلا وياي",5,"هوسات"],[4658,"ليث المعارك عباس هاك استمع عنوانا هز رايته والسيف",9],[4657,"عبد الله يبني بكربلاء هضمتني دنياي",9],[4656,"زينب نادت ومن قلب ضمي ليته لا كان نهر العلقمي",7],[4655,"زينب صاحت بهالصوت تعنيتك يابو اليمه",5],[4654,"ربيتك يا جاسم وتعبت برباك شهيد تروح مني روح الله وياك",6,"هوسات"],[4653,"دمع العين طفّى شموعك",7],[4652,"آه يوليدي رحت من إيدي وخذت الروح",9],[4651,"الوادم لو لفاها الليل تعد الليل للونسه",10],[4650,"اريد انعاك فلا انساك يا عبد الله اهز مهدك",15],[4649,"ابد والله لن ننسى حسيناه",7],[4648,"عريس وقدم نحره آمنا بهاي الفكره فكره وصارت نبراس معناها الحب للناس",28],[4647,"أمير المؤمنين يا شاه مردان",14,"استديو «يا علي» فارسي"],[4646,"العالم والدنيا هتفا آه لرحيلك و آسفاه",2,"استديو «واعليا» شعر"],[4645,"والاملاك حزن القلب ما عوفك والاملاك",1,"استديو «واعليا» أبوذية"],[4644,"فقدناك أميرا وللحق نصيرا وليا يا وليا وداعاً يا عليا",2,"استديو «واعليا» شعر"],[4643,"اشدد حيازيمك للموت فإن الموت لاقيك",2,"استديو «واعليا» شعر"],[4642,"سلام على اهل القبور الدوارس كانهم لم يجلسوا في المجالس",2,"استديو «النفس اللوامة»"],[4641,"شلون بيه وثقل وزن حسابي وانملى من المعاصي كتابي",14,"استديو «النفس اللوامة»"],[4640,"يا ابن آدم لا تكن ممن يطلب التوبة بطول الأمل",3,"استديو «النفس اللوامة» موعظة"],[4639,"باتو على قلل الأجبال تحرسهم غلب الرجال فلم تنفعهم القلل",2,"استديو «النفس اللوامة» شعر"],[4638,"I wanted you to stay",8,"استديو «ولي الله»انجليزي"],[4637,"علي علي علي يبويه وياك أريدن ينحفر قبري",17,"استديو «في مصاب أبي تراب»"],[4636,"علمنا خبر ما وصل من عندك علمنا ودهرنا على الحزن والهم علمنا",3,"نعي"],[4633,"جوهرة القدس من الكنز الخفي",13,"استديو «جوهرة القدس» مع جليل الكربلائي"],[4632,"خلق الله علياً من نوره + دخلو محراب الرحمن وأصابو رأس القرأن",12,"استديو «جوهرة القدس» مع جليل الكربلائي"],[3893,"كل قطرة دم بشرياني تهتف بإسمك يا حسين",20,"استديو «قوس السماء»"],[3892,"والله لن انساك يا كربلا لو قطعوني مفصلاً مفصلا",13,"استديو"],[3891,"شيعتي يا كرام يا عظام المقام فاندبوا يا حسين",13,"استديو «وحي القوافي»"],[3890,"بنت البتول الشافعة لابن الوديعة تودعه",13,"استديو «وحي القوافي»"],[3889,"كربلائي انا كربلائي انا بل حسينيّ انا بل حسينيّ انا",11,"استديو"],[3888,"يا حسين انصارك تعرفنا",7],[3887,"صلى عليك مليك السماء جسم صريع بالعراء",33],[3886,"صدق الموت حين ماتت ضمائر المآسي تجدد",29],[3885,"هلأمة يهاديها بالعترة اشتوصيها",34],[3884,"الكرار جهز للرسول الأكفان وبكفه وسد جسمه",9,"نعي - 28صفر 1422هـ"],[3883,"باب الحوايج مسموم واحنا نصيح بهاليوم",30],[3882,"آه يا موسى ابن جعفر الكون لمصابك تغيير",12],[3881,"علي ودع حياته وراح يخفي لوعته بصدره",12,"كربلائي - 22رمضان 1421هـ"],[3880,"زينب يم ابوها تهمل الدمعة وبآخر وداع بهالمسا",12],[3879,"عفتك ايام كل يوم بعام قوم وشوف مصابك اصعب",37],[3878,"لا تلوموني لا تلوموني لو فاضت دمعات عيوني",7],[3877,"دريضوا يالتشيعونه ولينا لا تدفنونه",26],[3876,"جابر ما دريت اشصار بالطف ونواحيه",10,"كربلائي - 20صفر 1422هـ"],[3875,"يا بالفضل عفناك غصبا علينا للكوفة ويا عداك",29],[3874,"بعيلة تمحنت والدهر سابيها رجعت بالدمع",5,"نعي - 20صفر 1422هـ"],[3873,"ارحم قلبنا ولوعة غربنا يا غريب",15],[3872,"يالحادي نترجاك للطف إخذنا وياك",37],[3871,"يا حسين يا بن امي خان الدهر بينا",29],[3870,"دعبل الشاعر رسم هالحالة وبالمصيبة للرضا تعناله",7,"نعي - 17صفر 1422هـ"],[3869,"يا حيدر بباب الدار تسمع صرختي ووني",12],[3868,"قل لي يالميمون وين والينا",20],[3867,"نتأمل يومك يالمهدي وصوتك ننتظره",33],[3866,"هذا اللي صار بعد المختار غصبوا حقي",24],[3865,"أم أبيها من سينجيها من مآسيها",5],[3864,"انا ابن الطاهرة الزهرة وابويه الصابته الطبرة",35],[3863,"اطبق الكون بألوان المحن يوم اردى السم غدرا بالحسن",10],[3862,"يا صاحب العصر الأمان الأمان من هذه الدنيا",10],[3861,"بليل أظلم طلبت يدفنونها حتى لا أهل الردى يشيعونها",5],[3860,"ضلعك تهشم منحري يصب دم",5],[3859,"اشهد يا اله الكون وانت مالك القدرة",30],[3858,"ياوادم لا تلوموني لو ان اجري المدمع دم",7,"نعي - 2جماد الثاني 1422هـ"],[3857,"نطبر هامة بسيف وقامة وننزل موكب للتطبير",17],[3856,"عجيب يابن هند كيف تجرا بأن تأتي بنا للشام أسرا",34],[3855,"ضلع المهشوم نحر المظلوم يالمهدي",34],[3854,"لا قمر لاح لاح بسمانا لا ورد فاح فاح بجنانا",37],[3853,"أنوحن والمدامع عالوجن نهران",14],[3852,"صرخة بضمير حشاي تسمع صداها",8],[3851,"لو خفق جنح المنية صافحك كف الأجل",16,"استديو «النفس اللوامة»"],[3850,"ها ها تلقوني زينب تعرفوني بالغرب عفتوني",29],[3849,"ذوبت يابن المصطفى قلبي من بكاك",10],[3848,"لا لا تلوموها خل تبكي خلوها",32],[3847,"ما تفيد اهل الظلم أعذارها لو جهنم باشر تشب نارها",13],[3846,"يا ابو السبطين جيت بلا عين يا حيدر",41],[3845,"كان شاهدت حيدر بالطفوف اليوم بحالة حزن",6,"نعي"],[3844,"للعباس إجت زينب طفل حسين وياها",39],[3843,"للطف وصلنا لقبور اهلنا كم لوعة شفنا",19],[3842,"زينب عودت يا حسين عن قبرك تناشد وين",23],[3841,"يا كرار يا كرار بارينا عظم امرك",7],[3840,"بهاي البوادي تنزف دماكم يم الشريعة طايح لواكم",36],[3839,"بذو الفقارك يا علي تحمي جارك يا علي",21],[3838,"سلام سلام على كل طعنة وكل طبرة بجسمك",16],[3837,"زينب تلطم على الراس وتنادي يا مهر حسين",15,"«صبراً يا آل محمد»"],[3836,"نستنكر كل رموز الإرهاب كيف تفجر أضرحة الاطياب هذا صوت يتجسد",36,"«صبراً يا آل محمد»"],[3835,"النحب والنوح صارن سلوتي بدنياي",6,"«صبراً يا آل محمد» نعي وأبوذيات"],[3834,"النوايب صوبني النوايب صوبني",8,"«صبراً يا آل محمد»"],[3833,"زينب لفت يم حسين لاكن قابعة بالهم",20,"«صبراً يا آل محمد»"],[3832,"حسيناً واحسيناه حسيناً واحسيناه ... عزيزة قلبك",14],[3831,"ابو اليمة كثر همه إجا يودع قبر جده",21],[3830,"لو ان رجلي وايدي تقطعن مني اجي لقبرك زحف يا حسين",8],[3829,"يالهادي ما تخمد نار جمرة مصابي وانرسمت بباب الدار",21],[3828,"في شهر الغفران يا حيدر يا حيدر يا حيدر ابكيت القرآن",16],[3827,"لا لا تخلينا يبوية لا تخلينا منهو اليواسينا يبوية",22],[3826,"يا أيها المرتضى في القلب نار الغضى اليوم مات الرضا",28],[3825,"يا مسموم ما تطفى نارك يا مسموم بالغربة دارك",6],[3824,"يالمختار بحالي اشصار بحالي اشصار يالمختار",26],[3823,"تيتميني تعيفيني بزغر سني",7],[3822,"الواثبين لظلم آل محمد ومحمد ملقى بلا تكفين",11],[3821,"عابس يصيح بصوت يا من تسمعوني جنني حب حسين",16,"استديو «لبيك يا حسين»"],[3820,"خان الدهر خان يالوليان يالوليان",13],[3819,"تاج الفخر صار للأنصار / انظر الأنصار وخذ هالفكرة عنهم",16],[3818,"نحن جئنا للفداء وهتفنا بالدماء سوف نغدوا من ضحايا كربلاء",29],[3817,"لبيك يا حسين لبيك يا حسين",5,"استديو"],[3816,"يا ليل بوداع حسين يا ليل ما تغفل عين",23],[3815,"تنذبح ظامي خابت احلامي وانا كانت ظنتي انت تحضر دفنتي",10,"استديو"],[3814,"يا دنيا ما ظل والي يا دنيا حتى اطفالي",47],[3813,"صحت شيصير ردت تفسير شفت بالطيف هاي العجايب",11,"استديو «سلام»"],[3812,"ما انسى عاشور ذبحوا زلمنا و حركوا خيمنا",12,"استديو «سلام» مع لغة ثانية"],[3811,"يا دنيا ما ظل والي يا دنيا حتى اطفالي",11,"استديو «وحي القوافي»"],[3810,"آه يا ليث المناية وبابها ... انخاك يا ابا الفضل",15],[3809,"للعباس إجت زينب طفل حسين وياها",13,"استديو «وحي القوافي»"],[3808,"هذا انت عباس هذا انت يابن الكرار اول بنيني",11,"استديو «وحي القوافي»"],[3807,"هذا انت خوية وهاي فضوة خيمنا والشاطي ماهو بعيد",7],[3806,"صلى عليك مليك السماء جسم صريع بالعراء",12,"استديو «وحي القوافي»"],[3805,"يا مهدينا الضلع ما ننسى ثاره",29],[3804,"فزعت من نومتي مرعوب واتحسر",7,"نعي"],[3803,"أنوحن والمدامع عالوجن نهران",10,"نعي"],[3802,"فضة بحزنها تنادي مظلومة بنت الهادي",20],[3801,"تترك الجثة الشريفة لو تعوف اهل السقيفة",43],[3800,"يالباري ظلت تنحب سماءك والليلة نزلت كل أنبياءك",45],[3799,"أفجع مصيبة انصبت على الإسلام فقد النبي الهادي",7,"نعي"],[3798,"آه عليك يالمصطفى",14],[3797,"واويلاه يا سيدي مظلوماه يا سيدي ...حفر عين الدمع",14],[3796,"أمسى المسى والنار ما خلت لنا خيام",10],[3795,"حيرني الدهر بحسين وعليّ ثقل همه",9],[3794,"لما هوى جسمك في كربلا تجسدت في قتلك الأنبيا",10],[3793,"تصيح العقيلة يا جدي وينك بسيف السقيفة ذبحوا بنينك",35],[3792,"يمك جيت يا ولياني واتعنيت يا ولياني",18],[3791,"حيدر صحنا وبيه آمنا حيدر محراب الإيمان",13,"استديو"],[3790,"أمسى المسى والنار ما خلت لنا خيام",9,"استديو «قوس السماء»"],[3789,"اصرخ يا حسين طفلك وين وديته",10],[3788,"حيرني الدهر بحسين وعليّ ثقل همه",11,"استديو «قوس السماء»"],[3787,"ان قتلونا أو تركونا فالأمر موحّد",16,"استديو «قوس السماء»"],[3786,"يا شيعتي رغم عداي وقت العطش ذكروني",12,"استديو «قوس السماء»"],[3785,"طفلة وشفت حيدر جدي من ارض النجف حاضر عندي",16,"استديو «قوس السماء»"],[3784,"طفح الدمع وقال انت قوس ام هلال / مثل ما يفتح القاري",6,"استديو «قوس السماء»"],[3783,"حسين يا روح البتول الطاهرة انت يا مولانا دنيا وآخرة",9],[3782,"أنت نبراس الكرامة بس إلك تحلى الزعامة",25],[3781,"بدرك غايب يا حيدر بدرك غايب",21],[3780,"آه عليك يالمرتضى ..يا حيدر من عقب عينك عليّ جارت ايامي",17],[3779,"الهي ان كان ما اردن لعد حيدر اخذ روحي",10],[3778,"اليوم لنا يا ابتاه وغدا عند رسول الله يا حيدر",33],[3777,"نبكيك يا كرار يا رمز الإباء",10],[3776,"فقدناك أميرا وللحق نصيرا وليا يا وليا وداعاً يا عليا",24],[3775,"مولاي علي مولاي علي سلم لمن سالمك حرب لمن حاربك",20],[3774,"تهدمت والله اركان الهدى",10],[3773,"يا سيف الطبر والينا وا اماماه",8],[3772,"يا بويه علتي عله واجر ونّه بأثر ونّه",8],[3771,"يكفي الهضم والنوح روحي يا روحي",20],[3770,"امك انا واصرخ يبني يا مظلوم مثل نحرك جفن عيني يصب دموم",8,"نعي"],[3769,"ما اقدر انساك يا مظلوم يا مظلوم",17],[3768,"ناعي الموت صاح ونعى الله من هالفاجعة",15],[3767,"انا زينب وخل يشهد زماني ويدري اشكم سهم بالطف رماني",21],[3766,"هاك اسمع نداء الروح ما بين العرش واللوح",16],[3765,"انا ام البنين وعهدي وفيته وبالأربعة لقلب الزهرة واسيته",8],[3764,"عبد الله يبني بغيبتك هيجت ناري والدمع جاري",20],[3763,"السلام على المرمل بالدماء السلام على غريب الغرباء",23],[3762,"يا عبد الله انقطع منك نصيبي",30],[3761,"يا مصباح الهدى يا فلك النجاة ما لنا غيرك ذخر بالموزمات",9],[3760,"يا جدي تسمع شكوتي خانت ايامي والقلب ظامي",15],[3759,"هوسات",11,"استديو «يا حسين»"],[3758,"يا طود الهم الك مأتم حزن بينا",9],[3757,"هل يا دمعي هالشهر عاشورها وحزن هاشم وآل امية سرورها",10],[3756,"واقف وحيد حسين بين الأعادي ينظر يسار يمين المن ينادي",26],[3755,"تبكيك عيني عبرة ساجمة يا زهرة الفردوس يا فاطمة",6,"استديو"],[3754,"وا عجبا يستأذن الأمين عليهم ويهجم الخؤون",8,"استديو"],[3753,"يا شاطئ الموت حاكيني أنا العباس تدريني",10,"استديو"],[3752,"يا حسين من العين حبك ينبع مجراه",10,"استديو"],[3751,"عشاق الحسين عشاق الحسين خذ يا سيدي عهد الوفا",6,"استديو"],[3750,"بالخيم فرحة وبشاير بالحرب خيل وعساكر",13,"استديو"],[3749,"طفلة وشفت بالنوم كأن والدي المظلوم يمّي ويحاكيني",12,"استديو «سلام»"],[3748,"ريت لا عشت بحياتي / حسيناه ثار الله / حياتي لست ارضاها",8,"استديو «العدل السماوي»"],[3747,"تسبح باسمك وتحدي بمروج التضحية الأرواح",12,"استديو «العدل السماوي»"],[3615,"جاءت اليه من السماء وبكفها ثوب البهاء/ بانت مشعشعة الجبين",9,"استديو «العدل السماوي»"],[3614,"يوم راحوا كل هلي وما ظلت خيام",13,"استديو «سلام»"],[3613,"سلام سلام على كل طعنة وكل طبرة بجسمك",9,"استديو «سلام»"],[3612,"شرعوا سمر العوالي / حسيناه ثار الله / دماء كيف ننساها",6,"استديو «العدل السماوي»"],[3611,"لما هوى جسمك في كربلا تجسدت في قتلك الأنبياء",10,"استديو «سلام»"],[3610,"حزنا بكينا لما رأينا مصيبة السجاد",21],[3609,"طالت ليالي النايبة وردت حرم وايتام",7],[3608,"ما عوفك حبيبي وساكن بعيني ما عوفك",16],[3607,"من يوم الباب كل يوم مصب",21],[3606,"احتارت الزهرا عقب ابوها المختار",5],[3605,"جينا لزينب نتعنيها بمصيبة امها نواسيها",15],[3604,"ناديت لكن من قلب منفجع لا تنسى يالمحجوب كسر الضلع",6],[3603,"دما ابكيك يا محسن نداء في السما يحزن",27],[3602,"عجت العصرين واسود الفضا من طحت يا حسين يابن المرتضى",6,"استديو «العدل السماوي»"],[3601,"إحنا أنصارك من أفكارك فكرتنا تظهر",9,"استديو «سلام»"],[3600,"لي حزن يعقوب لا ينفك ذا لهب",13,"استديو «العدل السماوي»"],[3599,"زينب لفت يم حسين لاكن قابعة بالهم",11,"استديو «العدل السماوي»"],[3598,"عيوني وعيونك يابن حماي الحمى",14],[3597,"عند من عفتني يا عباس يا عباس",19],[3596,"ساعي البريد انخاك شجايب خبر وياك",38],[3595,"ضيعتك من ايدي عبد الله يا وليدي",11,"استديو «سلام»"],[3594,"بعطش قلبي اعتنيتك نبع صافي لقيتك",11,"استديو «العدل السماوي»"],[3593,"الله يا حامي الشريعة الله أتقر وهي كذا مروعة",9,"استديو «العدل السماوي»"],[3592,"بالاحزان يصرخ علي والعبرات دم تهلي",11],[3591,"اشكثر تصبر يا من صبرك جزع من عنده بتاره",9,"كربلائي"],[3590,"باسمك يا قمر هاشم ميزان الوفا ينقاس",6],[3589,"الفرات شلون بعيوني انظره وابو السجاد ظامي انقطع نحره",11],[3588,"منار في السماء سليل الأنبياء",13],[3587,"معصومة هاي اخت الرضا هاي النجيبة ماتت غريبة فاطمة",11,"استديو"],[3586,"يا حسين ما تنشف بعد دمعتي سهم اللي صابك صابني بكبدتي",11,"استديو - شعر"],[3585,"يا عباس انت كفلتنا يا عباس رحت وعفتنا",14],[3584,"قدوتنا مسلم صار واعي وحمل افكار دعوة محمد",32],[3583,"اولادك تاهوا يا مسلم وامهم تجري دموع العين",20],[3582,"هاي امي لربتني ولهاذا الموقف رادتني",26],[3581,"هاي اطفالي هاي اطفالي تنظر جودك هاي اطفالي",16],[3580,"ابد والله يا زهرا ما ننسا حسيناه / نقسم بمصابك يا زهرا",13],[3579,"عندكم دليلي مودعة هاي البتول البضعة",21],[3578,"هاك استمع عنوانه هز رايتة وشال السيف وتوجه لميدانه",9],[3577,"ظل يجري دمع العين عالراية والكفين + هوسات",34],[3576,"نفذ صبري خلص عمري خلص عمري نفذ صبري",18],[3575,"عباس يا بحر الزود عباس هاك اخذ الجود",23],[3574,"لا تلوم يا زماني يا زماني مذموم يا زماني يا زماني",20],[3573,"لو تجري ليل نهار دمعي يا دمعي ما تطفي هاي النار",18],[3572,"يا صاحب الرأس الذي فوق القنا مرفوع",14],[3571,"انهض وسل بتارك يالمهدي واطلب ثارك والباب قوم انشدها",16],[3570,"يا مليك الدهور حان يوم الظهور",26],[3569,"اصرخ ليل نهار يا كرار يا كرار",13],[3568,"يا صاحب الرأس الذي فوق القنا مرفوع",17,"استديو"],[3567,"لا قمر لاح لاح بسمانا لا ورد فاح فاح بجنانا",9,"استديو «يا باب فاطمة»"],[3566,"قل للمغيب تحت اطباق الثرى ان كنت تسمع صرختي",6,"استديو «يا باب فاطمة»"],[3565,"سل اربعا فطمت اكنافها السحب",7,"استديو «يا باب فاطمة»"],[3564,"حرت وعيوني ما ينشف دمعها صدق أم الحسن",12,"استديو «يا باب فاطمة»"],[3563,"يا شيعتي يا شيعتي ما تطفى نار مصيبتي",13,"استديو «يا باب فاطمة»"],[3562,"يا كرار بالشدة طحنا يا كرار اولادك احنا",8,"استديو «يا باب فاطمة»"],[3561,"حاء وياء ودال وراء حيدر حيدر حيدر",12,"استديو «يا باب فاطمة»"],[3560,"يا باب فاطمة",6,"استديو «يا باب فاطمة»"],[3559,"يا آل قومي عدنا إليكم والدمع يجري حزناً عليكم",18,"استديو"],[3558,"يا ايها الأكبر تسقى من الكوثر",18,"استديو"],[3557,"العلم عالقاع يا حيدر يا بوي ومنك اتعذر",14,"استديو"],[3556,"نار قلب العطشان نار فقد الوليان نار حرق الصيوان",20,"استديو"],[3555,"هضموني هضموني يا بوية هضموني سكنة العزيزة وسلوتك",14,"استديو"],[3554,"انا الوالدة وجوري وقت ذبني",12,"استديو"],[3553,"اودعك وانتظر باشر يريته لا طلع فجره",19],[3552,"المن هالشمع والمن الحنة جاسم من دمة نحره تحنى",10,"استديو «سلام»"],[3551,"ما بين الصفا ومروى تسعي بالحجيج الناس",11,"استديو «سلام»"],[3550,"عطشانة اليتامى يا شاطي السلامة",10,"استديو «سلام»"],[3549,"الجراحات والدم المطلوب اينعت فالزمان منها خميل",11,"استديو «سلام»"],[3548,"مجروح قلب المختار ويسيل دمع الكرار",17,"استديو «الرزايا»"],[3547,"أنا زينب يالعفتني بوي عقبك يتمتني اشحسبت من ودعتني",14,"استديو «الرزايا»"],[3546,"تذكر كسرها ومحنة دهرها اتعنا لقبرها وراح حسين",13,"استديو «الرزايا»"],[3545,"لولا سقوط جنين فاطمة لما اودى لها في كربلاء جنين",9,"استديو «الرزايا»"],[3544,"قضت ليلة بعد ليلة تمر بينا تودعنا وتيتمنا يا والينا",15,"استديو «الرزايا»"],[3543,"كل ما نوقف بمحراب نذكر نورك اللي غاب",19,"استديو «الرزايا»"],[3542,"دنيانا من بعد النبي وحشة ومظلمة بس انت يمة يا علي بس انت يمة",12,"استديو «الرزايا»"],[3541,"بعينك لون ضاق الفضا اقصد يا زاير للرضا",18],[3540,"يالمهدي يومك صار تترقبك انظار عين الطليعة",30],[3539,"انا زينب يا عباس وإليَّ عتاب بيمن يا قمر وصاك داحي الباب",9,"نعي"],[3538,"وينك يا علي وينك يا كرار شبو بالقلب نار",24],[3537,"نار قلب العطشان نار فقد الوليان نار حرق الصيوان",31],[3536,"يبو فاضل قطع بيّه زماني يخي وليت غدر عقبك ولاني",21],[3535,"يابن الاطهار النجباء لا تنسى يوم الزهراء / لبيك يا مهدي",28],[3534,"سائلا بالمصاب من يرد الجواب يابن عم الرسول اين قبر البتول",28],[3533,"الكون ينعاه ويشهد الله حزنا بكيناه لما فقدناه",29],[3532,"يالأكبر قوم حاكيني سلبت النوم من عيني",30],[3531,"نحسب محن يالغايب والدنيا تدري اشبيها بس انت لتصفيها",30],[3530,"مسلم قدم يا برهان جاوب يالعندك ايمان",22],[3529,"الحزن يقطع لي كبدي يا ربي ارجع لي ولدي",23],[3528,"اجيتك للدفن لن شفت يمك حضر جدي علي والزهرا امك",21],[3527,"داحي الباب شلون انصاب شلون انصاب داحي الباب",13,"استديو «ولي الله»"],[3526,"رأسك ام قلب المختار قد خضب عرش الجبار",12,"استديو «ولي الله»"],[3525,"اه عليك يالمرتضى",7,"استديو «ولي الله»"],[3524,"يا علي يا علي يا علي / جينا لارض النجف ودخلناها",9,"استديو"],[3523,"سيف الله انطبر بالسيف وتخضب بمحرابه",10,"استديو"],[3522,"يا شايل نعش الوالي ريض مشيتك تانيني وارحم حالي وانا ارتجيتك",11,"استديو «ولي الله»"],[3521,"الفضا تغير عقب حيدر قلت يظهر عند المحشر",9,"استديو «ولي الله»"],[3520,"وا علياه وا مظلوماه يا سيف الطبر والده وا إماماه",6,"استديو «ولي الله»"],[3519,"داحي الباب شلون انصاب شلون انصاب داحي الباب",22],[3518,"يا ريت الموت يلفيني وسكنت لحود ولا سلمت بيدك يا عباس الجود",7,"نعي"],[3517,"يا كرار يا كرار يا وسفة يا حامي الحمى",9],[3516,"قبرك جمعنا وللطف رجعنا نمشي على جمرة نار",30],[3515,"موقف مذبح اسماعيل بالقرآن يتوضح",6],[3514,"حين طاح الأكبر وبدره اختفى صاح ابو السجاد عالدنيا العفى",14],[3513,"يا زينب خبريني على حسين وبنيني مشوا عنّى وكثر ونّي",23],[3512,"يلما تنسى ثارك ملينا انتظاراك يتأملك يالمنتظر ضلع الوديعة",32],[3511,"هذا الغريب منين وين اهله راحوا وين مات بسجن مظلوم",28],[3510,"يا حيدر اشغيبك محرابك يخاطبك",30],[3491,"يا جراح يا جراح علي اشحالة",17],[3490,"قابلت الشمع نجري الدمع شيصبر العين",23],[3489,"مظلوم حسين حسين حسين حيسن مهموم حسين ..",11],[3488,"هالدنيا عاشت كلها بخيالك من دمك اخذت صورة جمالك",36],[3487,"دنيانا من بعد النبي وحشة ومظلمة بس انت يمة يا علي بس انت يمة",29],[3486,"على كيد همومي والأحزان على جمر الهضم والأشجان",5,"نعي"],[3485,"صحت شيصير ردت تفسير شفت بالطيف هاي العجايب",27],[3484,"هذا علي السجاد اتى لدفن الأجساد العين تبكي والقلب يحكي",26],[3483,"ما ننساكم ما ننساكم نتأسف ما عشنا وياكم",11],[3482,"ليش العوالم مظلمة وتنزف دما عيون القمر",29],[3481,"ننساك ما نقدر ننساك اسمك عايش ويانا حبك يجري ويا دمانا",15],[3480,"ما انسى عاشور ذبحوا زلمنا و حركوا خيمنا بالطف",35],[3479,"وياكم وياكم عشنا بحزن وياكم",3],[3478,"مجروح قلب المختار ويسيل دمع الكرار",39],[3047,"ما بين الصفا ومروى تسعي بالحجيج الناس",5],[3046,"حملني الشهب وبقلبي حملت ناره",12,"كربلائي"],[3045,"يا الله يا الله يا من لا معبود سواه",7],[3044,"يابن خير الخلق خذ مني سلامي يا امامي",4],[3043,"قبل التكوين صار التدوين بالحاء وسين والياء ونون",23],[3042,"انا ام الشهيد ومحزوز الوريد جرى دمع العزاء لمسلوب الرداء",30],[3041,"بقلب دامي وجفن مجروح بالدمعة شفت سيد الرسل",6,"نعي"],[3040,"هاي الوديعة فاطمة من شيعتها وين دفنتها يا علي",25],[3039,"محمد يا محمد يامحمد يا محمد بالحزن تهتف الزهراء",17],[3038,"على من ينحب المظلوم ودمع عيونة يتجارى",11],[3037,"سادس بدر مفقود وشفنا الليالي السود من غابت انوارة",26],[3036,"سايد خطت عين الغزالة تقول سايد مثل فتية بني عدنان",20,"ابوذيات"],[3035,"ويابن البتول وحسبي بها ضمانا على كل ما ادعي",20,"ابوذيات"],[3034,"يمن قطقوا القوم يسارك ويمناك يبو فاضل",6,"نعي"],[3033,"انا زينب وجيت اليوم اقبل منك المنحر",20,"نعي"],[3032,"عفتني وعفت يمي رضع واطفال",22,"نعي"],[3031,"انا بعالم الذر وياك يا حسين كتبت عهدي",23,"نعي"],[3030,"فداءً لمثواك من مضجع تنوّر بالأبلج الأروع",18,"استديو - شعر"],[3029,"تهدمت والله اركان الهدى",3,"استديو «واعليا»"],[3028,"ان كان عندك عبرة تجريها فانزل بأرض الطف كي نسقيها",10,"استديو «بنت علي»"],[3027,"انا الذبيح على الأرض عافوني اتمنى جدي ووالدي يشوفوني",22],[3026,"انا الزهرا وما ادري كسرك اصعب لو كسري",29],[3025,"تنذبح ظامي خابت احلامي وانا كانت ظنتي انت تحضر دفنتي",27],[3024,"يا مسلم اسمع شكوتها طفلة تنادي تهل دمعتها",13],[3023,"ريتك حاضر يا بو الحملة ريتك حاضر مسلم حاير",14],[3022,"علي علي يا علي رزؤ به الدين قد هدت قوائمه",10,"استديو «يا علي»"],[3021,"لا تسل ماذا جرى انه دمي جرى",15,"استديو"],[3020,"طول لوداع الوصي يا ليلها يغادر بصبحك اليحمي دخيلها",7,"استديو"],[3019,"طفلة وتهضموها لمن تعفوها عدمن تخلوها",17,"مشترك مع شاعر"],[3018,"اجتنا يالعقيلة رسالة من العليلة تقول الهم لفاني",21,"مشترك مع شاعر"],[3017,"قبل ما تروح وتهاجر يا طير الصاف تانيني",18,"مشترك مع شاعر"],[3016,"يا مسافر وين تريد لا ترحل عني بعيد",22,"مشترك مع شاعر"],[3015,"تبا لكي يا امتي بدر هوى من امتي هذا علي هذا علي",14,"مشترك مع شاعر"],[3014,"يا آل سفيان كفى يا أمة الطغيان هذا شبيه المصطفى",21,"مشترك مع شاعر"],[3013,"حضر بالطف رسول الله وتحير فقد جاسم أشد لو فقد الأكبر",20,"مشترك مع شاعر"],[3012,"حضر عندك علي جدك علي جدك حضر عندك",23,"مشترك مع شاعر"],[3011,"آه لمصابك يا زين عبادها زلزل العالم وسبع شدادها",7],[3010,"قلبك سفينة نوح يا خامس اهل النوح",23],[3009,"راية محمد خليها بيدك سجل ملاحم من دم وريدك",24],[3008,"شلون اصبر على الآه واترك نحيبي",26],[3007,"ويلي على المسموم قضى العمر مهموم",15],[3006,"جاءت اليه من السماء وبكفها ثوب البهاء",24],[3005,"هاي ام الأكبر هاي ساهر جفنها",12,"كربلائي"],[2906,"الله قد ارادها لعرشه استعادها",14,"استديو «بنت محمد»"],[2905,"يا زهراء نقسم بالضلع المهشوم",11,"استديو «بنت محمد»"],[2904,"يا حسين حادي ضعوننا عزم على الشيل",15,"كربلائي"],[2903,"يحق لمقلتي تهمي الدموعا على من رضضوا منها الضلوعا",9,"استديو «بنت محمد»"],[2902,"دارك يا علي كانت امس دار الإمامة",11,"استديو «بنت محمد»"],[2901,"شلون انجمعن دمعة وجمرة لمصابك يا ام العترة",7,"استديو «بنت محمد»"],[2900,"دفعوا باب الدار بوية وبصدري البسمار بوية",24,"استديو «بنت محمد»"],[2899,"عذبني درب الشام ما طبق جفني ونام",20,"استديو"],[2898,"حضر عندك علي جدك علي جدك حضر عندك",14,"استديو"],[2897,"الرأس المقطوع يا حيدر يا حيدر ياحيدر",11,"استديو"],[2896,"ميعادك صار يالأكبر مطلوب بثار من حيدر",19,"استديو"],[2895,"سلام الله على الخد التريب سلام الله على الشيب الخضيب",15,"استديو"],[2894,"حضر بالطف رسول الله وتحير فقد جاسم أشد لو فقد الأكبر",16,"استديو"],[2893,"يلما تنسى ثارك ملينا انتظاراك يتأملك يالمنتظر ضلع الوديعة",13,"استديو «بنت محمد»"],[2892,"صار الفرح نوح ودمع طفوا الشمع طفوا الشمع",22,"استديو"],[2891,"هاي امي لربتني ولهاذا الموقف رادتني",17,"استديو"],[2890,"حسين حسين حسين .. يا حسين حادي ضعوننا",6,"استديو «اقصدوني» كربلائي"],[2889,"يا سائلي عن فاطمة مصابها ما اعظمه",11,"استديو «اقصدوني»"],[2888,"اقصدوني فأنا اسمي الحسين",10,"استديو «اقصدوني»"],[2887,"ناحت سكنة وزينب يمها",9,"استديو «اقصدوني»"],[2886,"رقية فزت من النوم (حسين وبنتك شصار عليهم بس الخالق يعلم بيهم)",9,"استديو «اقصدوني»"],[2885,"هاي الطاهرة الي قدمت اربع كواكب",9,"استديو «اقصدوني»"],[2884,"نارين شبوها القوم نارين تسعر لليوم",9,"استديو «متى الملتقى»"],[2883,"يالغايب ما تهتم لو عندك انصار",11,"استديو «متى الملتقى»"],[2882,"بشعوري انرسمت الصورة وغديت انحب",3,"استديو «متى الملتقى» شعر عامي"],[2881,"ما اعلم بيا يوم يا ساعة اظهر",14,"استديو «متى الملتقى»"],[2880,"يا مهدي .. بريد القلب وافاك سئمت العيش لولاك",9,"استديو «متى الملتقى»"],[2879,"يم شاطي الصبر تنتظرك رايتي وانا الموعود",5,"استديو «متى الملتقى»"],[2878,"بالطف لو كنت موجود يوم العاشر بعاشور",11,"استديو «متى الملتقى»"],[2877,"العليلة تنوح على المذبوح بقلب مجروح",9,"استديو «اقصدوني»"],[1087,"كل قطرة دم بشرياني تهتف بإسمك يا حسين",35,"(قراءة1)"],[1086,"يا علي يا علي لا فتى إلا علي",9],[1085,"بإسمك ينادي صوت المنادي ما يجري",24],[1084,"مسلم عليك الروح ولهة وحزينة",4],[1083,"رسول الله ونبيه إلك مني هدية",18],[1082,"عشاق الحسين(2) خذ يا سيدي عهد",8],[1081,"لسان الحرب قد كبر بصوت الثأر يا حيدر",25],[1080,"لبيك يا حسين لبيك يا حسين",8],[1079,"بالخيم فرحة وبشاير بالحرب خيل",25],[1078,"من هيبة المنظر ما تفهم العسكر",18],[1077,"الله الله يا حامي الشريعة",11],[1076,"يا ريت تطول لا تخلص يهالليل",6],[1075,"تودع زلمها العايلة تودع زلمها",27],[1074,"هلال شهر الحزن من وافانا",13],[1073,"قسماً بدمائك يا حيدر وبشبلك محزوز",29],[1072,"يالقاصد لقبر حسين اوقف وانحني",9],[1071,"نحرك مذبوح دمك مسفوح ثارك ما يروح",28],[1070,"دمك يا محزوز النحر يجري يظل",5],[1069,"حمّاي الدخل يا حسين كل الواد",14],[1068,"طفلة وشفت بالنوم كأن والدي المظلوم",20],[1067,"إشهد يا تاريخ والدنيا تشهد بالدم تخلد",46],[1066,"أربعة ومن تنخاهم قلعة عزم تلقاهم",11],[1065,"هاي الحزينة الوالهة متوجهة لرب",22],[1064,"يا فرسان الوغى ويا رعد لو دمدم",5],[1063,"يالغايب ما تهتم لو عندك أنصار ولثارك",21],[1062,"يا عباس عقب والينا يا عباس حرم",14],[1061,"يا شاطئ الموت حاكيني أنا العباس",29],[1060,"شمعة ودمع وخيام والآلام تختمها",17],[1059,"جمر مصاب بالقلب يسعر جمر مصاب",8],[1058,"يا روح وأغلى من الروح والله مو هينة",17],[1057,"هذا علي المرتضى تبكي له الزهراء",26],[1056,"كل ما تمر بنا هموم مصدرها من هذا",34],[1055,"يا أبا الحسن أنت الولي يا علي",6],[1054,"كل ما نوقف بمحراب نذكر نورك",24],[1053,"فكري احتار شنهو اللي صار",20],[1052,"علي علي علي علي يا علي",4],[1051,"حاء وياء ودال وراء حيدر(3) إسم تعشقه",23],[1050,"دنيانا أمست مظلمة وانفجعت",6],[1049,"بأبي أنت وأمي يا حسين",12],[1048,"لو ما ينذبح والينا ما حرقوا",7],[1047,"يا طير خبر النبي عما جرى",9],[1046,"شفت بالنار خيمة مستعرة ذكرت الدار وفاطمة الزهراء",33],[1045,"أم البنين الحرة مهمومة تجري العبرة",12,"استديو «الزهراء في كربلاء»"],[1044,"تذكر كسرها ومحنة دهرها اتعنا لقبرها وراح حسين",32],[1043,"عثر الدهر ويرجوا أن يقال تربت كفك من راج محال",15],[1042,"يا مسافر وين تريد لا ترحل عني بعيد",37],[1041,"مكسورة خاطر جيتك تنظر حالي تمنيتك",25],[1040,"ميعادك صار يالأكبر مطلوب بثار من حيدر",47],[1039,"إلك قلبي انفجع عبد الله يا ابني يا ابني",19],[1038,"وعدك وينه صاحت زينب وعدك وينه",17,"استديو"],[1037,"يا حسين هاي عيالك يا حسين هاي اطفالك",10,"استديو «عودة السبايا»"],[1036,"عين الجلالة تنظرك والباري عظم أجرك",29],[1035,"حضر بالطف رسول الله وتحير فقد جاسم أشد لو",34],[1034,"يا آل سفيان كفى يا أمة الطغيان هذا شبيه المصطفى",30],[1033,"حضر عندك علي جدك علي جدك حضر عندك",31],[1032,"صار الفرح نوح ودمع طفوا الشمع طفوا الشمع",34],[1031,"رجع ضعن العقيلة بعد غيبة طويلة",36],[1030,"يا أيها المظلوم قم واستقبل الحوراء",38],[1029,"يا يوم أشوف اعتابك وأقف حزين ببابك",39],[1028,"يا حالة أصعب عند الرسول طبرة علي لو ضلع البتول",21],[1027,"طفلة وتهضموها لمن تعفوها عدمن تخلوها",23],[1026,"يا آل قومي عدنا إليكم والدمع يجري حزناً عليكم",24],[1025,"يا ريح الهاب وياك وديني ازور أحباب غياب عن عيني",28],[1024,"قبل ما تروح وتهاجر يا طير الصاف تانيني",25],[1023,"عابس يصيح بصوت يا من تسمعوني جنني حب حسين",25],[1022,"العلم عالقاع يا حيدر يا بوي ومنك اتعذر",29],[1021,"يا شايل نعش أبوي قبل لا يدفنونه",27],[1020,"اليوم مات جدي الرسول اليوم ماتت أمي البتول",26],[1019,"إحنا أنصارك من أفكارك فكرتنا تظهر",28],[1018,"يلوموني دمعتي عليك أجريها وما يدرون إلك هالروح",14],[1017,"ذبني الدهر يا جسام قلبي انفطر يا جسام / يالعايش بوسط الروح",16],[1016,"سور البنيته طايح لقيته",16],[1015,"لو تنشد عن أول زاير بالناس راح وقصده ينول زيارة عباس",18],[1014,"يا كرار يمك حضرنا يا كرار ويتامى صرنا",18],[1013,"إلك يا حسين جرت كل عين نظل طول العمر ننعاك",19],[1012,"أمك أنا يا حسين طفلك وين دليني",19],[1011,"عباس يا عباس من يروي العطشان",20],[1010,"يا أيها الأكبر تسقى من الكوثر",22],[1009,"يومك يا حامي الجار مثله على مسلم صار",23],[1008,"جاسم يا روحي ودلالي أنا امك قوم انظر حالي",5],[1007,"صوبني مصابك يالأكبر",5],[1006,"يا ابن أمي على التربان عفتك رمية",6],[1005,"يا ابن الحسن خليني اذكر أتعاب سنيني",8],[1004,"الوداع الوداع يا ابن أمي الوداع",9],[1003,"طاح من دار المجد عامودها وآل أمية حصلت مقصودها",9],[1002,"أنوحن والمدامع عالوجن نهران - السيدة الزهراء عليها السلام",9,"نعي"],[1001,"يا شايلين النعش رحتوا بالنعش وين",10],[1000,"وانفجعت أملاك السماء يا كرار يا كرار",10],[999,"يا ما أحلى الوداع بهالمسية",12],[998,"خوي الليل أدري بيك يفجعني",12],[997,"رداديات",11,"استديو"],[996,"يا ولدي يا عبد الله .. يالحرموك من الماي",13],[995,"حالة بحزن ننظرها ونقارن مصادرها الأكبر لو نبي",28],[994,"يا سائلاً أين الإحسان اليوم أمسى في الأكفان",24],[993,"يا عباس فقدك هضمنا يا عباس حرقوا خيمنا",27],[992,"فداءً لمثواك من مضجع تنوّر بالأبلج الأروع",11],[991,"سلام الله على الخد التريب سلام الله",24],[990,"إن كان دين محمد لم يستقم إلا بقتلي",18],[989,"إن كان عندك عبرة تجريها",6],[988,"حرم عندي وحق جدي سواد الليل أمهلوني",25],[987,"كبدك وكبدي يا ابن الزكية بين سم وسهم",13,"استديو «الإمام الحسن المسموم»"],[986,"نمرض كبدي قرب وعدي يا ابو اليمة",11,"استديو"],[985,"وسط القلب يا حسين نارك وناري",13,"استديو «الإمام الحسن المسموم»"],[984,"يا حيدر قوم واسكب العبرة",13,"استديو «الإمام الحسن المسموم»"],[983,"بيا حالة شافت فاطمة عبد الله مخضوب بدماء",12,"استديو «الزهراء في كربلاء»"],[982,"بت حيدر بعبرة تستقبل الزهراء",13,"استديو «الزهراء في كربلاء»"],[981,"عليل ينادي بالعبرة أظنها حضرت الزهراء",15,"استديو «الزهراء في كربلاء»"],[980,"هذا حسين ها هنا قد مزقوه بالقنا",9,"استديو «الزهراء في كربلاء»"],[979,"يا زهرا يا زهرا يا زهرا يا زهرا",4,"استديو «الزهراء في كربلاء»"],[978,"تقاسمت الرزايا مع القوم الضحايا",10,"استديو «بنات الحسين»"],[977,"عقب عزنا يا ابو سكينة صرنا نتستر بدينا",12,"استديو «بنات الحسين»"],[976,"قبل ما تروح وتهاجر يا طير الصاف تانيني",13,"استديو «بنات الحسين»"],[975,"يا ريح الهاب وياك وديني ازور أحباب",16,"استديو «بنات الحسين»"],[974,"يا بوي شلي بعمري وتيتمت من صغري",19,"استديو «بنات الحسين»"],[973,"هذا صوت حسين ظهر من نحره",5,"استديو «يا فاطمة»"],[972,"فضة بحزنها تنادي مظلومة بنت الهادي",15,"استديو «يافاطمة»"],[971,"هذا اللي صار بعد المختار غصبوا حقي",12,"استديو «يا فاطمة»"],[970,"أنوحن والمدامع عالوجن نهران",6,"استديو «يا فاطمة»"],[969,"الواثبين لظلم آل محمد ومحمد ملقى بلا تكفين",7,"استديو «يا فاطمة»"],[968,"أم أبيها من سينجيها من مآسيها",8,"استديو"],[967,"أم الحزن زينب يم اللي قتل مرحب",16,"استديو «يا فاطمة»"],[966,"نتأمل يومك يالمهدي وصوتك ننتظره",13,"استديو «يا فاطمة»"],[965,"بأي ذنب دمي جرى",20,"استديو"],[964,"والله لن انساك يا كربلا لو قطعوني مفصلاً مفصلا",32],[963,"خدام حسين اتسمينا",6],[962,"رأسك يا اين الطهر شمس الصباح",16],[961,"أم البنين بهالإسم بارينا سماها",9],[960,"يا سائلاً عني خذ عبرة مني",31],[959,"حنين الناقة ما يوصل لحني/آه يا ابني يا جسام",17],[958,"أنا الأكبر وخالد يظل إسمي",13],[957,"تباً لك يا أمتي بدر هوى من عترتي هذا علي",31],[956,"حيدر حيدر حيدر حيدر هالصرخة تهز الأكوان",17],[955,"يا سائلاً أين الإحسان اليوم أمسى في الأكفان",16,"استديو «الإمام الحسن المسموم»"],[954,"من ظلم الدهر قلبي انكسر خوي يا عباس",17,"استديو «بنت علي»"],[953,"خوي اشبديّ يا ابن الزكية",13,"استديو «بنت علي»"],[952,"يالزاير طوف حضرتها وبعينك شوف هيبتها",18,"استديو «بنت علي»"],[951,"يا ابن أمي جارت الدنيا علينا",13,"استديو «بنت علي»"],[950,"يا دهري يا غدار أنا العقيلة",12,"استديو «بنت علي»"],[949,"بكتك أملاك السماء يا حسين",7,"استديو"],[948,"أناشدكم واريد تجاوبوني",11,"استديو"],[947,"أنا الغريب بقيت بين آل أمية",9,"استديو"],[946,"حسيناً واحسيناً واحسيناه",10,"استديو"],[945,"يا تريب الخد في أرض الطفوف",11,"استديو"],[944,"واذبيحاً غسلته الماضيات واحسيناه",5,"استديو"],[943,"سيد الرسل يفتح سجل ولأمته يعاتبها",14,"استديو"],[942,"محمد يا محمد نريدك أنت تشهد",13,"استديو"],[941,"هذا علي مع الرسول كل بجمع الأسى يقول",10,"استديو"],[940,"أقمار الغوالب غابت بالحرايب",16,"استديو"],[939,"عفت قبري بدمع يجري",14,"استديو"],[938,"مصاب اللي جرى بعاشور غيّب شمس وبدور",12,"استديو"],[937,"سل كربلا كم من حشاً لمحمد نهبت بها",6,"استديو"],[936,"يا شايلين النعش رحتوا بالنعش وين",6,"استديو «واعليا»"],[935,"يا يوم علي حسبنا الله وللقلب نداء واعلياه",13,"استديو «واعليا»"],[934,"ناعي الموت صاح ونعى الله من هالفاجعة",9,"استديو «واعليا»"],[933,"غيل مولانا غاب رجوانا واعليا واعليا",17,"استديو «واعليا»"],[932,"أين الطالب بدم المقتول بكربلاء",6,"استديو"],[931,"يا مهدينا الضلع ما ننسى ثاره",13,"استديو"],[930,"طال الوعد طال يا موعود يا موعود",7,"استديو"],[929,"يا غائباً عنّا ولست بغائب/أما تدري بما يجري",11,"استديو"],[928,"يا مهدينا الوعد وينه",16,"استديو"],[927,"تصيح أم البنين الهم كفاني",10,"استديو"],[926,"أم البنين بهالإسم بارينا سماها",15,"استديو"],[925,"حزناً بكينا لما رأينا مصيبة السجّاد",23,"استديو"],[924,"أنا أم البنين وعهدي وفيته",4,"استديو"],[923,"يا أم البنين يا أم البنين",3,"استديو"],[922,"انعم جواباً يا حسين أما ترى (نعي) + قف بالطفوف وجد بفيض الأدمع (استديو)",13,"استديو «عودة السبايا»"],[921,"عائلة وأيتام من الشام ردينا",21,"استديو «عودة السبايا»"],[920,"ذبيح مسلّب ابن أمي مشيت وعفته عالغبرة",13,"استديو «عودة السبايا»"],[919,"من اليسر يا عباس رجعت ضعوني",14,"استديو «عودة السبايا»"],[918,"قد أوهن جلدي الديار الخالية",8,"استديو «يا حسين»"],[917,"من البين يا حسين من صغري وشاب الراس",11,"استديو «يا حسين»"],[916,"قل لي يالميمون وين والينا",10,"استديو «يا حسين»"],[915,"محتار كم لوعة شفت محتار أمشي وألتفت",11,"استديو «يا حسين»"],[914,"كل قطرة دم بشرياني تهتف بإسمك يا حسين",23,"استديو «يا حسين» عربي وأوردو"],[913,"طيفك عايش بين عيوني (وين بنعش أبونا تريد بيه ريّض يشياله)",12,"استديو «في مصاب أبي تراب»"],[912,"يا بوي وياك اريدن ينحفر قبري",17,"استديو «في مصاب أبي تراب»"],[911,"علي يا علي علي يا علي",9,"استديو «يا علي»"],[910,"أنت نبراس الكرامة بس إلك تحلى الزعامة",22,"استديو «يا علي»"],[909,"علياً يا علياً يا علياً يا عليا",13,"استديو «يا علي»"],[908,"مولاي علي خير ولي فارس خيبر",12,"استديو «يا علي»"],[907,"جمال الكون بشفافك القلب مفتون بأوصافك",8,"استديو «يا علي»"],[906,"أنا حبي علي وغرامي علي مولاي علي",11,"استديو «يا علي»"],[905,"عفت قبري بدمع يجري",15],[904,"وين أتجه يا عباس حيرني دهري",23],[903,"يا يوم أشوف اعتابك وأقف حزين ببابك",14,"استديو"],[902,"الدهر عقبك غدر بينا يا هادينا",7,"استديو"],[901,"السلام على الدماء السائلات",23],[900,"زينب رجعت قوم اسألها",12],[899,"يا حبيبي يا حسين نور عيني يا حسين",9],[898,"يا هلال ما تانيتك يا هلال غايب ريتك",15],[897,"ريحانة المصطفى يا كعبة للوفى",21],[896,"حنينا لقبرك يا حسين حنينا",4],[895,"لأبكينّ عليك بدل الدمع دما",28],[894,"ليش أبو السجاد شدّ رحاله",11],[893,"ياللي رحتوا بضعينة شعدكم بالمدينة",16],[892,"قلبي عاشق كربلا شلون افارق كربلا",7],[891,"من ظلم الدهر قلبي انكسر خوي يا عباس",13],[890,"يا جاسم أنا حسين عمك وأدير العين",33],[889,"يا خضيباً بالدماء قم فقد حان اللقاء",12],[888,"يالأربعة الطيبين ودعوني ودعوني",23],[887,"مهلاً مهلا يا ابن الزهراء",17,"استديو «لبيك يا حسين»"],[886,"طلعن خوات حسين طلعن يسألنّ",13,"استديو «لبيك يا حسين»"],[885,"حسين يلوموني دمعتي عليك أجريها",8,"استديو «لبيك يا حسين»"],[884,"ريحانة المصطفى يا كعبة للوفى",18,"استديو «لبيك يا حسين» عربي وفارسي"],[883,"حيدر يا حيدر حيدر لحسين نحن عشقنا",7,"استديو"],[882,"قسماً بدمائك يا حيدر وبشبلك محزوز المنحر",11,"استديو"],[881,"حمّاي الدخل يا حسين كل الوادم يشهدون",15,"استديو"],[880,"يالمهدي يومك صار تترقبك أنظار",13,"استديو"],[879,"يآيها النبأ العظيم",11,"استديو"],[878,"إلك قلبي انفجع عبد الله يا ابني",11,"استديو"],[877,"يا ولدي خلي الماي لا تطلب الماي",9,"استديو ، مع حمزة الصغير"],[876,"نار بدليلي تسعر ما تنطفي يالأكبر",11,"استديو ، مع حمزة الصغير"],[875,"سهم النايبة بعيني وين اللي يدليني",17,"استديو ، مع حمزة الصغير"],[874,"يا ابني اللي ضيعتني بضيعتك مني",9,"استديو ، مع حمزة الصغير"],[873,"انا أم البنين ودهري ذبني",17,"استديو ، مع حمزة الصغير"],[872,"علي علي يا علي",9,"استديو"],[871,"تحكيلك الزوار ناشدها ناشدها - السيدة رقية",12,"استديو"],[870,"يا زاير زينب اقصدها تحصل رادتك عندها",12,"استديو"],[869,"يالقاصد لقبر حسين اوقف وانحني ببابه",13,"استديو"],[868,"بعينك لون ضاق الفضا اقصد يا زاير للرضا",14,"استديو"],[867,"العلم عالقاع يا حيدر",20,"مشترك مع شعر"],[866,"قبرك جمعنا وللطف رجعنا",22,"مشترك مع شعر"],[865,"يالمهدي يومك صار تترقبك أنظار",26,"مشترك مع شعر"],[864,"هاي أمي اللي ربتني",23,"مشترك مع شعر"],[863,"يالساكن بعيني يا زهرة سنيني",20,"مشترك مع شعر"],[862,"يا جاسم أنا حسين عمك وأدير العين",20,"مشترك مع شعر"],[861,"ناديت تدري بحالي يا ريت تدري بحالي",10],[860,"سلامي لأبو اليمة أريد ابعث سلامي",20],[859,"يا تريب الخد في أرض الطفوف",10],[858,"ودعتني صدعتني واندعيلك للخيم سالم تجي",28],[857,"أبثّ الهمّ والشكوى ألا يا صاحب الأمر",27],[856,"روحي خلصت ودعوني سهم اليسر بعيوني",24],[855,"حرت وعيوني ما ينشف دمعها صدق أم الحسن",24],[854,"عن محبتك يا بو اليمة",27],[853,"أم الحزن زينب يم اللي قتل مرحب",29],[852,"ان قتلونا أو تركونا فالأمر موحّد",26],[851,"صاحوا فرد صيحة الأهل والأنصار",11],[850,"يا عباس من عقبك وين الحرم",16],[849,"يا حسين أطفالك بحماية عطشانة وتنظر للراية",20],[848,"بأي ذنب دمي جرى والجسم مني فوق الثرى",30],[847,"يا زهرة سنيني يالساكن بعيني",54],[846,"وعدك وينه صاحت زينب وعدك وينه",31],[845,"أنا زينب يالعفتني بوي عقبك يتمتني",21],[844,"علي رمز الشجاعة ومصدر الإيمان",6],[843,"عذبني درب الشام ما طبق جفني ونام",37],[842,"بضعة داحي الباب زينب شافت كم مصاب زينب",26],[841,"من اليسر يا عباس رجعت ضعوني",16],[840,"لست أدري يا من قتلوه ظامي",18],[839,"السلام على المظلومة السلام على المهضومة",18],[838,"حضرنا وياك يا حيدر نقيم النوح ونخبرك",20],[837,"تندب الحوراء وهي باكية أين خير الصالحات الباقية",6],[836,"أنا الكرار يا زهراء لن أنساك ما أحيا",10],[835,"قال الرسول فاطمة بضعة مني",24],[834,"صرخت بالحزن بنت المصطفى",27],[833,"مظلومة يا فاطمة مغصوبة يا فاطمة",10],[832,"ليلة توديع وبكاء وعلي يوصي الأبناء",16],[831,"قد خلقنا للجهاد ولنا صوت ينادي",23],[830,"وسط القلب يا حسين نارك وناري",25],[829,"يا حسين أرخصلك هالإخوة جربهم ساعات النخوة",29],[828,"السماء انفطرت والنجوم انكدرت حينما غاب الحسين",31],[827,"ريض يا حادي بالضعن وخليني اعاتب",8,"استديو ، مع جليل الكربلائي"],[826,"يا حبيبي يا حسين نور عيني يا حسين",19,"مع جليل الكربلائي"],[825,"على من ينحب المظلوم ودمع عيونه يتجارى",13,"مع جليل الكربلائي"],[824,"إحنا غير حسين ما عدنا وسيلة",34,"مع جليل الكربلائي"],[823,"إجن واتجمعن كل الحرم يمك",30,"مع جليل الكربلائي"],[822,"إلك نزحف يا ابو السجاد لو نبكي على أصحابك",7,"مع جليل الكربلائي"],[821,"أيها الناس اسمعوني وانسبوني جدي محمد",44,"مع جليل الكربلائي"],[820,"يالغايب نسيت الثار لو يومك بعد أمره",16,"مع جليل الكربلائي"],[819,"يا حسين نبايع بالدم وبالأرواح",6,"مع جليل الكربلائي"],[818,"قبرك جمعنا وللطف رجعنا",17,"استديو ، مع جليل الكربلائي"],[817,"عالمشرعة العباس صاب السهم عينه",12,"استديو ، مع جليل الكربلائي"],[816,"جيتك يا عباس وجبت هالحرم وياي",9,"استديو ، مع جليل الكربلائي"],[815,"عباس يا درة علي المكنونة",5,"استديو ، مع جليل الكربلائي"],[814,"ما أنا اختك يا عباس ناديتك يا عباس",7,"استديو ، مع جليل الكربلائي"],[813,"اللي يعرف مصابي - الإمام السجّاد ع",15,"استديو ، مع جليل الكربلائي"],[812,"يا زماني هذا حالي - الإمام الباقر ع",13,"استديو ، مع جليل الكربلائي"],[811,"بمصاب الصادق - الإمام الصادق ع",11,"استديو ، مع جليل الكربلائي"],[810,"اسكبوا دمع العيون - الإمام الكاظم ع",15,"استديو ، مع جليل الكربلائي"],[809,"لكل قلبٍ سيدي - الإمام الرضا ع",12,"استديو ، مع جليل الكربلائي"],[808,"يا مناراً للعباد - الإمام الجواد ع",15,"استديو ، مع جليل الكربلائي"],[807,"يا هادي الأنام - الإمام الهادي ع",14,"استديو ، مع جليل الكربلائي"],[806,"أمامنا الحادي عشر-الإمام العسكري ع",9,"استديو ، مع جليل الكربلائي"],[805,"يا ابن أمي انقطع قلبي",10,"استديو ، مع جليل الكربلائي"],[804,"يمه ذكريني من تمر زفة شباب",6,"استديو ، مع جليل الكربلائي"],[803,"يا بحراً يتفجّر أنت علي الأكبر",14,"استديو ، مع جليل الكربلائي"],[802,"قالوا لي عبد الله انفقد ظليت اعاين",14,"استديو ، مع جليل الكربلائي"],[801,"أنا زينب يالتودعوني",16,"استديو ، مع جليل الكربلائي"],[800,"مظلومة مظلومة والزهراء مظلومة",17,"مع جليل الكربلائي"],[799,"دفعوا باب الدار بوي وبصدري البسمار",22,"مع جليل الكربلائي"]] }].concat([{"id":"jalil","n":"جليل الكربلائي","items":[[5020,"زينب تنادي يا حامي الظعينة لأرض المصايب يخويه لفينا",27],[5019,"قال علي في المحراب سمعوه كل الأصحاب",23],[5018,"أرأيت أختاً قدمت لشقيقها فرس المنون",17,"استديو «سر النجاة»"],[5017,"كيف أذل لهذا العسكر الله أكبر وانا أبن المعروف بحيدر",13,"استديو «سر النجاة»"],[5016,"زينب با دل خون باتشتمان كريوم يالرحتو بسلامة وظلت هل اليتامة",8,"استديو «سر النجاة» عربي وفارسي"],[5015,"سل كربلاء تنبيك ما القارعة فاجعة ما مثلها فاجعة",7,"استديو «سر النجاة»"],[5014,"كاروان",9,"استديو «سر النجاة» فارسي"],[5013,"مهمومة فاقدة طفلاً رضيعا وسوف أشكو لوعتي رباً سميعا",10,"استديو «سر النجاة»"],[5012,"سر النجاة مدى الحياة حتى الممات حب الحسين",8,"استديو «سر النجاة»"],[5011,"قوم لثارك لا تتأخر",4],[5010,"طال غيابك يا سيدي يا مهدينا يا مهدينا",7],[5009,"ظنوة حيدر ظنوة حيدر قوم لثارك لا تتأخر",5],[5008,"سهم النايبة بعيني وينه الي يدليني درب المشرعة منين",13,"استديو «وازينباه»"],[5007,"بت حيدر اتعرفوني بالعيلة لا توصوني احرسها بين عيوني",11,"استديو «وازينباه»"],[5006,"انا زينب انا المظلومة يا حسين",8,"استديو «وازينباه»"],[5005,"عمي يا راعي المجد انتظر منك ترد عوف جودك والعلم ما ريد الماي",9,"استديو «صاح ابو فاضل»"],[5004,"يا وليدي اختك ذمة برقبتك انت كافل يا ابو فاضل",7,"استديو «صاح ابو فاضل»"],[5003,"قسماً بالشفع وبالوتر والفجر وليال عشر",13,"استديو «صاح ابو فاضل»"],[5002,"صاح ابو فاضل يا اختي عذريني",8,"استديو «صاح ابو فاضل»"],[5001,"موعد عندي بهاي الحومة انا العباس",9,"استديو «صاح ابو فاضل»"],[5000,"كيف تعذر يا ابن حيدر طايح عضيدك يخوية على الثرى",10,"استديو «صاح ابو فاضل»"],[4999,"عمتي أين أبي",7,"استديو «رقيه في خراب الشام»"],[4998,"بويه بويه يا حسين عمتي سلوبها بسياط الأعادي تعاني من جور آل أمية",3,"استديو «رقيه في خراب الشام»"],[4997,"للطف رجعنا وجبنا الأهل بس طفلة ظلت خذها الأجل",10,"استديو «رقيه في خراب الشام»"],[4996,"ثم وضعت رقيه فمها (نعي)+ يا عمه ردي لهفتي ولا تخليني بحيرتي وين ابوي حسين",15,"استديو «رقيه في خراب الشام»"],[4995,"بابا حسين كجائي",9,"استديو «مدارس آيات» فارسي"],[4994,"مالومة بالحومة وانشد على حسين",10,"استديو «مدارس آيات»"],[4993,"يا ابن أمي انقطع قلبي وعيني ظلت ربيّة وين العلم وين الجود",16,"استديو «مدارس آيات»"],[4992,"دهري حنى ضلوعي وما نشفت دموعي",13,"استديو «مدارس آيات»"],[4991,"قوم حورب لعند عباس المشتر",8,"استديو «مدارس آيات»"],[4990,"تحيرني وتذكرني يا جابر لا تناشدني",10,"استديو «مدارس آيات»"],[4989,"مدارس آيات خلت من تلاوةٍ ومنزل وحي مقفر العرصات",10,"استديو «مدارس آيات»"],[4988,"وينك يا بويه يا علي بغربة ولا واحد ظل يمي",9],[4987,"هالأنصار الي نزلت لميدانها خل نشوف شعملت بعدوانها",8,"نزلة (قراءة2)"],[4986,"نحيا ونموت وياك وبكربلاء منعوفك أبداً يا ابن عقد الولاء",3],[4985,"نار ونور وعزة وعصمة ثورتك يا أبو اليمة",15],[4984,"ما ننساك يا ابو اليمة ما ننساك",8],[4983,"ظعن الفواطم يا حسين طف كربلاء حاديها",15],[4982,"خل يطشون السموم خل يلوم اللي يلوم",18],[4981,"العمر بالذل ما نريده إحنا انصار الإمامة لا حياة بلا كرامة",30],[4980,"إشهد إشهد كربلاء وأثارها وأنشد التاريخ عن أخبارها",8],[4979,"يا أمير المؤمنين انت نور المتقين",7],[4978,"ما كنت حاضر يا علي بالدار يا حيدر الكرار",17],[4977,"حيدر داحيها وحيدر يا واليها مهجة محمد للعدل راعيها",3,"هوسات"],[4976,"انهض يا ولينا بيك احنا انتخينا شمالك حيدرة ما تصد علينا",12],[4975,"انا ام البنين ودهري ذبني حقي لو صحت يا حسين يبني",16],[4974,"ضلعي انكسر ذبني البين يا حماي الحمية",16],[4973,"يا واليها يا واليها يا حسين لزينب حاكيها",10],[4972,"وين الوعد يا راعيها قلبي نمرد يا راعيها",3],[4971,"وقفت زينب عاتبت أحبابها والجسوم",11],[4970,"وشلون عيني تحبس لدمعتي وشلون اداري بغربتي لاخوتي",9],[4969,"ودعته ودعته ويّه الظعن دلالي والكان كل آمالي",14],[4968,"من شافت زينب حال أبوها الكرار مخضوب بدمه",2,"هوسات"],[4967,"من الخيمة طلعت زينب تنشد أثر واليها",12],[4966,"زينب إجت للميدان وتنادي يا ابو اليمة شافت جسمه على التربان",1],[4965,"زينب إجت من الشام ويه الحرم والأيتام قوم وشوف يا ابو فاضل",24],[4964,"إجت لحسين تحكي الحال خوي الموت ما له محال",2],[4963,"حوزتنا العلمية هاي الحسينية منها تخرجنا احرار مدرسة كل الثوار",23],[4962,"التاريخ يعرض حالات التاريخ يكشف غايات لا تعاتب",26],[4961,"مهدك الخالي عذب دليلي والدليل نفطر آه من الدهر",23],[4960,"المهد خالي من الولد والولد وينه والولد وينه",6],[4959,"للحرب يبني طلعت للخيم ليش رجعت بيدك السف وروح",17],[4958,"هالطفلة من الأيتام عفناها بديار الشام صوت الأجل ناداها",25],[4957,"يا ابني الضيعتني بضيعتك مني دوهني زماني بيك دوهني",9],[4956,"هالتجارب واضحة وما نعوفها بين جاسم وابن نوح نشوفها",10],[4955,"انطفت شمعة بليلة من أحلى الليالي وجرت دمعة بزفت الواحد الغالي",21],[4954,"جار الدهر والأيام وانطفت شمعة جسام بدال الحنة بدمه اتحنه",30],[4953,"ثوب العرس هاك روح الله وياك تهنه تحنه روح الله وياك",19],[4952,"بيك هالليلة الملا تهنيني مبارك عروسك يا سلوة عيني",10],[4951,"إلمن الحنّة جاسم تحنّة إلمن شموع الفرح ناح الحمام وصدح",12],[4950,"يا اختي عفتك غصب عني بكربلاء",8],[4949,"بطل بالغاضرية مثال العبقرية",27,"(قراءة2)"],[4948,"هاي الضماير كلها تناصر خوية يالتنشد وين اللي يناصر وين",21],[4947,"قوم يا رسول الله هذا المساءِ قد حل بالإسلام يوم العزاء",15],[4946,"قبل ما يلفك وصيك حيدر بثوب الكفن",11],[4945,"ايها العذّال كفّو للملام قد عشقنا المصطفى خير الكرام",5],[4944,"يمه متقومين طاح اخوي حسين بالغاضرية بالغاضرية",21],[4943,"يجاوبني ودمعته تحفر بخدي شكثر أصبر سنة وسنتين",9],[4942,"يا نزار وآل عدنان ولؤي شدو خيل الثار واطوا الكون طيّ",9],[4941,"يا مسلمين لكم هذا النداء حب الحسين وسيلة السعداء",14],[4940,"يا ليتنا كنا معك فنفوز فوزاً عظيما",11],[4939,"يالمنذبح عطشان يبني آه يبني يالعاري عالتربان يبني آه يبني",21],[4938,"يا عين جودي بالبكاء لا تجمدي وأبكي على سبط النبي أحمد",7],[4937,"يا سيدي يا سيدي يا حسين يا حسين حكمك للعدل يهدينا",5],[4936,"يا روح الزكية قتيل الغاضرية على التربان عفناك",24],[4935,"يا خوي خليناك عالغبرة عاري مغسل بفيض دماك",9],[4934,"يا حسين يلحبك ملك مهجتي انت الوسيلة وخدمتك غايتي",13],[4933,"يا حسين وياك نجاهد يا حسين والموقف واحد",19],[4932,"يا حسين عاهدناك يا حسين بايعناك من المهد هذا العهد",22],[4931,"يا حسين تصور حالتنا يا حسين وداوي علتنا",2],[4930,"يا حسين اليحبك ابد ما ينساك",9],[4929,"يا حسين احنه عاهدناك دنيا واخرة وياك",18,"(قراءة2)"],[4928,"يا حسين احنه عاهدناك دنيا واخرة وياك",22,"(قراءة1)"],[4927,"يا حبيبي يا حسين نور عيني يا حسين يا طايح ظامي جاوبني يا شبل الزهراء",11],[4926,"يبو الأكبر إلك دمع الجفن أهدي",5],[4925,"يا ابن أمي أنقطع قلبي وعيني ظلت ربية وين العلم وين الجود",12],[4924,"يا نزاري حسينكم بالطف ذبيح",11],[4923,"يا كعبة الأحرار اسمع صوت الانصار بالحومة",29],[4922,"وين يا من صبرك يطشر الجبال صبرك اصبح ينضرب بيه الأمثال",11],[4921,"هذا الغريب المظلوم صرخة هضم ناداها",11],[4920,"هالإمامة انفجعت بشبانها حزن يعقوب أشد لو أحزانها",10],[4919,"هاك يالواعي منهج الثورة دم أبو اليمة حبر كتب لأصحاب الفكر",27],[4918,"هاك أسمع نداء الروح ما بين العرش واللوح دمك يا علي مسفوح",8],[4917,"هاشم بيا حالة من جور الايام",14],[4916,"نوحي نمزج بالعبره لمصابك يا ابن الزهراء",18],[4915,"مو للثواب وأجره لمصابك تجري العبره",12],[4914,"موقف الأمة خطير وينهم أهل الضمير",5,"(قراءة2)"],[4913,"موقف الأمة خطير وينهم أهل الضمير",15,"(قراءة1)"],[4912,"من نشوف المحن والهم والهوان نعتب على الدهر ونلوم الزمان",27],[4911,"من صحت يا حسين حي على الفلاح",12],[4910,"مني المدامع هاملة لأبو اليمة بكاي",19],[4909,"مذبوح أخوي حسين بوي يا بوي",34],[4908,"ما ننسى حسين وأيامه",5],[4907,"لو نتوذر لو نتقطع منعوفك نقسم بالمرضع",17],[4906,"لِوَن ما تعوف حج البيت وتحافظ مقام الدار",12],[4905,"ليك تعنينا حامي الضعينة من اليسر جينا حامي الضعينة",23],[4904,"كربلاء لا زلتي كرباً وبلاء ما لقي عندك آل المصطفى",14],[4903,"كربلاء عليها نعاتب نقول هاي رجال وتدَور الغِلب",2],[4902,"كربلاء بيا يوم تقضي غربتنا ولضريح حسين يمتى رجعتنا",27],[4901,"قال الحسين قوله هيهات منا الذلة إن الحياة عقيدة وجهاد",19],[4900,"قال الحسين في يوم عاشوراء إن لم يكن دين لكم فكونو أحرار",22],[4899,"علتي الكامنة بحشاي لقيت اللي يداويها دواها بتربتك يا حسين",5],[4898,"عاشوراء شعارنا كربلاء منارنا وبالدماء نحن فداء يا حسين",23],[4897,"من أرض المدينة طلع نور الهدى حسين",6],[4896,"صوت جبرائيل بالأحزان ضج ومن صداه ارتجت الأكوان رج",9],[4895,"صحبتك يا ابن الزكية صحبتك من صحت يا حسين لبو صيحتك",10],[4894,"روحي خلصت ودعوني سهم اليسر بعيوني",18],[4893,"ردينا ردينا ومن اليسر جينا",18],[4892,"ردينا ردينا ولقبرك ردينا آه يا حسين نور العين ولقبرك ردينا",18],[4891,"ردينا لقبرك درينا يا والينا يا والينا ردينا لقبرك ردينا",5],[4890,"ردونا ردونا لارض الوطن ردونا",9],[4889,"دمعي يا عطشان فاض عليك دم شلون اذوق الماي ريت الماي سم",9],[4888,"خدمتك يا حسين هي أكبر ضمان للتريد تعيش برياض الحنان",3],[4887,"حسين هاي أوصافه وخسر كل من عافه",22],[4886,"بس الحرم ظلينا ولا واحد ينغر لينا من عفناك يا ابو اليمه",14],[4885,"بايعناك بايعناك يا ابو اليمه بايعناك",5],[4884,"بأبي أفدي قتيلا بالطفوف نهبت أحشاءه بيض السيوف",8],[4883,"آه يا حسين ومصابه يا حسين يلذكرك بطرف لساني",4],[4882,"آه يا حسين آه يا حسين نعزيك بمسلم يا حسين",7],[4881,"آه يا حسين آه يا حسين عنك غصب مشونا",8],[4880,"آه والهفا على سبط الأمين قد بقى في الطف معفور الجبين",14],[4879,"نهار العاشر بعاشور بالحومه وحيد حسين",12,"شوط كربلائي"],[4878,"انصارك يا حسين أنصارك انهض واستقبل زوارك",7],[4877,"انصارك هذا واقعنا وأفكارك عالحق تجمعنا",26],[4876,"وانت حي حاضر وياهم كنت بعيونك تشوف",3],[4875,"الله يا دم بالطفوف انسفك ما جرى إلا ووقف مجرى الفلك",10],[4874,"أرد أنشدك بعد يا ناعي المصاب ومنك أطلب تفصح برد الجواب",7],[4873,"أدوّر عالصبر يا حسين وين الصبر دليني",10,"(قراءة2)"],[4872,"أبداً والله لن ننسى حسينا",6],[4871,"يظل ذكرك وحق عمرك على لساني",16],[4870,"يا راس بريّض بهونك وصية وياك اخذ مني",11,"شوط كربلائي"],[4869,"يا فارس بدر وحنين يميدب طواغيها ليش ام الحسن تنخاك وما تسمع بواكيها",6],[4868,"يا علي بيك إعتقدنا وللحشر ثابت عهدنا",25],[4867,"يا علي بايعناك وأنت والينا عالفطرة حبيناك وانت والينا",33],[4866,"نصرخ حيدر دمع العين عليك تفجر",5],[4865,"عقبك يا داحي الباب مظلم صفا المحراب",13],[4864,"قول رسول الله جلي في حق الكرار علي",26],[4863,"ظلمّت الدنيا بمغيب أنوارها يوم طاح المرتضى كرارها",11],[4862,"تنخاك زينب يا حيدر وتريد من عندك تحضر وينك يا حامي الجار",21],[4861,"انت الأول انت الأخر مولاي علي أنت الظاهر انت الباطن مولاي علي",17],[4860,"الإمامة والخلافة تريد راعيها يا حيدر يا شخص غيرك يكفيها",13],[4859,"حيدر يا حليف الزود المحب وجهلك عتابه",23],[4858,"يا دهر ما أظن شافت والدة مثل ضيم أم البنين الفاقدة",6],[4857,"شلك وياي يا دهري خذت ريحانتي بعمري",21],[4856,"انا اللي دهري ذبني مصائب كثرة راواني",12],[4855,"يا فاطمة يا فاطمة قومي إلى الطفوف هذا حسين طعمة السيوف",15],[4854,"يا رب إشهد يا رب إشهد من عقب الهادي ظلموني",6],[4853,"واجب نعرف الأسباب واليسأل يريد جواب",7],[4852,"هاك أخذ هاي الأخبار عن فاطمة ومحنتها",18],[4851,"نارين شبوها القوم نارين تسعر لليوم ضلعين انهشمت للعترة",11],[4850,"مهجة الهادي الزهراء الزكية إلك عقب الصبر بالطفوف الأجر",24],[4849,"مظلومة مظلومة بنت النبي مظلومة",6],[4848,"ماذيها ماذيها يا هضم ماذيها بنت النبي المختار ماتت يا حامي الجار",25],[4847,"يحامي الجار بيك اشصار للزهره ما تحميها",12,"شوط كربلائي"],[4846,"لا تلوموها لا تلوموها كل ما تعتب لا تلومها بضعة محمد مظلومة",30],[4845,"غدروها غدروها والشيعة غدروها",12],[4844,"قال رسول الله فاطمة بضعةٌ مني من آذاها آذاني",19],[4843,"سائلاً بالمصاب من يرد الجواب يا ابن عم الرسول أين قبر البتول",24],[4842,"خطفو عمري وهشمو صدري ناديتك والمدمع يجري",25],[4841,"جوهرة القدس من الكنز الخفي",12],[4840,"بنت محمد والإله اختارها يا سبب هجمو عليها لدارها",10],[4839,"بالليل إدفني يا عقد الولاء وعيون حامي الحمية هاملة",5],[4838,"آه لبنت المصطفى الزاكية كم لوعة أمست بها باكية",10],[4837,"مسموم القائد خبرونا ولدارك جينا وفجعونا",7],[4836,"لوداعك تجري عبرتها ومحتاره يا مسموم",12],[4835,"الليلة جبرائل بالسماء يحوم ينعه روح الدين والحسن مسموم",24],[4834,"يا يمة قعدي وحاكيني من عقبك ياهو يداريني",14],[4833,"أدوّر عالصبر يا حسين وين الصبر دليني",9,"شوط كربلائي (قراءة1)"],[4832,"يا كفيل العائلة شوف شجرالي عقبك بطف كربلاء شوف شجرالي",9],[4831,"يا ابن أمي عالتربان عفتك رميّة",6,"(قراءة3)"],[4830,"يا ابن أمي عالتربان عفتك رميّة",17,"(قراءة2)"],[4829,"يا ابن أمي ردينا اليوم ما بين القبور نحوم يا حسين يا والينا",26],[4828,"يا ليلة التوديع بالغاضرية ما ظن مثلها يصير هاي المسية",6],[4827,"يا دفان يا دفان حان الدفن يا دفان",6],[4826,"ناديتك تدري بحالتنا وما غيرك يحضر شدتنا",25],[4825,"من هجمت عداي غدرتني دنياي",14],[4824,"من صغرها رُبت وياها الجروح ينوح حتى الصخر لو رادت تنوح",8],[4823,"ما ندري يا والينا بهالموقف تخلينا ضيعتنا يا عباس من عفتنا يا عباس",10],[4822,"لا تلوموني لا تلوموني لو فاضت دمعات عيوني",12],[4821,"كفلتوني ونسيتوني يا ولياني",17],[4820,"قلي يالميمون وين والينا راح ابو السجاد لو يرد لينا",17],[4819,"قصدت لخوها حسين صاحت يا نور العين",20],[4818,"زينب يلتنشدوني عليها زينب بالخرابة منزليها",16],[4817,"زينب من الخيمة طلعت بيديها الجود ونخت راعي العلم واليها",3,"هوسات"],[4816,"زينب لفت للعباس وتحشمه للحرم أسرع بالماي مسها الظمى",10],[4815,"زينب ردت من الشام تنشد عن أهاليها",6,"هوسات"],[4814,"زينب تنادي من الخيم يا عباس انت كفلتني وجيت مرفوعة راس",4],[4813,"دلوني دلوني يا ناس دلوني زينب وأريد المشرعة يا ناس دلوني",14],[4812,"درب المشرعة من وين ياه اللي يدلينا أرد أصول لأبو فاضل واخبره شصار",5],[4811,"آلام ما ننساها وروس الاهل جبناها بالأحزان صوتي اعتلى",17],[4810,"حتاريت انا وزماني ظليت انا وزماني يا بويه تدري شصار عقبك يا حامي الجار",25],[4809,"وصل مسلم والرسالة بيمنته وطلعت الكوفة بجمعها تلقته",7],[4808,"من وصلها ومن نزلها مسلم للكوفة تعناها والكوفة مدت يمناها",19],[4807,"مسلم بإيمانه وبشرف وجدانه وِفَى بعهده وبذل جهده سفير إبن الزكية",17],[4806,"للكوفة مسلم راح والغاية للإصلاح خلاها بين اثنين للدينا لو للدين",16],[4805,"للكوفة قصد مسلم على العهد بيمينه لزم الراية",23],[4804,"إجري العبرة إجري العبرة ابكي لمسلم وإجري العبرة",9],[4803,"يا سائلي عن كربلاء ها هي فانظر لها بعينك الباكية",5],[4802,"يا آل بيت رسول الله أنا سلم وولي لمن والاكم انا حربٌ وعدو لم عاداكم",20],[4801,"هلّ المحرم فاستهلت أدمعي وغدوتُ ذا قلب كئيب موجع",3],[4800,"هالأنصار الي نزلت لميدانها خل نشوف شعملت بعدوانها",6,"موشح (قراءة1)"],[4799,"ما ننساكم ما ننساكم نتأسف ما كنا وياكم",5],[4798,"روس هاشم عودت لجسومها ظلت مغسله بفيض دمومها",5],[4797,"بالعلم هل المنبر صار جامعة وتحيي الأفكار",23],[4796,"اخذ الأصل والجوهر وتمسك بهالمنبر",21],[4795,"يمة وبهزّ المهد ذكريني ولولي ليّه بغربتي وناغيني",8],[4794,"يا زهرتي وأمالي يا وسفة مهدك خالي فكري وياك يا عبد الله",18],[4793,"مهدك الخالي عذب دليلي والدليل انفطر اه من الدهر",8],[4792,"عذبتني شيبتني من فرقاك",11],[4791,"عبد الله بنبلة يفطمونه",4],[4790,"اه يا ابني من اشوف المهد خالي تغيب روحي وتسرح بعالم خيالي",25],[4789,"يا وجودي وفرحتي وآمالي أسمك مسجل وسط دلالي",2],[4788,"ليلة نادت ليش يا وليدي عفتني اه يبني",5],[4787,"فقدتك والمصايب هدمن حيلي يسبع الليل",2,"هوسات"],[4786,"علي يبني الدهر ذبني على مصابك",8],[4785,"اه يا ابني يالفرقاك شيبني حنّيت ونّيت",11],[4784,"انت صرخة داوية للشباب الواعية ضحي يالأكبر وجودك",17],[4783,"ويلي عالعليل المات بالسم عقب ذل السير والهضم والهم",12],[4782,"علي السجاد الذي يعرفونه الناس عن أصله واهله ينشدونه",5],[4781,"جمرة مصيبتي زيدت لوعتي وين أتجه بالعائلة يا كربلاء",25],[4780,"جاب عياله جاب عياله شوف السجاد بيا حالة",6],[4779,"وياهم ليالي المزهرة راحت ويّاهم (نعي) + دنت الساعة وانشق القمر",17],[4778,"وياكم أخذوني بوية يا بوية وكنكم تودعوني بوية يا بوية",11],[4777,"طفلة ويسيرة عدوان وميتمة",14],[4776,"طلع ظعن الهواشم طفلة عافو بالمدنية",8],[4775,"يمه شلون اعوفنك مطر يجسام بالترب",10,"هوسات + نعي"],[4774,"يبني الغالي يبني الغالي مبارك عرسك يبني الغالي",27],[4773,"هالليلة الحوفه والحنّة بعروسك جاسم تتهنى",6],[4772,"لا تنسى يا جسام عهد الوصية بالغاضرية",17],[4771,"طفوها طفوها يوليدي طفوها شمعتك يا جسام بدموعي طفوها",8],[4770,"طفوها ولشمعتك طفوها",15],[4769,"شمعت زفافك يبني طفوها بوسط القلب هالليلة علقوها",17],[4768,"سكنة تنادي والدمع يجري من العين",6,"هوسات"],[4767,"واويلاه عرّيس",3,"هوسات"],[4766,"حالة حزن ما بين رملة وجسام مرسومة بعيون الدهر والأيام",5],[4765,"جاسم يا شباب الدين يا ابني ويا ضوى عيني",14],[4764,"يا كعبة الزوار يا سابع الأنوار نهواك وما ننساك",14],[4763,"لارض الكاظمية يا غريب القوم جينا لشوفتك",6],[4762,"مظلوم والغربة صعبة مسموم والغربة صعبة",16],[4761,"يا واليها يا واليها قوم لزينب يا واليها",9],[4760,"يا عباس من يبرة الظعن لو شال",5,"هوسات"],[4759,"يا عباس يا عباس ليك نقدم شكوتنا",7],[4758,"يا قمر التمّ إلى ما السرار ذاب محبوك من الإنتظار",16],[4757,"يا أبا الفضل جيب الماي لأطفالك العطشانة",7],[4756,"وين الوعد يا عباس عفت الحرم عطشانة",16],[4755,"واللي صاب الجود صوّب عيني",9],[4754,"ننخاك يا قمر هاشم بحماك يا قمر هاشم",12],[4753,"قبرك ضمك عن عيوني",5],[4752,"عيوني العلقمي والدمع جارية",5],[4751,"عباس يا بحر الزود عباس هاك اخذ الجود",14],[4750,"سهم النايبة بعيني وينه اللي يدليني درب المشرعة منين",23],[4749,"راعي العلم جيناك رد الظعن بحماك",9],[4748,"تدري شصار يالمهدي هاك أخبار يالمهدي حان الثار يالمهدي",41],[4747,"يالمهدي شصارت هالغيبة",4],[4746,"يالغايب وعدك ننتظره قلبك يا يوم يطق صبره",15],[4745,"نخوة هضم وعتاب يا صاحب الثار",17],[4744,"يمهدينا ننخاك بدموع الحزن طال الوعد ناداك صوت الحزن",7],[4743,"قد كنت في الدهر حمى",6,"هوسات"],[4742,"بيّن شهر المصايب قوم الليلة يالغايب وإبكي على الغريب حسين",8],[4741,"وعدك علينا طال وينك يا غايب ما عدنا مهجة وروح تحمل مصايب",7],[4740,"يالمختار يالمختار شوف شحصل يالمختار",13],[4739,"يالمختار بحالي اشصار بحالي اشصار يالمختار",15],[4738,"هذا تاريخ وندرسه يا محمد والزمان يعيد نفسه يا محمد",19],[4737,"هاي البداية شوف النهاية نار الفتن شبوها ولبضعتك غدروها",24],[4736,"لمصيبتك يالمختار نبكي ونونّ ليل نهار",14],[4735,"عذبونا يا محمد والضلع والباب يشهد",33],[4734,"الليلة بجنة الفردوس أصبح ضيف حامي الجار اجت تستقبله الزهراء",3,"استديو - نعي"],[4733,"حسين جانم در إين عالم غير عشق وغمت إي برادر جون من نميدونم",8,"استديو فارسي"],[4732,"امشب شب قتل حسين سلطان خوبان است",11,"استديو فارسي"],[4731,"يتيمه در دلي در منيتي (نعي) + كوشيه خرابيمون خوش أومدي",12,"استديو فارسي"],[4730,"جينا ننشد كربلاء مضيعينها فيها زينب قالو ميسرينها",3,"استديو"],[4729,"تركت الخلق طراً في هواك وأيتمت العيال لكي أراك",10,"استديو"],[4728,"لا تلومونا على حب الحسين فهو مستقبلنا في النشأتين",8,"استديو"],[4727,"سجل عنوان هالرايه وبيمين العباس تعترف بها الناس",12,"استديو"],[4726,"لفت زينب حشمت واليها قمر عدنان (نعي) + سدو الماي يا ضوا عيوني",12,"استديو"],[4725,"زينب والحسين وقمر هاشم مصيوبين بصواب الفواطم",1,"استديو"],[4724,"احنا غير حسين ما عدنا وسيلة والذنوب هواي كفتها ثقيلة",15,"استديو"],[4723,"يا ابن أمي عالتربان عفتك رميّة",9,"استديو"],[4722,"علي علي أي بسرم",8,"استديو «قافلة آل محمد» فارسي"],[4721,"هزار بار كرفتد بخاك باي تو دستم(نعي) + أي تقيه كاه من",13,"استديو «قافلة آل محمد» فارسي"],[4720,"تمام لاله ها رفتند و تنها مندأم من",11,"استديو «قافلة آل محمد» فارسي"],[4719,"بروي ناقه بكنج محمل",10,"استديو «قافلة آل محمد» فارسي"],[4718,"ماه باري كجاست شيرو خاره كجاست",11,"استديو «قافلة آل محمد» فارسي"],[4717,"مران يك دم",10,"استديو «قافلة آل محمد» فارسي"],[4716,"حين راس حسين",23],[4715,"يالمنذبح عطشان يبني آيبني يلعاري عالتربان يبني آيبني",28],[4714,"إلهي ان كان ما ردن لابو اليمة إخذ روحي",15,"(قراءة2)"],[4713,"إشهد إشهد يا محمد للزهرا الظالم أذاها",18],[4712,"من سقط منك علمنا ومن طحت عالمشرعة",25],[4711,"قوم عباس الخيم حرقوها",13],[4710,"يل تنشد على النجف قلعه ومدينة علم",6,"نعي"],[4709,"هذا اليوم قلب الدين بالهم ذاب",3,"هوسات"],[4708,"موقف مصابك يا علي بالعرش مرسوم",6],[4707,"من لنا غيرك يا علي تدري ما لينا وكاسات البعد بالهم ملينا",2,"نعي"],[4706,"يالوياك ماخذ روحي خوي شلون اقطع نوحي",24],[4705,"سيدي معاك جئنا لأرض كربلاء كلنا فداك جئنا لأرض كربلاء",38],[4704,"حنّة وشموع زفّة زفّة حسرة ودموع وسفة وسفة",26],[4703,"ام البنين تصيح يالتسمعوني لا تلوموني لو عندي عشر أولاد فدوة لأبو السجاد",28],[4702,"اليوم تملكني وتملكني غدا انا لن اكن إن لم تكن لي سيدا يا حسين",19],[4701,"اقصد الكوفة مسلم تشوفه اشرف سفار حضرته",32],[4700,"اتمنى موتي بهاي المسيه ودعت اخوتي وأصفج بإيدي",26],[4699,"بدرٌ هوى فاهتز ركن الله",10,"استديو «طفل مذبوح»"],[4698,"اه يا ابني يالفرقاك شيبني حنّيت ونّيت",11,"استديو «طفل مذبوح»"],[4697,"نار ضماي بين حشاي",16,"استديو «طفل مذبوح»"],[4696,"زينب الليلة غريبة منين إجتني هالمصيبة",5,"استديو «طفل مذبوح»"],[4695,"بالطف ليلة التوديع حضرت فاطمة الزهراء",12,"استديو «طفل مذبوح»"],[4694,"هاك أسمع إشصار بالغاضرية على الأكبر يسيل دمع الزكية",12,"استديو «طفل مذبوح»"],[4693,"على ونيني غفت عيني بدمع مسفوح وتراوالي مهد خالي وطفل مذبوح",11,"استديو «طفل مذبوح»"],[4692,"يا هلي يالتشيعونه ولينا لا تدفنونه",7,"استديو «جوهرة القدس»"],[4691,"أندب يا شيعة انا الوديعة ريحانة الهادي انا الزهرة الزكية",10,"استديو «جوهرة القدس»"],[4690,"هامة السماء كيف التراب يرتقي معقل الرجاء كيف التراب يرتقي",8,"استديو «جوهرة القدس»"],[4689,"يا من تحامي دخيلك قوم لينا يا علي",6,"استديو «جوهرة القدس»"],[4688,"إني رضعت مع الحليب هواك هيهات تجنح مهجتي لسواك",8,"استديو «جوهرة القدس»"],[4687,"نعي + تدريني الموادع صعب يا يمة وين السفر وين يمة",13,"استديو «جوهرة القدس»"],[4686,"عمه جون بيا بيا بيشم بشين",7,"استديو «كيف لا أبكي» فارسي"],[4685,"اليوم تملكني وتملكني غدا انا لن اكن إن لم تكن لي سيدا يا حسين",11,"استديو «كيف لا أبكي»"],[4684,"يا اهل يثرب لا مقام لكم بها + بجاه النبي وفاطمة وعلي اتمنى ترجع يا حسين",12,"استديو «كيف لا أبكي»"],[4683,"كيف لا تبكي عليك كل عين يا إبنة الزهراء يا أخت الحسين",9,"استديو «كيف لا أبكي»"],[4682,"اخذ عن عباس نظرة (موال) + حي ابو فاضل ركب ميمونه شبل حيدر",8,"استديو «كيف لا أبكي»"],[4681,"أميري حسين ونعم الأمير سرور فؤاد البشير النذير",11,"استديو «كيف لا أبكي»"],[4680,"خده على خد وليده لازم دليله بإيده صاح حسين ماي العين",11,"استديو «كيف لا أبكي»"],[4679,"يا عظيم الجاه يا رسول الله عذراً عن الأطفال والنساء",12,"استديو «كيف لا أبكي»"],[4678,"قبرك صار للزوار يا أبا الحسن كعبتها",9,"استديو «أنيس الزوار»"],[4677,"وياكم وياكم أدعولي وياكم يا من تزورون الرضا",13,"استديو «أنيس الزوار»"],[4676,"يا غريب الغرباء يا معين الضعفاء",11,"استديو «أنيس الزوار»"],[4675,"يا ابو محمد إلك زوار إجينا ضيوف لدارك بلهفه إعتنينا",12,"استديو «أنيس الزوار»"],[4674,"أصيح بصوت وبقلبي تشب النار",4,"نعي"],[4635,"جوهرة القدس من الكنز الخفي",13,"استديو «جوهرة القدس» مع باسم الكربلائي"],[4634,"خلق الله علياً من نوره + دخلو محراب الرحمن وأصابو رأس القرأن",12,"استديو «جوهرة القدس» مع باسم الكربلائي"],[3909,"ذبحوك ظامي قبل الفطام فخذ سلامي قلبي فجيع",31],[3908,"يتيمة واصبحت اتكفل يتامى من طاح الولي",16,"استديو"],[1260,"هذا نص للمختار بوصيته للكرار",9,"استديو"],[1259,"للنجاة للنجاة يالله نقصد السفينة",10],[1258,"بين وادي كربلاء وثرى أم القرى",20],[1257,"لا تلومونا بل أنصفونا نحن عشاق",17],[1256,"بوي باشر لو رحت عن سما عيوني",15],[1255,"يا دار حسين حاكيني",12],[1254,"تشهد الناس إبني عباس",17],[1253,"بيا حالة طلعت هالمسية تودعه",8],[1252,"ناس اللي غدروا عمك حيدر ما أظن",29],[1251,"حسين شمعة وما يطفيها الزمان",7],[1250,"يا حسين يا ثار الله نقسم والله",33],[1249,"يا بو فاضل تعنيتك + رداديات",13],[1248,"عباس ما تقعد تحاكيني",11],[1247,"دمي عالنهر مسفوح والناظر إلك",28],[1246,"بطل بالغاضرية مثال العبقرية",23],[1245,"آه يا ابني عباس أحّا",8],[1244,"ودع القلب جسام يا فرحة سنينه",9],[1243,"جسام أنا أمك يا ابني",13],[1242,"شد يا جاسم عالحرب + رداديات",14],[1241,"أنا العقيلة يمّه أنا العقيلة",29],[1240,"بالطف ليلة التوديع حضرت فاطمة",12],[1239,"يا حبيبي يا حسين نور عيني",10],[1238,"كيف تعذر يا ابن حيدر",16],[1237,"هاي الليلة نواسي المهدي",6],[1236,"طلع ظعن السبط من المدينة",12],[1235,"لك حبي واشتياقي كربلا يا كربلا",30],[1234,"طلعت هوادجنا بكرامة وعفة",5],[1233,"لو ما ينذبح والينا ما حرقوا",7],[1232,"من عيني المدمع سال لمن شفتك",15],[1231,"ما لنا في هذه الدنيا سواك",21],[1230,"بالحزن توصي العليلة",19],[1229,"بالفاجعة العالم نعى ماتت رقية",21],[1228,"نور الكواكب عن عيني غايب",16],[1227,"يعلوا أنيني في كل حين",27],[1226,"يالقاصد لقبر حسين أريد أنخاك",16],[1225,"يا مسلم يومك سجل انت المظلوم",22],[1224,"شفت الشمس يم النهر محنية تبكي",17],[1223,"كيف أذل لهذا العسكر الله أكبر",27],[1222,"هالليلة مو ليلة شمع ليلة حزن",18],[1221,"عوف الزفاف وروح يا وليدي",23],[1220,"حزنك يا مظلوم تجدد",6],[1219,"عقبك حزينة الروح آه يا ابني يا مذبوح",19],[1218,"كنت لي سدا منيعا يا عليا يا علي",31],[1217,"الأمة يا نور النبوة وآلها",10],[1216,"يالمهدي وعدك وين صار الضلع ضلعين",21],[1215,"لا أخشى يوم حسابي وولاء السبط كتابي",25],[1214,"هذا نص للمختار بوصيته للكرار",30],[1213,"للطف رجعنا وجبتي الأهل بس طفلة ظلت",16],[1212,"تحيرني وتذكرني يا جابر لا تناشدني",21],[1211,"زينب تشرح هضمها تنحب وتنادي أمها",42],[1210,"حرم عندي وحق جدي سواد الليل امهلوني",9],[1209,"ما ننسى رقية وهضم لوعتها",8],[1208,"إلهي ان كان ما أزورن لبو اليمة إخذ روحي",26,"(قراءة1)"],[1207,"بالفاجعة العالم نعى ماتت رقية بالغرب",13,"استديو «رقيه في خراب الشام»"],[1206,"وين أبوي حسين وينه حرقوا خيمنا علينا",4,"استديو «رقيه في خراب الشام»"],[1205,"عيوني وعيونك يا ابن حامي الحمى",9,"استديو «وازينباه»"],[1204,"بأبي أنت وأمي يا حسين",12],[1203,"يا طير خبر النبي عما جرى",9],[1202,"يا حبيبي يا حسين نور عيني يا حسين",18,"(قراءة1)"],[1201,"ثلاثاً نحن نهواها وفي الأعماق عشناها",24],[1200,"لبيك داعي الحق لبيك قولاً في صدق",30],[1199,"احنا أنصار العقيدة وللمجد نضمن رصيده",30],[1198,"يا حبيبي يا حسين نور عيني يا حسين",15,"(قراءة2)"],[1197,"غير حسين ما عدنا وسيلة",18],[1196,"ضمني في هذا الضريح علّي يا جدي استريح",30],[1195,"لوين يوصل بدي رحت للغاضرية",15],[1194,"راحوا هلي وضليت اصفج بدي",25],[1193,"يا ابني يا ابني غبت عني يا حسين",19],[1192,"متبرعة متبرعة بدم البنين الأربعة",31],[1191,"يا مسلم جرد البتار يومك صار يومك صار",12],[1190,"كل مسلم بهاليوم مثلك صبح مظلوم",23],[1189,"راد بدموع العين يغسل دما الكفين",10],[1188,"قسماً بالشفع وبالوتر والفجر وليال عشر",34],[1187,"عالمشرعة العباس صاب السهم عينه",19],[1186,"بالحسرة علقوا شمعتك بالدمعة عجنوا حنتك",15],[1185,"لو شمع لو دمع يا ابني جاسم",30],[1184,"يا حبيبي يا حسين نور عيني يا حسين (أحرم الحجاج)",21,"(قراءة3)"],[1183,"يا حسين ابنك حزوا نحره لو جدك طايح عالغبرة",39],[1182,"والله لست بطرا وما خرجت أشرا",20],[1181,"مهمومة فاقدة طفلاً رضيعا",33],[1180,"يا حبيبي يا حسين نور عيني يا حسين",19,"استديو"],[1179,"واحسيناه واحسيناه واحسيناً واحسيناه",10,"استديو"],[1178,"راسك يا مظلوم هالليلة يمك",27],[1177,"تركت الخلق طراً في هواك",13],[1176,"أنت رمز التضحيات يا حسين/حب الحسين زادي",27],[1175,"يا حسينا أنت شرعت الفداء حينما عبدت درباً بالدماء",30],[1174,"ودعتك يا حسين بويه وظلت تجري العين بويه",22],[1173,"يا حامي الجار بيك إشصار للزهرا ما تحميها",7],[1172,"مظلومة أم البنين",8],[1171,"خيّرتك نفسي فإختاري ما بين الجنة والنار",28],[1170,"هاج وجدي وإشتياقي يا حسين",26],[1169,"أميري حسين ونعم الأمير سرور فؤاد البشير النذير",28],[1168,"يا عباس ترجينه بالماي تعود لينه",28],[1167,"هو ابن عم الحسين تبكي له كل عين",19],[1166,"بالك تصدق حكيها يشهد العالم عليها",34],[1165,"زلزل الأكبر ميدان الطفوف في تلك الألوف",24],[1164,"يالمعتني للحرب وشلون أصبر القلب",31],[1163,"في الوجود كل أرض كربلاء",24],[1162,"يا ابن أمي عالتربان عفتك رميّة",19,"(قراءة 1 - 3 لطمات)"],[1161,"هكذا قتل الحسين في قلوب المؤمنين أوقد نارا",12],[1160,"في وجه الأشرار صرخة الأنصار يا حسين",23],[1159,"يا ابا الفضل انت الأصل راية محمد رايتك",25],[1158,"وين النهر يا ناس دلّونه عالعباس",17],[1157,"طلع شباب من الخيم قومي يا زينب هلهلي",16],[1156,"تعرف صفاته من تضحياته جاسم بدال العرس",8],[1155,"يالأكبر زماني بيك صوبني وغربني عقب عيناك",8],[1154,"سهم الهضم راميني ولدي انفقد من عيني",15],[1153,"بجمر الحزن شاط القلب للكاظمية",8],[1152,"يا جوهر كنز الأسرار يا مشعل درب الثوار",30],[1151,"من سقط منك علمنا ومن طحت عالمشرعة",15,"استديو"],[1150,"جداه يا سيد الملا اليوم عدنا من كربلا",12,"استديو «وازينباه»"],[1149,"زينب بكل همها تودع قبر أمها",25],[1148,"ورحت لأم البنين أنشدها عن أهلي",15],[1147,"قلبي مألوم ظهري انكسر يا ابا الفضل",12],[1146,"يا عظيم الجاه يا رسول الله عذراً عن الأطفال والنساء",7],[1145,"من مصدر أحكام الوعيد نشرح مضامين",19],[1144,"قالوها أصحاب المثل يا زارع الطيب لا تصدق تخيب",24],[1143,"من يحرس خيمنا لو رحتوا من يمنا",11,"استديو"],[1142,"وصيتك وصيتك بالمظلوم وصيتك",14],[1141,"اشجايب هدية اليوم .. جدك محمد",23],[1140,"يا ابني علي بنار العطش رديت إلي",15],[1139,"يا سماوات ويا أرض إشهدي لم تزل نار الأسى",25],[1138,"يا حسيناً يا حسيناً يا حسين",18],[1137,"حسين دمه بآفاق السماء حسين أبكى عيون الأنبياء",29],[1136,"يا دنيا مهلاً ودعيني أجري عبراتي لبنيني",11],[1135,"بجاه النبي وفاطمة وعلي اتمنى ترجع يا حسين إلي",26],[1134,"يا عبد الله ترى والي أشوفن هالمهد خالي",12],[1133,"بجمرة ألمنا نودع حرمنا عندك أمانة العائلة يا كربلا",36],[1132,"دماء كيف ننساها أسيلت من بني طه",4,"استديو"],[1131,"أنصارك أنصارك إسمع صرخة أنصارك",17],[1130,"إسمع يا ظالم أنت وعبيدك لا ما نسالم",23],[1129,"إجانا ضيوف يا ريت تشوف",15,"استديو"],[1128,"أنا يا ناس العقيلة بت علي حامي الحمية",32],[1127,"الدهر آه الدهر باليسر مشّاني",26],[1126,"قم ناشد الإسلام عن مصابه",12,"استديو"],[1125,"موقف مصابك يا علي بالعرش مرسوم",15,"استديو"],[1124,"قلبي عاشق كربلا شلون أفارق كربلا",14],[1123,"أبا حسن فداك العالم الأكبر",5],[1122,"العالم ينفني بأسره إذا ما كانت الزهراء",14],[1121,"لو قاسينا كل بلاء غايتنا حب الزهراء",30],[1120,"حيدر متميّز تعينه متعيّن بالنص والينا",15],[1119,"قد أقسم ربك بالعصر إنّ الإنسان لفي خسر",27],[1118,"قال علي في المحراب سمعوه كل الأصحاب",14,"استديو"],[1117,"يأيها المخضوب بالدماء",11,"استديو"],[1116,"يا حبيبي يا حسين نور عيني يا حسين",19,"مع باسم الكربلائي"],[1115,"على من ينحب المظلوم ودمع عيونه يتجارى",13,"مع باسم الكربلائي"],[1114,"إحنا غير حسين ما عدنا وسيلة",34,"مع باسم الكربلائي"],[1113,"إجن واتجمعن كل الحرم يمك",30,"مع باسم الكربلائي"],[1112,"إلك نزحف يا ابو السجاد لو نبكي على أصحابك",7,"مع باسم الكربلائي"],[1111,"أيها الناس اسمعوني وانسبوني جدي محمد",44,"مع باسم الكربلائي"],[1110,"يالغايب نسيت الثار لو يومك بعد أمره",16,"مع باسم الكربلائي"],[1109,"يا حسين نبايع بالدم وبالأرواح",6,"مع باسم الكربلائي"],[1108,"قبرك جمعنا وللطف رجعنا",17,"استديو ، مع باسم الكربلائي"],[1107,"عالمشرعة العباس صاب السهم عينه",12,"استديو ، مع باسم الكربلائي"],[1106,"جيتك يا عباس وجبت هالحرم وياي",9,"استديو ، مع باسم الكربلائي"],[1105,"ريض يا حادي بالضعن وخليني اعاتب",8,"استديو ، مع باسم الكربلائي"],[1104,"عباس يا درة علي المكنونة",5,"استديو ، مع باسم الكربلائي"],[1103,"ما أنا اختك يا عباس ناديتك يا عباس",7,"استديو ، مع باسم الكربلائي"],[1102,"اللي يعرف مصابي - الإمام السجّاد ع",15,"استديو ، مع باسم الكربلائي"],[1101,"يا زماني هذا حالي - الإمام الباقر ع",13,"استديو ، مع باسم الكربلائي"],[1100,"بمصاب الصادق - الإمام الصادق ع",11,"استديو ، مع باسم الكربلائي"],[1099,"اسكبوا دمع العيون - الإمام الكاظم ع",15,"استديو ، مع باسم الكربلائي"],[1098,"لكل قلبٍ سيدي - الإمام الرضا ع",12,"استديو ، مع باسم الكربلائي"],[1097,"يا مناراً للعباد - الإمام الجواد ع",15,"استديو ، مع باسم الكربلائي"],[1096,"يا هادي الأنام - الإمام الهادي ع",14,"استديو ، مع باسم الكربلائي"],[1095,"أمامنا الحادي عشر-الإمام العسكري ع",9,"استديو ، مع باسم الكربلائي"],[1094,"يا ابن أمي انقطع قلبي",10,"استديو ، مع باسم الكربلائي"],[1093,"يمه ذكريني من تمر زفة شباب",6,"استديو ، مع باسم الكربلائي"],[1092,"يا بحراً يتفجّر أنت علي الأكبر",14,"استديو ، مع باسم الكربلائي"],[1091,"قالوا لي عبد الله انفقد ظليت اعاين",14,"استديو ، مع باسم الكربلائي"],[1090,"أنا زينب يالتودعوني",16,"استديو ، مع باسم الكربلائي"],[1089,"مظلومة مظلومة والزهراء مظلومة",17,"مع باسم الكربلائي"],[1088,"دفعوا باب الدار بوي وبصدري البسمار",22,"مع باسم الكربلائي"]]},{"id":"nizar","n":"نزار القطري","items":[[5781,"الله أكبر بضلوعي ناري يا ساعة أظهر طال إنتظاري",9],[4631,"يا أم البنين الحرة حلي مشكلتنا دخيلك فاطمة الحرة",8,"استديو «سفرة أم البنين»"],[4630,"هاي الدموع تنادي يا باب الحوائج يا أم البنين",8,"استديو «سفرة أم البنين»"],[4629,"هنا يا أم البنين هنا أعزيك وتعزيني",10,"استديو «سفرة أم البنين»"],[4628,"حسينم يا حسين تارمون اومد وزهراء اعزا دار حسين",4,"استديو «سفرة أم البنين» فارسي"],[4627,"شد بي بسر أم البنين خونين جكر أم البنين",4,"استديو «سفرة أم البنين» فارسي"],[4626,"تبقى على الغبرة يا مدلل الزهرة",6,"استديو «سفرة أم البنين»"],[4625,"ام البنين الأربعة يسموني وخامسهم المظلوم نور عيوني",7,"استديو «سفرة أم البنين»"],[4624,"خذ روحي يا روح الأمين فداك نفسي والبنين يا حسين",9,"استديو «سفرة أم البنين»"],[4623,"يالحادي الخذت مني شبابي ريض بالظعن واسمع عتابي",7,"استديو «سفرة أم البنين»"],[4622,"يشيال رايتنا يعنوان عزتنا",3,"استديو «يالغالي»"],[4621,"ايها الناس شمارو بحق خون حسين",6,"استديو «يالغالي» فارسي"],[4620,"يالغالي جاوبني كافي تعذبني حاكيني اترجاك",13,"استديو «يالغالي»"],[4619,"يا حسين معاهدينك ما نموت إلا على دينك",9,"استديو «عهدا يا سيدي»"],[4618,"بالروح بالروح نحي لك عزانا بالروح محفوظة الأمانة يا حسين",8,"استديو «عهدا يا سيدي»"],[4617,"يا حلم عالجفون يل عايش بناظري",8,"استديو «عهدا يا سيدي»"],[4616,"إنا فتحنا لك فتحاً مبينا يا رب عجل لنا النصر المبين",7,"استديو «عهدا يا سيدي»"],[4615,"يا اصل حي على خير العمل يا مهدي يا مهدينا",8,"استديو «عهدا يا سيدي»"],[4614,"يمجهز أخوي حسين خبرني عن أحواله ياهو الفصل اكفانه",8,"استديو «عهدا يا سيدي»"],[4613,"قال رسول الله نور عيني حسين مني انا من حسيني",7,"استديو «عهدا يا سيدي»"],[4612,"والشام انقضى كل العمر بالحزن والشام (نعي) + جرحين ما ظن تلتام",10,"استديو"],[4611,"ولي جود انا زينب يا قلبي انحب (نعي) + دلوني زينب واريد المشرعة",8,"استديو"],[4610,"ال مو دور از وطن يا ليت قومي يعلمون انا مظلوم حسين",7,"(قراءة2)"],[4609,"بضعة داحي الباب شافت كم مصاب",11,"استديو"],[4608,"واحسيناً واحسيناً واحسين + نعي",10,"عربي وفارسي"],[4607,"يا علي ابن الحسين يا علي انت نور الفرقدين",11,"عربي وفارسي"],[4606,"ندب الكون حزين يا إمامي يا حسين",9,"استديو"],[4605,"مع الأسى في لوعتي انحبُ والكون يبكيك دماً زينبُ",8,"استديو"],[4604,"جابر للعزاء جاء في كربلاء قال في الأربعين يا حبيبي حسين",9,"استديو"],[4603,"قبرك وين يا خوية حسين نظر عيني",7,"استديو"],[4602,"السلام على ذي الشيبة الخضيبة يا أبا عبد الله",8,"استديو"],[4601,"تحيرني تذكرني يا جابر لا تناشدني",6,"استديو"],[4600,"أي شيعة مكر قتل شاه كربُ بلا شد",8,"استديو / فارسي"],[4599,"يا عيني بالدمع جودي حبيبي اللي راح",12],[4598,"ال مو دور از وطن يا ليت قومي يعلمون انا مظلوم حسين",7],[4597,"شبل أمير المؤمنين صاح جيت أنصر الدين كربلاء يا كربلاء",6],[4596,"يا مهدي يا مهدي خذ إذن من الرحمن",6],[4595,"بكتك املاك السماء يا حسين حزناً عليك بالدماء يا حسين",8],[4594,"خوي اموادعك يا حسين يصعب عليّ",13],[4593,"مهلا مهلا يا ابن الزهراء يا ابن الزهراء مهلا مهلا",16],[4592,"انت الأكبر الغالي انت ثمر دلالي",8],[4591,"يا أيها الأكبر تسقى من الكوثر الله اكبر",14],[4590,"يا شبيه المصطفى كنت رمزاً للوفاء",18],[4589,"يا حي شباب الغانمة ويلي وا ويلاه",13],[4588,"قاسم قد زف بين الشهداء في طفوف كربلاء",17],[4587,"عجنوا يا جاسم حنتك بالدم الأحمر الله اكبر",4],[4586,"عرسك يا جاسم مرمر أحولي يا ثمر دلالي",8],[4585,"يا وليدي جاسم نايم على حر الثرى بين الهواشم",19],[4584,"وين الوعد يا كافلي والدمعة تصرخ يا علي يا أبو فاضل",20],[4583,"يا أبا الفضل إنت الشهم وطبعك النشمي وينك يا شيال العلم",24],[4582,"قوم عباس الخيم حرقوها والفواطم لليسر ودوها",10],[4581,"يا ابن خير الأوصياء نحن لبينا النداء الله اكبر على كل من تجبر",22],[4580,"بالروح بالروح نحيي لك عزانا بالروح محفوظة الأمانة يا حسين",21],[4579,"ما بين عدوانه مسلم وحيد وقلت اعوانه",13],[4578,"يا أصل حي على خير العمل يا مهدي يا مهدينا",9],[4577,"أنا أم البنين الفاقدة أربع شباب فدوى لتراب الحسين",20],[4576,"قال رسول الله نور عيني حسين مني انا من حسيني",15],[4575,"مو هو لاجل الثواب بكيت وجرى (نعي) + فدوى لك رقبتي يا حسين",20],[4574,"نجري من الجفن عبرة جينا نواسي الزهرا دموع ونوح على المذبوح",12],[4573,"كربلاء يا كربلاء كربلاء رمز الفداء",12],[4572,"تبقى على الغبرة يا مدلل الزهرة + الله حسين وينه",16],[4571,"ليتني يا سيدي ليتني كنت المصاب",12],[4570,"جبريل نادى في السماء طاح سبط المصطفى",7],[4569,"سلامٌ يا حسين سلام الأنبياء سلامٌ يا قتيلاً بالعراء",16],[4568,"الشمس تبكي وبكى ضحاها إذا السماء أنفطرت",11],[4567,"امشي وياكم ما بيه اتحمل فرقاكم لا تودعوني لا تخلوني",13],[4566,"السلام على ذي الشيبة الخضيبة يا أبا عبد الله",18],[4565,"نام وتهنى يا طير الجنة وتروى من ماي النظر",8,"استديو «أبا الأحرار»"],[4564,"يالغالي يا علي الأكبر خابت حيف أمالي",9,"استديو «أبا الأحرار»"],[4563,"قد علا مني نحيب أبكي بالطف غريب",6,"استديو «أبا الأحرار»"],[4562,"خيمنا موجّره وعنك مشينا خوي وفرقتك تصعب علينا",7,"استديو «أبا الأحرار»"],[4561,"ناله كون أي دلب أعزاي علي كريه كون أي ديد براي علي",3,"استديو «ويبقى علي» فارسي"],[4560,"ايها الباكون لا اهل العزا والحاضرون انا مظلوم حسين",7,"استديو «رمال الطفوف» عربي وفارسي"],[4559,"شفت النجم يتنثر والكون وضعه تغير",8,"استديو «رمال الطفوف»"],[4558,"يا كوكباً في حسنه زفوه نحو عدنه",8,"استديو «رمال الطفوف»"],[4557,"انت الحديت بناقتي وللطف جبتني يلفارقتني عِد مَن عفتني",9,"استديو «رمال الطفوف»"],[4556,"يا رمال الطفوف قصي علينا من جهاد الحسين درساً إلينا",5,"استديو «رمال الطفوف»"],[4555,"عاهدنة يا ابو اليمة نظل شيعة موالين",13],[4554,"ها انا قد جئت اسعى املأ الوديان دمعا صرختي في الأربعين",17],[4553,"حسين يا مظلوم ما تدري بينا الليلة جينا حسين يا مظلوم",14],[4552,"كنت احسب أحضر زفتك (نعي) + عرسك يا جاسم مرمر أحوالي",7,"استديو «جرح قلبي»"],[4551,"Bare in maind",4,"استديو «جرح قلبي» انكليزي"],[4550,"محمل مبن بر أشتبان",10,"استديو «جرح قلبي» فارسي"],[4549,"مولاي صاحب الزمان أين الأمان أين الأمان",5,"استديو «إنت الشهم»"],[4548,"نجري من الجفن عبرة جينا نواسي الزهرا دموع ونوح على المذبوح",8,"استديو «إنت الشهم»"],[4547,"يا ابن خير الأوصياء نحن لبينا النداء الله اكبر على كل من تجبر",8,"استديو «إنت الشهم»"],[4546,"نفشدته بر تنه كلها بربر شهيدان زندن",9,"استديو «إنت الشهم» فارسي"],[4545,"عنك يا مظلوم خذوني ميسرة",4,"استديو «إنت الشهم»"],[4544,"كربلاء يا كربلاء كربلاء رمز الفداء",8,"استديو «إنت الشهم»"],[4543,"ها يالنازلين هناك قبر حسين دلوني",8,"استديو «إنت الشهم»"],[4542,"زياراتي زياراتي من بعيد",6,"استديو «إنت الشهم»"],[4541,"يا أبا الفضل إنت الشهم طبعك النشمي",10,"استديو «إنت الشهم»"],[3907,"أنا أم البنين الفاقدة أربع شباب",8,"استديو «يالغالي»"],[3906,"شيعي أنا و الحزن شعاري والتضحية والفدا قراري",9,"استديو «يالغالي»"],[3905,"حيدر حيدر حيدر حيدر يا حيدر",11,"استديو"],[3904,"حسين يا ابن الزكية",8,"استديو «يالغالي»"],[3903,"يا رب أبكي على من قتلوه وهو ضامي",10,"استديو «يالغالي» عربي وفارسي"],[3902,"غصباً عليّ وأدري ما ينفعك عذري",13,"استديو"],[3901,"أنا العباس أنا العباس قطيع الكف دامي الراس",8,"استديو"],[3900,"يا أبا الفضل الأمين كنت لي نعم المعين",4,"استديو"],[3899,"هالله هالله حسين وينه بالسيوف مقطعينه",5,"استديو"],[3898,"يا جرح قلبي الكبير فكري لمصابك يحير",9,"استديو «جرح قلبي»"],[3897,"الله أكبر جبتني كربلا خوي يا حسين تشوف العايلة",10,"استديو «جرح قلبي»"],[3896,"زينب لخوها هلهلت من شافته بحد الخيم",6,"استديو «جرح قلبي»"],[3895,"إجيت أتعثر بهمي ويم جسمك لقيت أمي",9,"استديو «جرح قلبي»"],[3894,"مشايه ولطف كربلا جينا نزور مولانا",5,"استديو «جرح قلبي»"],[1515,"السلام على الحسين وعلي ابن الحسين",11,"استديو"],[1514,"هتاف الوحي دوّى مطلع الفجر ترى ماذا جرى",8,"استديو «ويبقى علي»"],[1513,"بدموعي يا موالين صاح جبريل الأمين",6,"استديو «ويبقى علي»"],[1512,"إرتفع صوت الهضيمة يا علي زينب يتيمه",9,"استديو «ويبقى علي»"],[1511,"زينب تنادي شلون ليلة تمر علينا",7,"استديو «ويبقى علي»"],[1510,"قلبي يا المفجع نادى بإشتياق يا علي",6,"استديو «ويبقى علي»"],[1509,"صوت حزن ملأ الكون دويّا صوت جبرائيل",2,"استديو «ويبقى علي»"],[1508,"يا ابو فاضل تعنيتك دخيل وقاصد لبيتك",11,"استديو"],[1507,"لاله لاله يا وليدي نايم",10,"استديو"],[1506,"وين الكفين يا سردال الحرب وين الكفين",7,"استديو"],[1505,"يأيها الأكبر تسقى من الكوثر",15,"(قراءة1)"],[1504,"وليدي يا عبد الله شلون سابح بدمك",8,"استديو"],[1503,"يا عيني بالدمع جودي حبيبي وراح من إيدي",13,"استديو «أبا الأحرار»"],[1502,"يا عيني بالدمع جودي حبيبي وراح من إيدي",18,"مشترك (قراءة1)"],[1501,"ضمني عندك يا جداه في هذا الضريح",7],[1500,"خضبوا في الصلاة أعظم الكائنات",11],[1499,"جاسم ينادي عمته",4],[1498,"قوم جيب الماي خوي لليتامى",14],[1497,"شيعتي يوم العزاء إقصدوني لكربلاء",9],[1496,"الحزن في القلب من لوعة الخطب",12],[1495,"واشهيداه وا حسين ابن علي",19],[1494,"دموع ونوح على المذبوح جينا نواسي الزهراء",10],[1493,"خيمنا مهدمة وعنك مشينا",12],[1492,"يا ابن الأئمة طالت الغيبة يا صاحب الهيبة",8],[1491,"آه يا خامس أصحاب الكساء أنت عنوان الإباء",15],[1490,"أقتلوني أقتلوني ذا نداء من علي الأكبر",19],[1489,"آه من طف كربلاء",10],[1488,"تبكي وتنادي فاطمة وينك يا حماي الحمى",7],[1487,"يا مهدي يا مهدي خذ إذن من الرحمان",9,"(قراءة1)"],[1486,"ياللي رحت للمشرعة عَوّد علينا",6],[1485,"يا شمعة الشبان قوم إحمي الحمية",9],[1484,"نار تلهب في كبدي قطعوا نحرك يا ولدي",13],[1483,"عرسك يا جاسم",4],[1482,"يا شيخ الأنصار تهيأ للحرب",8],[1481,"تبقى على الغبرة يا مدلل الزهرة",8]]},{"id":"akraf","n":"حسين الأكرف","items":[[3975,"ما نسيتك يا علي يا حياتي وكل هلي",30],[3974,"جمرة بين ضلوعي دفنت عند البقيع إنها من كل شيعي",28],[3973,"خيم الليل على قلب اليتامى البائسات",9],[3972,"هذه الليلة تصرخ الدنيا واحسينا واذبيحا",61],[3971,"أسود جلبابها + هبينا يا طف",12],[3970,"دم عاشوراء فيكِ يا حوراء",30],[3969,"إنا لك سلمنا يا ثار الله من بيت الله ماض لله في عين الله",56,"« وداع مكة »"],[3968,"لوين قاصد يا عضيدي بهالضعينة غصبنا عليا ارجع بلياك المدينة",17,"« وداع مكة »"],[3967,"حب علي",5,"شعر"],[3966,"فدوة لك روحي يا غالي , فدوة لك مالي وعيالي",16],[3965,"لمن ترى الحب سوى الله",18],[3964,"عليك مني يا اخي السلام",7],[3963,"الحسين الحسين منقظ العالم , وغدا يبدو لنا سداً منيعا",19],[3962,"ليتني كنت فداهُ ... بأبي العافر خده",33],[3961,"يا قدوة الثائرين يا ايها العسكري",18],[3960,"برض النجف اويلي من دفنوه حيدر",2,"نعي"],[3959,"ايها الراكب المجد رويدك",7],[3958,"مآسينا",2,"نعي , استديو « مآسينا »"],[3957,"يَمتَ يالغايب طال الانتظار",6,"استديو « مآسينا »"],[3956,"يا باكياً",7,"استديو « مآسينا »"],[3955,"بنت من زوج من ام من الأ اخبروني",7,"استديو « مآسينا »"],[3954,"لا والي بني ظليت يا بوي , ولا ام عندي بهل البيت يا بوي",7,"استديو « مآسينا »"],[3953,"يحسين حاكينا ينور العين",7,"استديو « مآسينا »"],[3952,"انا المدينة والدمع جاري بعدك حزينة ليلي ونهاري",6,"استديو « مآسينا »"],[3951,"تناديك احبابه , وين عنها مسافر وين",7,"استديو « مآسينا »"],[3950,"حيرتني يا حيرةً في روح العاشقين ضيعتني في حيرتي يا زين العابدين",9,"استديو « مآسينا »"],[3949,"حسين أي جرح من جراحاتك اعظم ومن اين لمحزون بها ان يتكلم",6,"استديو « أي جرح »"],[3948,"مو انت اللي كنت للبشر سقاي , مايك بالثرى يا حيف هماي",6,"استديو « أي جرح »"],[3947,"عذريني عذريني قطعوا العدا كفيني",6,"احمد الاكرف،استديو «أي جرح»"],[3946,"يبني ضلعيني , يضي عيني , إلك ضلعين",8,"استديو « أي جرح »"],[3945,"تلا جبينك الأعظم قرآنه بالدم جرحاً ملهم",8,"استديو « أي جرح »"],[3944,"داريها داريها حيرانه داريها يا راس ابوها",8,"استديو « أي جرح »"],[3943,"حسين قلبك المدينة الامينة فمن اباحها وروع المدينة",7,"استديو « أي جرح »"],[3942,"صلاة الليل ذكريني من الدمعات غسليني صلاة الليل",9,"استديو « أي جرح »"],[3941,"بأبي الظامي على نهر الفرات",6,"استديو « أي جرح »"],[3940,"كل الفخر",2,"نعي , استديو « فداك »"],[3939,"انت يا سفينة النجاة خذ بنا لشاطئ الحياة",9,"استديو « فداك »"],[3938,"احن منك بشر ما مر مثل يومك ما يتكرر",11,"استديو « فداك »"],[3937,"يا مفجعي ناشدتك الله أرخ معي في يومك الآه",9,"استديو « فداك »"],[3936,"يا شيعتي نصبوا العزا ونوحوا عليّ",2,"نعي ، استديو « فداك »"],[3935,"عيني من انصارك ثارك تحمله والمدمع نارك تهمله",11,"استديو « فداك »"],[3934,"هلي الدمع يا عين صبح ومسية بانت ليالي حسين بأعظم رزية",10,"استديو « فداك »"],[3933,"ابدّي منين حرت يا حسين",8,"استديو « فداك »"],[3932,"لا تعاتبنا يل توادعنا ترى عتابك حركنا من مصارعنا يا حسين",10,"استديو « وقفة ألم »"],[3931,"آه يبني يل يومه ذوبني محتاره جاوبني آه يبني",7,"استديو « وقفة ألم »"],[3930,"ياعبد الله جاوبني يل حاله عذبني يا بدري الي راح",8,"استديو « وقفة ألم »"],[3929,"صلت على جسم الحسين سيوفهم فغدا لساجدة الضبى محرابا",7,"استديو « وقفة ألم »"],[3928,"يل طفيت بشفته احلى ابتسامة علمتنا وقفته معنى الكرامة",11,"استديو « وقفة ألم »"],[3927,"عليك عولت يا أملي وكنت لي غاية فكيف عجلت في مقتلي يا علي",9,"استديو « وقفة ألم »"],[3926,"اللوا والامانة وين والكفين ضاعت أمالي خوي",11,"استديو « وقفة ألم »"],[3925,"آ يا الصادق",5],[3924,"علويون مع الزمان آهو يا حيدر",39],[3923,"قد رسمنا الدرب من دم علي واخذنا الفداء منك يا مقتدى",83],[3922,"من جراحات الهدى السائلة قد حملنا الثار في القافلة يا علي يا علي",28],[3921,"قلبنا يكتوي بالنار لأذا بضعت المختار",45],[3920,"يا صاحب القبة البيضاء في النجف من زار قبرك واستشفى لديك شفي",5,"استديو « اولياء »"],[3919,"صبرك لله يمطول صبرنا يا بو المنتظر ياما انتظرنا",9,"استديو « اولياء »"],[3918,"على رغم العادي زوار .. وفي خط الهادي احرار",12,"استديو « اولياء »"],[3917,"انا وقلبي والف دمعه ليفينا لبن الرضا نودعه",9,"استديو « اولياء »"],[3916,"يا مسجون وغايب عن كل الحبايب بعدك للمصايب ظلينا",9,"استديو « اولياء »"],[3915,"ليتني كنت على قبرك ظلاً ليتني انحني والدمع في محراب عيني ينحني",10,"استديو « اولياء »"],[3914,"ازور الباقر بقيعه الطاهر يم قبره خلوني انثر إله عيوني",12,"استديو « اولياء »"],[3913,"صبت علي مصائب لو انها صبت على الايام صرنا لياليا",9,"استديو « اولياء »"],[3912,"دماء الشهيد : وسيبقى دمهم يجري",30,"« دماء الشهيد »"]]},{"id":"walid","n":"وليد المزيدي","items":[[5656,"يا زينب عن نهجك والله شبرا لا نحيد",17],[5655,"سوف ابقى حيدريا حيدري",7],[5654,"طاح شيال العلم طاح حماي الحرم",5],[5653,"يا خير المرسلين يا ضياء الفرقدين",11],[5652,"ما انتظار الدمع ان لا يستهل",14],[5651,"يا ابن بنت المصطفى يا بنت حيدر",8],[5650,"اجرنا من لظى النيران يا رحمن يا راحم",5],[5649,"حسيناه كربلاء إن تنكروني أنا نجل الحسن حسيناه كربلاء",6],[5648,"طلائع الولاء تضج بالبكاء تندب نجل المصطفى",10],[5647,"عبرات السنين لا لن تستكين",9],[5646,"يا عباس جيب الماء لسكينة",13],[5645,"قال احمد دمهم في كل مكان دماء تثور على مر العصور",13],[5644,"اشلون بي لو قرب مني الاجل",6],[5643,"لقاء الإمام الحجه (نعي) + يا امام العصر قل لي اي هم فيك يغلي",21],[5642,"ايام عزاء يا محمد موسم بكاء يا محمد",3],[5641,"عندما برز وهب للقتال (نعي) + (ارخصت الدمع الغالي)",11],[5640,"السلام على مكسورة الضلوع",6],[5639,"الإمام زين العابدين يبكي ويمزج الطعام بدموعه (نعي)",3],[5638,"طأطِئو الرؤوس إن راس حسين رفعوه على القنا الخطار (نعي)",3],[5637,"ينقل ان طفلة للإمام الحسين رأته في عالم الرؤيا (نعي)",6],[5636,"زينب يا علي تنادي راح كفيلي وعمادي",6],[5635,"انا زينب بنت علي واخت الشهيد",5],[5634,"يمة لا تبكين علي إني شهيدٌ شهيد",9],[5633,"يمة ذكريني من تمر زفة شباب",11],[5632,"حسين حسين نصرخ للأبد",2],[5631,"نعي+يا زينب اعذريني يا زينب سامحيني",29],[5630,"ياوريث الانبياء ياحسين يا إمام الشهداء",5],[5629,"ياشيعة الحسين قد هلّ المحرم جودي علية دمعك",14],[5628,"ياشباب الطف يا رمز الاباء جددوها كربلاء",6],[5627,"يارسول الله هلا زرت ارض الرافدين",3],[5626,"يا رسول الله سيد الامم",2],[5625,"ابا صالح شبابٌ جاؤو للحج",4],[5624,"يا لهيباً يشعل الثورة + يالله تنفتح كربلاء + من زيارة الإمام الحسين",8],[5623,"ياحسين تبكيك دموعي ياحسين نارك بضلوعي",12],[5622,"يا ابنة الزهراء قومي واحضري يوم الوداع",14],[5621,"صحت ياحسين دموع العين على الخدين تواسيني",8],[5620,"يحسين بضمايرنا صحنا بيك آمنا",16],[5619,"يا علي يا علي يا علي زينب احتارت هالشهر",7],[5618,"يابن ابي قم يا عباس",14],[5617,"وامامي وا حسين",5],[5616,"افعالكم يا ظالمين مسجلة",4],[5615,"ذكرى الطف تبقى فينا حبلا للايمان متينا",17],[5614,"تركت الخلق طراً في هواك",13],[5613,"سبحان من توحد بالعز والبقاء",4],[5612,"شعلة الحق ستبقى للقيامة يا محمد يا صراط الإستقامة",18],[5611,"جئنا شهر العزاء شهر حزن وبكاء",17],[5610,"سل بعاشوراء ما حل بوادي كربلاء",11],[5609,"لهفي على السجاد اذ يدفنو الاجساد",29],[5608,"رنين السيوف يدوي يدوي بسمعي",10],[5607,"قاسماه تتهادى دمعة من عيون الأم تبكيك دما",11],[5606,"اختاه هذي وصايا اسمعيها طبقيها",9],[5605,"واختفى النجم وعاد الليل يقتاد سكونه",7],[5604,"لنبكي يا علي بلوعة ودمع على رزء الحسين",10],[5603,"ايها الناعي اجبني ما جرى في كربلاء",16],[5602,"عهدا سيدي عهدا سيدي نجدد الذكرى 3",17],[5601,"من كربلاء سار بالقلب مع الحافلة",6],[5600,"من قال الممات يفني الذات",5],[5599,"في المدينة حسين اصدر بيان",17],[5598,"زينب لولاكي ماعرفنا معنى الصمود",12],[5597,"عبراتي سرمدية لكي انت يا ابية",10],[5596,"كل دم في الدنيا يجف الا كربلاء",11],[5595,"كوفة الغدر كفى مسلم اين اختفى",13],[5594,"كربلا لا زلتي كرباً وبلاء",7],[5593,"جروح الإمام نزفها هدار",5],[5592,"اذا رمت النجاة فزر حسيناه",6],[5591,"هدمت اركان للهدى صاح جبريل مرددا وا حيدر",14],[5590,"قد هلّ هلال محرم فالبس ثوب الأحزان",22],[5589,"يا قمر هاشم هاي الفواطم",18],[5588,"هلّ المحرم فاندبي ياشيعة الزهراء",9],[5587,"هدمو الاضرحة المثلى لدى الزوار",7],[5586,"فجر الاحزان ياقلب ونادي بالاسى",4],[5585,"فيض محرم ينطق بالدم واحسناه وا شهيدا",14],[5584,"اوليدي يا عبد الله اشلون سابح ابدمك",17],[5583,"الامة يا علي بعد عينك في غمة",4],[5582,"دم تفجر للاسلام يثار بنداء الله اكبر",12],[5581,"احنا يابوعلي نحمل رايتك",6],[5580,"بالخلد قد طابو بالقلب احبابُ",4],[5579,"بالطف ينادي من الاعادي",2],[5578,"هذا الذي تعرفه البطحاء وطأتة",6],[5577,"اتاك المحرم ينعى الابات",13],[5576,"ارضعتني امي حبا للحسين",11],[5575,"انا الحوراء يااماه اليكي اشتكي الالم",21],[5574,"الروح فاضت ألم",10],[5573,"القلب تفطر يا ليلى",7],[5572,"الله اكبر صرخة تقهر",9],[5571,"علي الأكبر (نعي) + (ياابن الاسلام)",16],[5570,"ابو الفضل (نعي) + (اخي الاحزان كما النيران)",29],[5569,"يا راحل عنا افجعتنا اذ كنت نور للدنى",6],[5568,"يا ابا صالح يا ابا صالح مات التصبر بإنتضارك",2],[5567,"سل ابا الفضل بهاتيك الربوع اذ له زينب جائت في اهتضام",17],[5566,"صبت علينا مصائب لو انها صبت على الأيام",8],[5565,"صرختي طول حياتي يا حسين يا قتيل العبرات",7],[5564,"حب الحسين أجنني",12],[5563,"اي عيد نراه بعدك حيدر",22],[5562,"يا حوراء يا حوراء أمك الزهراء توصيك وتبكي",23],[5561,"حوراؤنا تقاسي في ظلمة المأسي",11],[5560,"حار بالقلب سؤال",17],[5559,"ليلة وداع ويه الحبايب يا حسين",7],[5558,"بالطف ينادي من للأعادي",8],[5557,"يا طبيب جمع الطب دواء",9],[5556,"طبق الأفق ظلام اقدم",9],[5555,"عدت يا شهر المحرم جئتنا بالحزن والغم",14],[5554,"عظم الله لكي الاجر بنية بالحسين",24],[5553,"عربد الدهر علينا يا امامي",8],[5552,"يا سائل عن الحسين هو الفداء هو الإباء",14],[5551,"عمتي جئت اشكو حالتي",16],[5550,"علي يا علي علي يا علي",1],[5549,"عهدا سيدي عهدا سيدي نجدد الذكرى 2",12],[5548,"عهدا سيدي عهدا سيدي نجدد الذكرى",5],[5547,"عادت الذكرى تسكب العبرى",11],[5546,"عباس انت الجبتني قوم ردني للوطن",4],[5545,"يا ليتك ترجع والكف لا تقطع اخيه عباس",10],[5544,"علي وينه تنشديني يا زينب لا تذكريني",8],[5543,"هذه طف المنايا فأستعدي للرزايا يا زينب يا زينب",8],[5542,"قتيل الطف في أعماق وجداني",33],[5541,"فاطمة يا حسين انا امك يا شهيد كربلاء",8],[5540,"إلهي بحق السبط المنحور إلهي عجل ظهور المنصور",24],[5539,"تقسم الشيعة أبدا والله ما ننسى الحسين",10],[5538,"كربلاء نأتيك شوقاً وحباً نحيك فكرا ودرباً",15],[5537,"ابا الفضل يا صاحب الوفاء",15],[5536,"يا بشر أخبرني عن حالة المولى 2",9],[5535,"يا بشر أخبرني عن حالة المولى 1",12],[5534,"يا حيدر اتمرمر قلبي لمصابك ونمرد",7],[5533,"دخيلك ترحم ونيني يتيمه لا تخليني كفايه مصاب يا حيدر",10],[5532,"فكر بنتك غدا مذهول (عليما جيت إلي محمول)",8],[5531,"الأكبر بعزمه يأتي كبركان إلى أبيه قائلاً يا تاج عدنان",14],[5530,"محفور بقلبي حبي للحسين يا ثائراً في الله يا أبا عبد الله",29],[5529,"بالقلوب شاهدوها زينب لما رأت امها بالطف 2",27],[5528,"بالقلوب شاهدوها زينب لما رأت امها بالطف 1",24],[5527,"عريس والثوب أحمر بالنزف الله اكبر",16],[5526,"سلم لم سالمك حرب لمن حاربك مولى حسين مولى",6],[5525,"كلنا لك فداء يا ابن خير الأوصياء",5],[5524,"يا صحبة الحسين حق لكم وديّن",24],[5523,"السلام على الخيام والفرات (السلام على القباب النيرات)",24],[5522,"زينبنا العقيلة همومنا ثقيلة",18],[5521,"شوقا إليك يا أبا عبد الله",7],[5520,"باعلامكم زي الأسى والمدمع الساجم 2",10],[5519,"باعلامكم زي الأسى والمدمع الساجم 1",9],[5518,"يا رافع اللواء علمتنا الولاء",27],[5517,"هذه ليلى تنادي انت يا نور فؤادي",17],[5516,"اسمعيني في أنيني إنني اوصيك اختاه افهميني",17],[5515,"يا حسين بضمايرنا صحنا بيك أمنا 2",18],[5514,"يا حسين بضمايرنا صحنا بيك أمنا 1",3],[5513,"بالعناء بالرخاء لذ به أخية صح أيا حسينا",8],[5512,"قلبي كسرته يا غريب الغاضرية 2",6],[5511,"قلبي كسرته يا غريب الغاضرية 1",3],[5510,"ودع قبر جده ورجع والقلب ممرود 2",16],[5509,"ودع قبر جده ورجع والقلب ممرود 1",4],[5508,"يا حسين كلنا نعتني لك كربلاء نزور",12],[5507,"ابث الهم والشكوى آلا يا صاحب الأمر 2",3],[5506,"ابث الهم والشكوى آلا يا صاحب الأمر 1",8],[5505,"اينكم يا من تحرمون العزاء انكم لا تفهمو معنى الولاء",3],[5504,"غسلوني بدم السبط الشهيد",12],[5503,"خويه لاوين لو رحت عني يا خويه القوم يذلوني",15],[5502,"انها قصة منهاج الفلاح (يا حيدر علي)",10],[5501,"لفاطم الحزينة جئت إلى المدينة اين البتول بنت الرسول",28],[5500,"كفانا هم كفانا غم أبا صالح",35],[5499,"عدت من بعدي لك يا جدي اشكو آلامي",24],[5498,"انا ابن مكة ومنى (نعي) + (هذا الذي تعرف البطحاء وطأته)",6],[5497,"يا زينب قومي ودعيني بعد ساعة تفقديني 2",14],[5496,"يا زينب قومي ودعيني بعد ساعة تفقديني 1",2],[5495,"يا كربلاء يا كربلاء متى متى الزيارة",4],[5494,"يم طوعة مسلم صار حاير يدير أفكار 2",6],[5493,"يم طوعة مسلم صار حاير يدير أفكار 1",9],[5492,"من قفا بالضما ذبحوني (واحسيناه واحسناه)",7],[5491,"يا الولي وياك خذني لكربلاء تدري بعدك قلبي ما يتحمله",9],[5490,"حيدريون يا علي كل الكروب في هواك تنجلي",17],[5489,"صارت صوايح للبنات الهاشمية من صاح حيدر ودعوة الزهراء",5],[5488,"نعي+خوي صبري على اللي يجري صبر حسين العقيلة",15],[5487,"يا أيها النازلون في البلاء هذه الديار تسمى كربلاء",10],[5486,"ليس الغريب غريب الشام واليمن",13],[5485,"عد إلينا يا حبيب أنت عنوان القضية",11],[5484,"اشتقنا للزيارة أبا عبد الله",6],[5483,"احنا غير حسين ما عدنا وسيلة",12],[5482,"كفيلي وين يالوالي كفيلي وين قلي يحسين يا ابن امي",11],[5481,"باعلامكم زي الأسى والمدمع الساجم",13],[5480,"اتعلم اتعلم (يا مسلم اتعلم)",6,"استديو «الراية»"],[5479,"من حامل الراية الحسينية يا مسلم تعلم",6,"استديو «الراية»"],[5478,"من هذا الذي نزل إلى ساحة الحرب (يا كف ابو فضل)",8,"استديو «الراية»"],[5477,"بدر السماء مفجوع ودمعه يسيله",6,"استديو «الراية»"],[5476,"شلون اشرب (حديث العباس للماء) + (ما اشرب من مايك)",8,"استديو «الراية»"],[5475,"يا عباس انا الماء (حديث الماء للعباس) + ( يا عباس أغرفني بيدك)",10,"استديو «الراية»"],[5474,"يا إله الورى يا عظيم (مناجاة الجروح)",7,"استديو «نينوى»"],[5473,"يا ربي الثار بحق الأطهار (شكاية الثأر)",9,"استديو «نينوى»"],[5472,"حايره ومن بعد ما سلبوها (غربة لقاء)",9,"استديو «نينوى»"],[5471,"خذني إلى جنب الشريعة فلك اليوم فجيعة (استنهاض)",10,"استديو «نينوى»"],[5470,"الوه على عضيده ودماه مطشره (إنكسار)",9,"استديو «نينوى»"],[5469,"ودعوني ودعوني من قبل تفقدوني (بقايا ليل)",10,"استديو «نينوى»"],[5468,"وصلنا كربلا وزحف جيش البلا",7,"استديو «نينوى»"],[5467,"ضمني يا جدي عزمت عنك اشيل (الرحيل)",10,"استديو «نينوى»"],[5466,"ذات يوم كسفت شمس الشعوب",5,"استديو «الناعي»"],[5465,"لا تدعوني ويك ام البنين (نعي) + (دموعنا اليوم)",7,"استديو «الناعي»"],[5464,"عاد يوم الأربعين فيه قلبنا حزين",4,"استديو «الناعي»"],[5463,"عبراتي سرمدية لكي انت يا ابية",6,"استديو «الناعي»"],[5462,"زينب جئناكِ نحي ذكرى يوم الأربعين",4,"استديو «الناعي»"],[5461,"سرت والأسى يصاحبني (الناعي)",7,"استديو «الناعي»"],[5460,"زينبُ زينب جئناك من بعد جئناك نبكي",6,"استديو «الناعي»"],[5459,"دموع حسين تتجارى على الكفين والراية",9,"استديو «الساقي»"],[5458,"فدا زينب يا سيوف الفناءِ علي اهجمي وارتوي من دماءِ",5,"استديو «الساقي»"],[5457,"عباس يا ضي عيني اليوم يومك يا القمر",5,"استديو «الساقي»"],[5456,"يا عباس استمع مني وصيتي زين",5,"استديو «الساقي»"],[5455,"يا درع حسين تشوف العين مثيلك وين يابو فضل",11,"استديو «الساقي»"],[5454,"قلي يا نور العين وش قصة الكفين (المهد)",6,"استديو «الساقي»"],[5453,"عتابك يا زينب مرد دلالي (نعي) + (يا زينب حقك تعتبي)",11,"استديو «عادت زينب»"],[5452,"يا خوي ما اجيت الطف علامة (نعي) + (يا محمد يا سبع الكون)",6,"استديو «عادت زينب»"],[5451,"جيتك اجر بين المصايب يا ابن عمي (نعي) + (تلقاني يابن جعفر)",6,"استديو «عادت زينب»"],[5450,"يا منازلنا الخليه جيتك بعبره جريه",8,"استديو «عادت زينب»"],[5449,"اماه يا ام سلمه قومي انحبي",6,"استديو «عادت زينب»"],[5448,"لما وصلت زينب إلى مدينة رسول الله (نعي) + (يمه عادة كل مسافر)",9,"استديو «عادت زينب»"],[5447,"لما قرب موكب السبايا (نعي) + (للمدية رجعت الحوراء)",8,"استديو «عادت زينب»"],[5446,"يروى انه لما وصل موكب السبايا (نعي) + (جيتك يا خوي)",13,"استديو «عادت زينب»"],[5445,"رملةٌ صاحت قلبها ذاب اين القاسم ابني",11,"محرم1427"],[5444,"كسرت ظهري وزدت همي اخي ابا الفضل",28,"محرم1427"],[5443,"الوداع الوداع يا أهل بيتي",7,"محرم1427"],[5442,"حبيبك ثار يحامي الجار",22,"محرم1427"],[5441,"انوح عليك يبني من ينوح وياي (نعي) + هذه طف المنايا",9,"محرم1427"]]},{"id":"hamza","n":"حمزة الصغير","items":[[1327,"يمه ذكريني من تمر زفة شباب من العرس محروم",21],[1326,"يا ما أحلى الوداع بهالمسية وعلوم المنية",14],[1325,"إحنا غير حسين ما عدنا وسيلة",9],[1324,"يا ابن أمي عالتربان عفتك رمية بالغاضرية",13],[1323,"باليسر زينب عالحرم ظلها ردت بالعيال وبروس أهلها",32],[1322,"دار المخيم هاي والخدر وينه بالعلم والكفين مين يدلينا",29],[1321,"يا ابني وثمر دلالي مني غايب هلالي",16],[1320,"نار بدليلي تسعر ما تنطفي يالأكبر",17],[1319,"ليش حسين متكسرة ضلوعه",15],[1318,"من خان الدهر بحسين",18],[1317,"مسموم القلب وانهدم حيلي من طف كربلا",20],[1316,"زينب والحسين وقمر هاشم مصيوبين بمصاب الفواطم",31],[1315,"جابر يا جابر ما دريت بكربلا إشصار",22],[1314,"يا هلي تودعوني ونرسم بعيوني كني مسبية",10],[1313,"يا هلي إشصار إشصار ما تدلوني",16],[1312,"من سدوا الماي عالفاطمية",7],[1311,"صفاها صفاها للحومة صفاها",15],[1310,"يا ابن أمي اليسر فضت أيامه ورديت بحرمكم واليتامى",15],[1309,"راحة الدارين بالخدمة الحسينية",15],[1308,"يا دهر زينب زينب يا دهر زينب",14],[1307,"ليلى تنادي ومنين أجيب النوم أنا لعيني",7],[1306,"وليدي شبيدي حان الأجل ما بينك وبيني",7],[1305,"زينب تناديك يا صبي عيني",9],[1304,"إنشد العين العين ليش سهرانة",22],[1303,"يا عبد الله",15],[1302,"طاحن كفوف الوفى للشرف والعاطفة",10],[1301,"جينا ننشد كربلا مضيعينها",8],[1300,"أنا أم البنين ودهري ذبني",15],[1299,"تعنت ليه للحومة",5],[1298,"قل لي يالميمون وين والينا",15],[1297,"جابر ما دريت إشصار بالطف",7],[1296,"حيدر من الوحي عينه هاك إخذ من براهينه",15],[1295,"زينب بالأرامل واليتامى ردت من يسرها",14],[1294,"إلمن الصيوان منصوب يا ابني",21],[1293,"أم البنين تنادي يا ابني ويا روح الهادي",18],[1292,"من الشام ردينا مين يدلينا",15],[1291,"سورة التوحيد تحرير العقول ثورة إنسانية فجرها الرسول",20],[1290,"أيها السائل عن آل الرسول",5],[1289,"منصورة منصورة رايتنا منصورة",16],[1288,"شمعة حياتي تضوي بمماتي شعدكم وصية لفاطمة",9],[1287,"رايتنا آية آية رايتنا آية",6],[1286,"نريد ننشدها على زينب وينها",8],[1285,"ديني وأساسي حربي وسياسي من نشأت الروح",30],[1284,"يالرايد تزور الرضا وما يطح بيديك",14],[1283,"رداديات",9],[1282,"منشور منشور العلم تلقاه منشور",6],[1281,"شلون بيي وثقل وزن حسابي",13],[1280,"أنحب وأنشد من الناس",7],[1279,"يهالرحتوا بسلامة وبُقت هاي اليتامى",11],[1278,"نادت زينب الحرة",7],[1277,"ودع أهل بيته حسين",14],[1276,"يا حسين أخبرك من طحت عالغبرة",5],[1275,"يا ولدي خلي الماي لا تطلب الماي",9,"مشترك"],[1274,"نار بدليلي تسعر ما تنطفي يالأكبر",11,"مشترك"],[1273,"يا ابني اللي ضيعتني بضيعتك مني",9,"مشترك"],[1272,"تنادي الوديعة منين الشريعة بعيني يا عباس",10],[1271,"الليلة زينب هم تغمض عيونها",5],[1270,"زينب لفت يم حسين",5],[1269,"آه يا ابني من أشوف المهد خالي",16],[1268,"يا حسين وهبت للعالم حياتك",20],[1267,"يا عرّيس يا عرّيس",11],[1266,"شلون ليلة شلون ليلة يودع حسين العقيلة",23],[1265,"يا مظلوم يا محروم يا ابني خابت ظنوني",20],[1264,"شحالها اللي شافت أخوها بعينها",16],[1263,"لو بيدي يا حسين كنت اظل يمك وأتوسد وياك وأسبح بدمك",25],[1262,"سدوا الماي الماي يا ضوا عيوني",23],[1261,"آه يا ليل ما تم حيل",20]]},{"id":"abobashir","n":"أبو بشير النجفي","items":[[1415,"يا ليل طول ساعاتك يا ليل احمل آهاتك",28],[1414,"أنا البتول الطاهرة اللي ظلموني",20],[1413,"زينب محتارة بهالليلة بين أطفال وبين العيلة",22],[1412,"شطت للتل يا بوي بحرقتي وناديت يا ليث الحرب",5],[1411,"كربلا لا زلت كربا وبلاء + أنا ابن",9],[1410,"يا ابن امي لصوب النهر وديني يا حسين",9],[1409,"ألا أكرم بحامي الدين والشرعة",5],[1408,"زينب تنخت بالقمر كافلها وهاك اسمع",9],[1407,"الأكبر في الميدان",6],[1406,"طلع شبل حسين من مخيمه مسرع",5],[1405,"كفين طاحن عالنهر لو شمس طاحت والقمر",30],[1404,"أعظمت مقام العباس + قوم يا عباس وانشر رايتك",11],[1403,"للشدد يا ابني جنيتك تالي بالمصرع لقيتك",24],[1402,"يا شبان أوصيكم أمكم واجب عليكم",22],[1401,"للطف ساعة اللي توصل روح لقبر أبو السجاد",8],[1400,"هاك القلب يا حسين أخذه وياك يا بوي",13],[1399,"أهاج الضيم أحزاني أبي والهجر آذاني",12],[1398,"يا ناعي لمسلم مصاب أخذ من منحره جواب",20],[1397,"خان الزمان بنا فشتتنا كما خانت بنو صخر ببيعة",4],[1396,"سجلها مسلم ملحمة",7],[1395,"طلعت مثل سرب القطه من خيمها",22],[1394,"صار الأسى عنواني يا ليلة الأحزان",11],[1393,"صحت وأصفق بديّ يا حماي الحمية",15],[1392,"إلهي عليك نقسم بالغريب حسين وبعين القمر",6],[1391,"عالغبرة زلمنا والنار بخيمنا يا حيدر صبري ودعته",14],[1390,"إلك نية تقوم لو أمشي بيسر يا عباس",5],[1389,"حسيناً حسينا حسيناً يا حسين",14],[1388,"ودعوني ودعوني يا الزكية وفارقوني",26],[1387,"سمعت ضعنك رجع يا ابني",6],[1386,"حين شد على الحرب جسامها",5],[1385,"بدموعي حنيتك حنيتك وللحومة زفيتك زفيتك",29],[1384,"أنقل لك لسان الحال عن جسام",5],[1383,"شمر زنودك يا جسام بيين زودك يا جسام",6],[1382,"الحزن والألام في مهجة الإسلام في غيبة الكرار",24],[1381,"خالتحضر لتشيعه تشيع أمل هالشيعة",9],[1380,"ردتك لهشدة تحضر للشدد تحضر يا حيدر",30],[1379,"يا حيدر بباب الدار تسمع صرختي ووني",13],[1378,"فاطم نور السماء فاطم خير النساء",18],[1377,"قد حلت فينا الأرزاء من يوم فقد الزهراء",6],[1376,"يا بضعة المختار يا سلوة الكرار",7],[1375,"غيرك ما عدنا يالزهراء",9],[1374,"حيدر علي يا شيعته غمّض وسكنت ونّته",30],[1373,"عالصلاة الطاحت بمحرابها",12],[1372,"حيدره حامي الدخيل بالخلق ما له مثيل",18],[1371,"حيدر علي بهداي يالتغسلونه وبرضى ديروا الماي",40],[1370,"الله الله أكبر الله الله أكبر",17,"بحق أمير المؤمنين"],[1369,"مفجوعة شيعة حيدره والدمع سكاب",5],[1368,"لأرض النجف يا ابو حسين هالليلة مشبوحة العين",24],[1367,"ردتك تقوم بسلامة بوي يا والي اليتامى",30],[1366,"نصبر نقطع الظنه ثقلك يا علي الونّة",31],[1365,"يا حيدر جزا حدوده صبرنا بالهم والحزن خلّص عمرنا",39],[1364,"يا أمير المؤمنين يا أمير المؤمنين",13],[1363,"يا حيدر يا والينا بلوعة قلب نادينا",30],[1362,"يا حيدر بالهضم والنوح أودعك والقلب مجروح",30],[1361,"والله ساعة التندب علي والله كل همومك تنجلي",28],[1360,"منهاج علي خير السبل",27],[1359,"إلك يا عباس نشكي الحالة من غدر هذا الزمن",5],[1358,"تنشد أخته على كافلها وأخوها بحيرة شيقلها",22],[1357,"يا من على الناقة بيمينك ركبتني",22],[1356,"والله إن قطعتم يميني إني أحامي أبداً عن ديني",14],[1355,"مثلك دليلي يا ولدي مطبر اسم الله على طولك",7],[1354,"بالك تبخس الميزان وانصف واحكم بوجدان",24],[1353,"صاح الأكبر بين العسكر",10],[1352,"هاي المسية يا ابن الزكية لو ودعتني",18],[1351,"كل عام اللي يمر يا حسين احنا على العهد وياك",22],[1350,"يا أميري يا حسين يا أميري يا حسين",9],[1349,"يا حسين يا ابن الزهراء يا حسين",21],[1348,"نحن أنصار الحسين فإشهدي يا كربلاء",27],[1347,"يا حسين وياك اتعاهدنا",9],[1346,"يا خوي حسين عضيضك وين رجعت لوحدك ليّ",27],[1345,"يا عباس يا عباس شلي بعمري يا عباس",7],[1344,"يا مسلم يا نعم سفير للكوفة ما زلت أمير",23],[1343,"مسلم بدايتها هذا أول مصاب",12],[1342,"فليحيا الليث المغوار فليحيا الليث المغوار",7],[1341,"يا غايب زينب انشدها جوابك والخبر عدها",29],[1340,"ياهلي اشيوقع بدي وهذا اللي مقدر عليّ",27],[1339,"لو ردنا الظلم ينزاح نبذل للعقيدة أرواح",30],[1338,"أمك يا عباس القمر ما أنصف وياها الدهر",30],[1337,"اليوم يوم وفائكم يا أيها الأنصار",30],[1336,"مسلم سفير حسين إلمن يدير العين",31],[1335,"جيتك طايح بحيرة يا زينب راح أبو الغيرة",28],[1334,"يا شمعة الشبان يا جسام يا ولدي",30],[1333,"من يشتد حنيني شلون اقطع ونيني",30],[1332,"يا حيدر الليلة محتارة العقيلة تريدك تحضر لها",18],[1331,"زينب تناديك .. وين صارت طيحتك",12],[1330,"زينب بعد غيبتها قصدت قبور إخوتها",29],[1329,"أربعين الطف بالأحزان عاد",26],[1328,"قصدن كربلا بهذا المساء قلبين",10,"استديو"]]},{"id":"hasan","n":"حسن الكربلائي","items":[[3911,"يمن للزهرا متعني امانة وياك اخذ مني",14,"استديو"],[3910,"يكفيني فخرا يكفيني لحسين افنيت سنيني",24],[1480,"ما ننسى مصابك يالزهراء",7],[1479,"الدهر عقبك غدر بينا يا هادينا",7],[1478,"جريح وجرحي ما طاب على الصاحت",25],[1477,"يا ابني حسين بأمرك حايرة وبأمري",12],[1476,"على ضلع ابني يصب دمعي",18],[1475,"يا حيدر بباب الدار تسمع صرختي",13],[1474,"يالغايب طالت هالغيبة",10],[1473,"كم لوعة وكم مصاب شافتها عيني",23],[1472,"بنت النبي من الدهر والزمرة",10],[1471,"دلوني أتوجه وين دلوني وين الصبر",28],[1470,"كل أرض كربلاء في الوجود كل يوم عاشوراء",20],[1469,"بالنحيب والبكاء رددوا هذا النداء",28],[1468,"خدام حسين اتسمّنا",14],[1467,"بعيون احبابك مرسوم خدام حسين المظلوم",40],[1466,"دليلي بهم دمعتي دم",23],[1465,"ذكروني ذكروني ياشيعة لا تنسوني",34],[1464,"يا زينب خبريني على حسين وبنيني",28],[1463,"أربع بنين انطيتك سالم ترد يا ريتك",26],[1462,"يا ابو اليمة حريمه ما عرفت قدره",15],[1461,"أنصار وبالدم بايعنا كل العالم خل يسمعنا",26],[1460,"إلهي بفقد أبو اليمة انكسر ظهري",29],[1459,"سلامي عال كفل زينب",30],[1458,"يا جسام كم بيي إلك حسرة",19],[1457,"جسام يا روح امك حنيت كفي بدمك",65],[1456,"يكفيني فخراً يكفيني لحسين أفنيت سنيني",24],[1455,"ذبحوك ظامي قبل الفطام فخذ سلامي",29],[1454,"يا فاطمة قومي إلى الطفوف",17],[1453,"هالليلة يودعوني وباشر يفجعوني",61],[1452,"عالنهر خليتك ورجعت ما لقيتك",7],[1451,"عالغبرة خليت بدور جيت وشفت بس قبور",32],[1450,"يا طير خبر النبي عما جرى في كربلا",14],[1449,"أنا يا شيعتي الحرة أنا اسمي زينب الكبرى",30],[1448,"غريبة وأهمل العين على الراية وعلى حسين",29],[1447,"السلام على الحوراء زينب السلام على القلب المعذب",17],[1446,"الهي انجان ما ردن لبو اليمة",28],[1445,"حزنك يا مظلوم تجدد",7],[1444,"كربلاء كربلاء ، كربلاء رمز الفداء",19],[1443,"هذا حسين شنهو تعرف عنه",19],[1442,"ربنا هب لنا في كل حين حب الحسين",26],[1441,"شكثر اصبر وتاني سهم فقدك عماني",5],[1440,"لا تلوموني أهلي عافوني",29],[1439,"ما على حاله يهل مسلم دمع",8],[1438,"صوت السفير عبر الأثير",31],[1437,"من المرضع إحنا وياك",11],[1436,"إسمعونا يا طغاة ثورة حتى الممات",30],[1435,"اريد اقعد بباب الصحن",23],[1434,"دلوني دلوني وين القمر",50],[1433,"نهتف بإسمك من نتطبر حيدر حيدر حيدر حيدر",15],[1432,"ربيتك وأحسب أيام ظنيت افرح يا جسام",23],[1431,"يا ابني جاسم ربيتك يا ابني وعيني تحرسك",45],[1430,"لا خيمة لا وليان وأنت على التربان",10],[1429,"لو بيدي يا حسين كنت اظل يمك",14],[1428,"اسمع اسمع يا هارون تحداك بصبره المسجون",27],[1427,"على المسموم في السجن تموت النفس من حزن",9],[1426,"اشتد حناني يا زماني غربتني وروعتني",16],[1425,"خمسة أهل بيت العبا أنا وبنيني خمسة",5],[1424,"أولادي بالشدة تحرسك وما حسبت دهر يمسك",26],[1423,"يا حسين يا امام فلكم مني السلام",24],[1422,"يا خوي يا عباس اتخلينا بعدك بين الأمل والياس",34],[1421,"لا والله لا والله لن تمحوا لنا ذكرا",26],[1420,"زينب تراني ودهري رماني",19],[1419,"دلوني دلوني وين القمر",14,"استديو"],[1418,"يا ابني جاسم ربيتك يا ابني وعيني تحرسك",13,"استديو"],[1417,"اندعيلك اندعيلك وأنتظر يا ابني تجيني",17,"استديو"],[1416,"يا قلبي لا تلوم نوحي وونيني",15,"استديو"]]},{"id":"abothar","n":"أبو ذر الحلواجي","items":[[5099,"لست انساه طريدا عن جوار المصطفى واحسينا",33],[5098,"مرحبا بابو الفضل ساقي عطاشا كربلاء(يراعي المرجله)",5,"استديو «شيال العلم» مع مرتضى الحلواجي"],[5097,"يعباس شيل العلم جيب الماي لسكينه",3,"استديو «شيال العلم» مع مرتضى الحلواجي"],[5096,"من حنت اطفالك ذوبتني ويلاه يمظلوم",6,"استديو «شيال العلم» مع مرتضى الحلواجي"],[5095,"عباس جيب الماي عباس ذاب حشاي",3,"استديو «شيال العلم» مع مرتضى الحلواجي"],[5094,"عباس يا عباس أنكسر ظهري",6,"استديو «شيال العلم» مع مرتضى الحلواجي"],[5093,"يا حسين دمي صوبين يا ضيا العين",6,"استديو «شيال العلم» مع مرتضى الحلواجي"],[5092,"عباس يحسين وحدي تخلوني",4,"استديو «شيال العلم» مع مرتضى الحلواجي"],[5091,"شيل الراية يا عباس وانزل عالمعسكر",4,"استديو «شيال العلم» مع مرتضى الحلواجي"],[5090,"يحسين شيال العلم ميكون (طاحت رايته)",5,"استديو «شيال العلم» مع مرتضى الحلواجي"],[5089,"يعمي وعدك وينه انا العزيزه سكينه",4,"استديو «شيال العلم» مع مرتضى الحلواجي"],[5088,"زينب يختي إعذريني السهم في عيني (قطعوا يميني)",5,"استديو «شيال العلم» مع مرتضى الحلواجي"],[5087,"شيال العلم ليش العلم عافيته",6,"استديو «شيال العلم» مع مرتضى الحلواجي"],[5086,"اطيلي النوح - 3",7,"شهادة السيدة الزهراء 1424هـ مع غازي العابد"],[5085,"اطيلي النوح - 2",9,"شهادة السيدة الزهراء 1424هـ مع غازي العابد"],[5084,"اطيلي النوح - 1",9,"شهادة السيدة الزهراء 1424هـ مع غازي العابد"],[5083,"بيرق المظلوم شيله ياحبيب",4,"استديو «رضيع الحسين»"],[5082,"عند الله يعبد الله يرونك (حيدر والبتول)",6,"استديو «رضيع الحسين»"],[5081,"وحدي تخليني يا (زهرة سنيني)",10,"استديو «رضيع الحسين»"],[5080,"عباس لتعوفه ظامي وانت المحامي",11,"استديو «رضيع الحسين»"],[5079,"هالطفل عطشان",6,"استديو «رضيع الحسين»"],[5078,"عبد الله يا (الغالي)",8,"استديو «رضيع الحسين»"],[5077,"بالروح بالدم نفديك يا مظلوم (دمي)",7,"استديو «رضيع الحسين»"],[5076,"عبد الله يبني حالك فجعني",11,"استديو «رضيع الحسين»"],[5075,"الخيل الخيل إجتنا (خويه يحسين)",3,"استديو «الظليمة» مع مرتضى الحلواجي"],[5074,"وداعك الله يحسين يلوالي (الوداع يا حسين)",3,"استديو «الظليمة» مع مرتضى الحلواجي"],[5073,"اصحى واسمع يا يزيد ما يجف دم الشهيد",6,"استديو «الظليمة» مع مرتضى الحلواجي"],[5072,"إلا الحسين ينذبح عطشان (يا ماي)",6,"استديو «الظليمة» مع مرتضى الحلواجي"],[5071,"يابن امي يحسين تنتظرك (أيتامك)",7,"استديو «الظليمة» مع مرتضى الحلواجي"],[5070,"يا مهدي عجل (لثارات الحسين)",6,"استديو «الظليمة» مع مرتضى الحلواجي"],[5069,"الله اكبر يا حيدر ذبح الحسين يا حيدر (الله اكبر)",7,"استديو «الظليمة» مع مرتضى الحلواجي"],[5068,"صوت علا من كربلاء يا حسين (صوت بكربلا)",7,"استديو «الظليمة» مع مرتضى الحلواجي"],[5067,"يعيوني بالأيتام والالام عفتوني(ليش عفتوني)",7,"استديو «الظليمة»"],[5066,"بعد عيني يزينب تكفلي بعيالي",6,"استديو «الظليمة» مع حسين الحلواجي"],[5065,"حيرني زماني بالمحنه رماني(يدلالي على الغالي)",7,"استديو «الظليمة» مع حسين الحلواجي"],[5064,"لا تسالوني شفت المهر خالي (دمعت عيوني)",5,"استديو «الظليمة» مع حسين الحلواجي"],[5063,"الظليمة قد قتلو حسينا",5,"استديو «الظليمة» مع حسين الحلواجي"],[5062,"أيدك الله يا علي آزرك الله (يا أملي)",9,"استديو «حروف القرآن»"],[5061,"يا ابا الحسن علي علي (نجوم السعد)",7,"استديو «حروف القرآن»"],[5060,"يا أمير البشر كل حياتك عبر يا علي",7,"استديو «حروف القرآن»"],[5059,"من دمع يعقوب ويحيى",8,"استديو «حروف القرآن»"],[5058,"علي مولانا (علي مولى علي)",7,"استديو «حروف القرآن»"],[5057,"ذاك النجم الثاقب (أسد الله الغالب)",6,"استديو «حروف القرآن»"],[5056,"حيدر يا ابو حسين (يمزلزل الكونين)",6,"استديو «حروف القرآن»"],[5055,"من دمك سالت حروف القرآن (أنت القرآن)",11,"استديو «حروف القرآن»"],[5054,"لا تسلني يا جابر الأحزان فكربلاء جرحي",26],[5053,"يلتلوموني وتطيلون العتاب+ يامدد الشهادة يا دوحه القيادة",45],[5052,"وحدي وسواد الليل خيم اتعثر وكم جثه ودم",15]]},{"id":"saleh","n":"صالح الدرازي","items":[[4012,"موكب العقيلة",41],[4011,"يا شعب حيدر الدم كبر ذوبوا جميعاً في حب حيدر",16],[4010,"يا زهراء عن نهجكي ولله شبراً لا نحيد",46],[4009,"يا ليلة القدر الحزينة محراب حيدر في الليل كبر",45],[4008,"حبي يبقى للحشري يا ربي بالكرار اغفر لي",36],[4007,"يبو صالح ترى الغيبه علينا طالت وطات مآسيها",6],[4006,"انا الذي سمتني امي حيدره حامي حماها ومبيد الكفره",9],[4005,"أميري علي حياتي علي يا رب فإحشرني مع الكرار حيدر",56],[4004,"بين المئاسي عادت الذكرة فاستقبلينا كربلاء بين الأسى",59],[4003,"اعطيناك الكوثر لن تفنى يا حيدر يا در ويا جوهر في الخلد يا حيدر",44],[4002,"ودعناك بنار الحرقة والاحزان يا باب الرحمان",34],[4001,"لله دموعي لله ظلوعي والحب إلى يوم القيامة",47],[4000,"عهداً يا عاشوراء إني حب ووفاء بجراحاتي وعطائاتي",54],[3999,"حسين واحسيناه غريب واغريباه شهيد وا شهيدا",10,"استديو"],[3998,"حبك يا حيدر",18],[3997,"السلام عليك من بعيد المدى يا امل المستضعفين",66],[3996,"ايا ساقي الورا يوم الوعيدي يا علي الا فاشفع لنا عند الورود",25],[3995,"قصة الكاظم درس للبشر خلدوها واحملوها للقيامة",53],[3994,"ليتنا كنا معك ليتنا كنا فداك يا ابا عبد الله",42],[3993,"يا زينب انت ثأراً للجراحات البعيدة",24],[3992,"يا بذور الطهر حيدر اطلب الثأر المظفر",21],[3991,"يا أبا الزهراء خذنا نحن قصمنا سنينا",42],[3990,"نار وضياع بعدك ياحيدر يا حامينا لا تخلينا",10],[3989,"من قلعة الاحزان ثورة من كسرة الظلعين ثورة يا زهراء",11],[3988,"من ظلوع الحق ثورة تطلب الثار يا زهراء",25],[3987,"حبكم ال الرسول",4],[3986,"كسروها ضلوع الشريعة فندبوها",40],[3985,"قيود الأسر يا سجان فعال الجبناء",14],[3984,"سهامٌ أمويه على نعش الامام",19],[3983,"جئنا بالجراحات الدميه جئنا بالشعارات الأبيه , في العزاء والبكاء",30],[3982,"تضحيات وشعائر ونداءٌ في الظمائر يتعالى حسين واحسين",22],[3981,"ايها القيد تكسر فعلي قد تحرر , بالدعاءِ والبكاءِ",29],[3980,"الا يا قلعة الاصرار يا زينب",55],[3979,"أصبح في الأمة شرخاً لا لن يبقى طويلا , اينك مهدي",26],[3978,"أذني كعبة الإصرار والثار محرابٌ ومنبر يبكون لحيدر",45],[3977,"دم عاشوراء فيك يا حوراء جمرتٌ مشتعلة",45,"« ثأر الله الأعظم »،مشترك مع جعفر"]]},{"id":"shobbar","n":"علي شبر","items":[[5231,"زهرة يا ام الحسن حايرين بهالزمن (كلنا ننشد)",6],[5230,"يا المهدي قوم برايتك",5],[5229,"يا الحنينة تودعينا قومي يا يمه حضنيني",14],[5228,"يا ابن الحسن دم حسين نامت عين فُجّاره (شوط كربلائي)",12],[5227,"قلي يالميمون وين والينا راح ابو السجاد",11],[5226,"آه يحسين ومصابه+ خدمتك يحسين عنوان الفخر",5],[5225,"نخيتك نخوة اختك زينب الحرة يا عباس",11],[5224,"يا حسين زينب هضموها وبالسوط اختك ضربوها",13],[5223,"انا فاطمة ياحسين انا امك",6],[5222,"وين تنام العيلة يا خوي بهالليلة",15],[5221,"ناديتك يا بوي بقلب مهضوم (بدون لطم)",17],[5220,"حاير باشر بمنجاي (حماي الدخل ياحسين) (نزله)",7],[5219,"ايا بنت الهدى في كربلاء ينحر (المقتل)",13],[5218,"يا محلا الوداع بهالمسيه",12],[5217,"لك تبكي بالدماء عين السماء",18],[5216,"يبني يلغالي شفتك قبالي بالنبله مذبوح",13],[5215,"يمه يا زهرة الحزينة زينب بفقدك حزينة",7,"استديو «قال سليم»"],[5214,"قال سليم قلت يا سلمان هل دخلو ولم يك استإذان",10,"استديو «قال سليم»"],[5213,"يمه يمه انكسر ضلعك يا زهرة",9,"استديو «قال سليم»"],[5212,"شدها بنات الفكر من بلواي (أبوذيات)",5],[5211,"بايعنا يا حامي الحمه بايعنا يا عقد الولا",7],[5210,"العشق بنا دم يجري عشق الكرار (نزله)",6],[5209,"يا علي انت رمز للحياة",10],[5208,"يا حسن يا حسين هالنعش لاوين شايلينة",17],[5207,"بارينا ارتجت اكوانه (نزله)",4],[5206,"هالليلة الزكيه قاصده الكوفة للوالد تعنت فاطمة تشوفه",7],[5205,"لتودعنا ولتفارقنا يا والينا",10],[5204,"صاح جبريل شجيا افجع الخطب",20],[5203,"يا مولاتي يا فاطمة اغيثيني اغيثيني",5,"استديو «بنت الهدى2» مع محمد الحجرات"],[5202,"بويه يا حيدر نخيتك تحضر الساعة رجيتك سقطوني",6,"استديو «بنت الهدى2» مع محمد الحجرات"],[5201,"صبت علي مصائبأ لو أنها",10,"استديو «بنت الهدى2» مع محمد الحجرات"],[5200,"زهراء ضلعك تكسر لو ضلعي",12,"استديو «بنت الهدى2» مع محمد الحجرات"],[5199,"لا تلومونا على حب البتول",9,"استديو «بنت الهدى2» مع محمد الحجرات"],[5198,"يا سامراء افتحي بابك وخلينا نوصل لقبة هادينا",12,"استديو «سامراء»"],[5197,"سامراء باكية تنعاه ضج الوادي غاب الهادي",16,"استديو «سامراء»"],[5196,"حضره قبر عودك وجدك (نعي) + هذا المعتقد رايت فخرنا",13,"استديو «سامراء» مع السيد يوسف الموسوي"],[5195,"قد سار بمناهج علي (نزله)",14],[5194,"زينب تنادي ياحيدر من وقع عالغبره الأكبر",18],[5193,"شبلاك يخوي حسين شنه الجرى (نعي)",2],[5192,"يلأكبر هالمنبر من دمك خالد يبقى",14],[5191,"جسام واويلاه يا عريس الزفته سيوف (نزله)",12],[5190,"جاسم يبني يالغالي",19],[5189,"وجاسم إجا لقلبي جرح يبني (نعي)",2],[5188,"يا رمله هلي دموع (طفي الشمع)",11],[5187,"طبعه القمر من يطلع يجن الليل (نزلات)",14],[5186,"ليش الكفوف مقطعة يمك يليث المشرعة",19],[5185,"بلا دين قوم اللي غدرت الكافل (نعي)",4],[5184,"عشطانه عطشانه عيالك خويه",13],[5182,"صوت المنحر بالطف كبر أحنه انصارك",11],[5181,"يا فرسان الهيجاء صرتم فوق البوغاء",18],[5180,"وشدو زلم عقدو محازمهم وشدو (نعي)",2],[5179,"يا حسين عاهدناك يا حسين بايعناك للموت وياك",12],[5178,"ابن عقيل جاء سفيرا يبغي البيعه من كوفان",7],[5177,"مسلم بسيف الإيمان يحصد رقاب الطغيان",20],[5176,"ولا هل اختفت شهر الحزن (نعي)",3],[5175,"ما يتعوض حضنك يابه فقدك جمراته لهابه",10],[5174,"إني أنا أم البنين ابكي على رزئ الحسين",7],[5173,"منهو لعنده مثلي قلب (اربع بنين على الترب)",20],[5172,"ولاجال تحوم همومي يولادي (نعي)",2],[5171,"واسوها للحرة موقف مشهور قدمت للزهرة",11],[5170,"تجري دموعي وعيني أربيه (نزله)",5],[5169,"دمعة مخنوقة بالعين تفجرت بوداع حسين",16],[5168,"وسيلي يا عيني الدمع دم صبي وسيلي (نعي)",3],[5167,"ايها الشهر الذي ساد الشهور (واحسينا)",9],[5166,"يا اولادي حدا الحادي لتنسوني (نزله)",6],[5165,"خيم بالطفوف حسين (شوط كربلائي)",11],[5164,"ركب سبط المصطفى حاملا اهل الوفا",16],[5163,"واجرى ما تدري السده على حسين (نعي)",2]]},{"id":"hoseini","n":"محمد الحسيني","items":[[5420,"وين عباس قلبي يسالني ويناشدني وينه عمي",7],[5419,"يا عباس تصرخ كل الأطفال جيب الماي",8],[5418,"ولاني دهري حيرني بأمري",19,"مع فارسي"],[5417,"عبرات دمعات تجري على الخدين",17,"مع فارسي"],[5416,"جيت ليلى تصيح الأكبر والدموع منثره (2)",2],[5415,"جيت ليلى تصيح الأكبر والدموع منثره (1)",6],[5414,"عندي عتاب وياك يلي تركت بنتك",14],[5413,"يا ابني الولد قوم بسك من النوم",8],[5412,"قوم يا ابني شمعتك طفوها",6],[5411,"يبو اليمه يا ضي عيني وامل عمري",7],[5410,"بالقلب مطبوع اسمك كربلاء",3,"مع فارسي"],[5409,"انصار انصار إلك ونقدم دمانا هدية",10],[5408,"ما جاني خبر يا بوي والهم غير الواني",12],[5407,"زينب انا ام المصايب",8],[5406,"عفتنا بحيرة يا حيدر نصب دمعات ونتحسر",6],[5405,"وانضرب حامي الحمى الدنيا صارت مظلمة",9],[5404,"امان أي دل بيا أي باد سبا (شعر)",3,"استديو «يا والدي» فارسي"],[5403,"قتلو حبيب المصطفى ويلي واويلاه",5,"استديو «يا والدي»"],[5402,"شلون يوم على النبوه وآلها",5,"استديو «يا والدي»"],[5401,"وين عمي بوي يحسين",5,"استديو «يا والدي»"],[5400,"يا نهر الحزن والنوح (نعي) + ام البنين",13,"استديو «يا والدي»"],[5399,"اه يا ابن الولد يا ابني",5,"استديو «يا والدي»"],[5398,"عباس عباس شايب غدا الراس",7,"استديو «يا والدي»"],[5397,"فزعت اليوم الهواشم يا علي",3,"استديو «يا والدي»"],[5396,"قومي يا زينب هلهلي طلع شباب من الخيم",5,"استديو «يا والدي»"],[5395,"حديث بين الإمام الحسين والسيده رقيقه + يا والدي",15,"استديو «يا والدي»"],[5394,"هاللية أنضرب حامي الحمة وركن الإمامة",3,"استديو «وغابت الشمس»"],[5393,"اليتامى تصيح وينه سيدنا",10,"استديو «وغابت الشمس»"],[5392,"تنادي زينب الكبرى اخذني يا علي يمك (نعي) + عفتنا بحيرة يا حيدر",16,"استديو «وغابت الشمس»"],[5391,"زينب أز به علي",11,"استديو «وغابت الشمس» فارسي"],[5390,"كافي لوعه وعذاب يلي ناوي الغياب",8,"استديو «وغابت الشمس»"],[5389,"يبوي أنخاك يا علي الكرار",8,"استديو «وغابت الشمس»"],[5388,"ظلت خيمنه موجره وين شيال العلم",5,"استديو «بنت مسلم»"],[5387,"الله أكبر كبرو هذا أبن حيدر",4,"استديو «بنت مسلم»"],[5386,"عمه بابايم كجاست",8,"استديو «بنت مسلم» فارسي"],[5385,"وسط خيمة حزن زينب (مأساتي يالوديعة)",10,"استديو «بنت مسلم»"],[5384,"عندي عتاب وياك يلي تركت بنتك",8,"استديو «بنت مسلم»"],[5383,"ظامي ظل يتجاره دمك يبني اشرب دمعة امك",9,"استديو «بنت مسلم»"],[5382,"انا حميدة بنت مسلم يتيمه",6,"استديو «بنت مسلم»"],[5381,"يا يوم انظر قبتك",3,"استديو «قصة هموم»"],[5380,"شهريال دو عالم",7,"استديو «قصة هموم» فارسي"],[5379,"وداع القمر وي حسين محتار اعبره وحسن يصبره",6,"استديو «قصة هموم»"],[5378,"يا وليدي يا عبد الله يا محلى دمع عيناك",7,"استديو «قصة هموم»"],[5377,"انعم الله على الآل بعز وجلال",3,"استديو «قصة هموم»"],[5376,"مهدي مهدي كنك نسيت الثار عجل عجل",7,"استديو «قصة هموم»"],[5375,"اليوم يوم البكاء",14,"استديو «قصة هموم»"],[5374,"كوشكن با جان و دل",9,"استديو «يا عراق» فارسي"],[5373,"علي مولا مولا علي ينوح القلب كل صبح حيدر",9,"استديو «يا عراق» مع فارسي"],[5372,"زينب بعين القمر للحزن شافت صور",5,"استديو «يا عراق»"],[5371,"بدموعي انادي والجمرة بفؤادي",6,"استديو «يا عراق»"],[5370,"الم واهات لأبو الحملات",8,"استديو «يا عراق»"],[5369,"يا علي دمك نزف (صوت الأمين)",10,"استديو «يا عراق»"],[5368,"فاطمة يا حسين انا امك (يا شهيد كربلاء)",3,"استديو «أبكي لفقدك»"],[5367,"عمية ليت وما نظرتك تقصد لسوح المنية (آهات)",11,"استديو «أبكي لفقدك» مع فارسي"],[5366,"عبرات دمعات تجري على الخدين",6,"استديو «أبكي لفقدك»"],[5365,"يا أبا عبد الله الحسين",6,"استديو «أبكي لفقدك»"],[5364,"آه يا ولدي اترجاك تظل بقربي",8,"استديو «أبكي لفقدك»"],[5363,"يا مهر الولي خالي إجيتلي",8,"استديو «أبكي لفقدك»"]]},{"id":"ghassan","n":"غسان الكربلائي","items":[[1548,"حديث يدور ما بين الكواكب عن العباس",12],[1547,"من المدينة يالجبتنا عد من بغربة عفتنا",9],[1546,"خيل وعسكر ونيران كلها إنجمعت علينا",6],[1545,"يا حيدر صدري تكسر قوم انظر لحالي",12,"استديو"],[1544,"يا طفلي يا مظلوم شنهوا اللي جنيته",13,"استديو"],[1543,"زينب وآلامي آلامي ترويها أيامي أيامي",11,"استديو"],[1542,"نور حسين ما ينطفي",9],[1541,"نورت الأكوان بدمك يا حسين",32],[1540,"حاء وسين وياء ونون أحرف معالي",36],[1539,"هذا حسين أبو السجاد",8],[1538,"بالدمع أكتب كتابي كتابي",10],[1537,"آني وانت والفاجعة عينك وعيني دامعة",23],[1536,"طفلة وتهل دمع الهضم وتنادي يا بوي",6],[1535,"ناحت صاحت ريض بهونك بالله يالحادي",12],[1534,"بالطف جفت سنيني يمك أبث ونيني",28],[1533,"يا ابن أمي انقطع قلبي",12],[1532,"أولادك تاهوا يا مسلم",9],[1531,"مسلم ضحالك يا مسلم سير بأهدافه",30],[1530,"وكل ما مرت الأجيال يا ابن الزهراء",10],[1529,"ساحات العزة تعرفنا لو حان الثار",29],[1528,"لبيك يا ثار الله",6],[1527,"طلع من خيمته القائد حبيبي",13],[1526,"رداديات",16,"مشترك_7محرم1424"],[1525,"وين أبو فاضل وينه دار الزمان علينا",16],[1524,"يا عباس شاب الراس واحتاريت",36],[1523,"علقوا الشمع يا شبان",16],[1522,"يا ابني جاسم خاللي الليلة نحني كفوفك",29],[1521,"يالمذبوح بليلة عرسك",6],[1520,"هذي دماك على فمي تتكلم",10],[1519,"نور الهدى لما بدى من ظلمة الحرب",30],[1518,"أنا أمك المفجوعة",15],[1517,"بعيون الأطياب دمع الفجيعة",33],[1516,"الوداع الوداع + رداديات",30]]},{"id":"balady","n":"عبد الأمير البلادي","items":[[5051,"انزلو أعلامكم (آهات فاطمة) (المقطع 2) + قال سليمٌ",31],[5050,"انزلو أعلامكم رحل اليوم ابو الزهراء (آهات فاطمة) (المقطع 1)",31],[5049,"ان قتلونا او تركونا فالأمر موحد (الركب الحزين)",43],[5048,"يا قتيل العداء يا حسين يا سليب الرداء يا حسين (المقطع 4)",31],[5047,"يا قتيل العداء يا حسين يا سليب الرداء يا حسين (المقطع 3)",31],[5046,"يا قتيل العداء يا حسين يا سليب الرداء يا حسين (المقطع 2)",31],[5045,"يا قتيل العداء يا حسين يا سليب الرداء يا حسين (المقطع 1)",31],[5044,"واقاسماه نظرت بعين بدا منا إجمرارُ (المقطع 4)",45],[5043,"واقاسماه نظرت بعين بدا منا إجمرارُ (المقطع 3)",45],[5042,"واقاسماه نظرت بعين بدا منا إجمرارُ (المقطع 2)",45],[5041,"واقاسماه نظرت بعين بدا منا إجمرارُ (المقطع 1)",45],[5040,"يا شمر تدري انا سبط النبي وريحانته",4,"استديو «طفلة الحسين»"],[5039,"كفلها دموع العين ما يمكن كفلها(يالفارقتني عدمن عفتني)",9,"استديو «طفلة الحسين»"],[5038,"وحني ينكبات الدهر(حنة العرس وينه)",10,"استديو «طفلة الحسين»"],[5037,"زينب يا عمة انشعب قلبي وصار شطرين",6,"استديو «طفلة الحسين» الشبل علي السعيد"],[5036,"حسين حسين حسين شيعتي نصبو المأتم والعزاء لمصيبتي",6,"استديو «طفلة الحسين»"],[5035,"طفلة المظلوم خرت فوق راسه تقبله",7,"استديو «طفلة الحسين»"],[5034,"زينب حايره الليلة بالايتام تصيح الملتجا وين",1,"استديو «يتيمة»"],[5033,"عباس يا ذخري يا غالي ما تقوم تندهلك عيالي",10,"استديو «يتيمة»"],[5032,"يا روحي يا جسام خانت بيك الأيام",7,"استديو «يتيمة»"],[5031,"هالسيف الشرق هامتك يبني",5,"استديو «يتيمة»"],[5030,"ما شفنا بعد عريس يمشي بغير زفافه",5,"استديو «يتيمة»"],[5029,"شال طفله حسين بيده يخاطب جموع العداء",5,"استديو «يتيمة»"],[5028,"زينب على ظيم الدهر صبري",6,"استديو «يتيمة»"],[5027,"دون الشبان وليدي تفصيل اكفان بيومه",7,"استديو «يتيمة»"],[5026,"يتيمة وضايعة بهالبر يعمة لا تخلوني",8,"استديو «يتيمة»"],[5025,"ليث الغاب راسه نصاب يم المشرعة",4,"استديو «الله أي دم»"],[5024,"يا ام عريس دون اعراس الورى(زفاف المنيه)",7,"استديو «الله أي دم»"],[5023,"هلا بحاديها وشايل لواها(لاهوب المنايا)",3,"استديو «الله أي دم»"],[5022,"بينت ارض الفجيعة هلت(دموع الوديع)",15,"استديو «الله أي دم»"],[5021,"الله أي دم في كربلا سفك",8,"استديو «الله أي دم»"]]},{"id":"hkadhim","n":"حسين كاظم","items":[[5312,"إلى الزيارة قاصدين إلى الزيارة",4,"استديو «زهراء الأربعين»"],[5311,"بجبال الحزن والهم انا جيتك يجدي",7,"استديو «زهراء الأربعين»"],[5310,"سلام الله عليها زهراء ام الحسن (لحن2)",9,"استديو «زهراء الأربعين»"],[5309,"رواية عن السيدة الزهراء(ع)",8,"استديو «زهراء الأربعين»"],[5308,"يلذي عندك حوائج هالمساء انخه وتوسل بأصحاب الكساء",8,"استديو «زهراء الأربعين»"],[5307,"بكتك املاك السماء يا حسين",10,"استديو «زهراء الأربعين»"],[5306,"السلام عليك يا ابا عبد الله",5,"استديو «زهراء الأربعين»"],[5305,"دادي هو إز زينب",5,"استديو «زهراء الأربعين» إنكليزي"],[5304,"يا حسين صرت اندب يا حسين",5,"استديو «أناشيد كربلاء»"],[5303,"اخي يا نور عيني يا شقيقي",3,"استديو «أناشيد كربلاء»"],[5302,"حسين حسيناه رسالة بسالة عدالة أصالة",7,"استديو «أناشيد كربلاء»"],[5301,"هذا حسين وبحر الهم محتدم",6,"استديو «أناشيد كربلاء»"],[5300,"لديارنا جينا من غير والينا",8,"استديو «أناشيد كربلاء»"],[5299,"واحسيناه شيعتي ما إن شربتم عذب ماء فاذكروني",6,"استديو «أناشيد كربلاء»"],[5298,"كربلاء كربلاء يا ارض الحسين",5,"استديو «أناشيد كربلاء»"],[5297,"يالذي همك يطول اندب الزهراء البتول",9,"استديو «نخوات 2»"],[5296,"يل تريد الحاجة من راعيها(نخوة العباس)",5,"استديو «نخوات 2»"],[5295,"نخوة يا صاحب الغيبة الفرج بإيدك تجيبة",6,"استديو «نخوات 2»"],[5294,"ارد اطب حضرة الحورا وأنتخيها",6,"استديو «نخوات 2»"],[5293,"لا تشكي للناس همك اشكي للزهرا",7,"استديو «نخوات 2»"],[5292,"توسلينا ونتخينا وبأئمتنا دعينا",12,"استديو «نخوات 2»"],[5291,"بالشدة نادوا علي حيدر يعطيني مرادي",5,"استديو «نخوات 2»"],[5290,"يا وجيهاً عند الله اشفع لنا عند الله",17,"استديو «نخوات 1»"],[5289,"ام الأئمة فاطمة بجاه الحسين ومأتمه مولاتي أنخاك",6,"استديو «نخوات 1»"],[5288,"حاجتي عندك يا بنت حيدر علي",7,"استديو «نخوات 1»"],[5287,"باب الحوائج بو الفضل وبحضرتك تشفي العلل",10,"استديو «نخوات 1»"],[5286,"انا لا اعلم كيف ام البنين (نعي) + ذائب فؤادي واطلب مرادي",8,"استديو «نخوات 1»"],[5285,"يا حسين قال المصطفى تراب قبرك فيه شفا",8,"استديو «نخوات 1»"],[5284,"حلال المشاكل حل مشاكلنا",4,"استديو «نخوات 1»"],[5283,"عباس يا عباس خوي حسين يسبوني وشمتت بينا الناس",6,"استديو «صرخة حزن»"],[5282,"جسام عمي ما تحاكيني وانت نظر عيني",5,"استديو «صرخة حزن»"],[5281,"بين المحسن والرضيع صرخت حزن نسمعها",13,"استديو «صرخة حزن»"],[5280,"يمه حسين انا الزهراء",10,"استديو «صرخة حزن»"],[5279,"عبد الله يا عبد الله يا وليدي يا عبد الله",8,"استديو «صرخة حزن»"],[5278,"دخيل يا الزهراء دخيل يالزهراء يا ستي",7,"استديو «آنين الأربعين»"],[5277,"يا ابن امي جينا نودعك",9,"استديو «آنين الأربعين»"],[5276,"فاطمة بنت الزكية",14,"استديو «آنين الأربعين»"],[5275,"مشهد في غربة الشام",9,"استديو «آنين الأربعين»"],[5274,"سلام الله عليها زهراء ام الحسن (لحن1)",5,"استديو «آنين الأربعين»"],[5273,"سابينا سابينا يا بوي الليلة سابينا",15,"استديو «آنين الأربعين»"],[5272,"راسٌ حضنته رقية صاحت ابه رد عليّ",10,"استديو «آنين الأربعين»"],[5271,"مشهد تمثيل عن رقية (ع)",6,"استديو «آنين الأربعين»"],[5270,"من طبروا الكرار قد ايتموا الأقمار",13,"استديو «وغابة الشمس»"],[5269,"علي يا عروة الوثقى",17,"استديو «وغابة الشمس»"],[5268,"لعين الأصل للجرم تأهب(ملحمة امير المؤمنين ع)",31,"استديو «وغابة الشمس»"],[5267,"اشدد حيازيمك للموت فإن الموت لاقيك",4,"استديو «أركان الهدى»"],[5266,"يا وليدا وسط بيت الله",7,"استديو «أركان الهدى»"],[5265,"هالليلة ليلة نوح ليلة احزان",8,"استديو «أركان الهدى»"],[5264,"فاض دمع الحنين يابنة الطاهرين",10,"استديو «أركان الهدى»"],[5263,"حيدر حيدر انت الدهر انت الوتر",8,"استديو «أركان الهدى»"],[5262,"آه لليل يا بوي(آه يا بويه)",10,"استديو «أركان الهدى»"],[5261,"إلهي إن كان ما ردن لعد حيدر اخذ روحي على فراقه",10,"استديو «أركان الهدى»"],[5260,"يا فاطمة-مالي وقفت على القبور مسلماً(نثر)",10,"استديو «مكسورة الضلع»"],[5259,"وينك يا حامي الحمه تنادي فاطمة بجمرة دمعها",6,"استديو «مكسورة الضلع»"],[5258,"قال النبي فداك ابوك يا زهرا يا زهرا",3,"استديو «مكسورة الضلع»"],[5257,"ضلع هشيم والحمل مطروح",9,"استديو «مكسورة الضلع»"],[5256,"سيدتي يا زهراء(نثر)",2,"استديو «مكسورة الضلع»"],[5255,"جوهرة القدس من الكنز الخفي",11,"استديو «مكسورة الضلع»"],[5254,"ايا مسكورة الضلع سيبقى جاريا دمعي",13,"استديو «مكسورة الضلع»"]]},{"id":"hamadi","n":"علي حمادي","items":[[5162,"حبيبي يا حسين (2) + يا أمير المؤمنين هزت الأهل شجون + يا هلا الحزن",19],[5161,"هلال الحزن والهم والقهر- حبيبي يا حسين يميزان العدالة (1)",31],[5160,"ماجورة يا زينب بفقد علي الأكبر",23],[5159,"شردوها من المدينة + حزينة من ردت للدار بعد الجرى وصار",43],[5158,"لا انسى إبن فاطم والعداء (نعي) + اريد اطفي الجمر (الركب الحزين)",46],[5157,"أجنني حب الحسين فداء عيني واليدين",15,"الأربعين1427هـ"],[5156,"يلتركتوني غريبة أجرع آلام المصيبة هم وآلام سفرة الشام",31,"الأربعين1427هـ"],[5155,"عرج بنا لكربلاء عرج بنا يا حادينا للمنقطع نحرا",14,"الأربعين1427هـ"],[5154,"فداءٌ لمثواك من مضجعِ تنور بالأبلج الأروع",11,"الأربعين1427هـ"],[5153,"هذه روضة أحزاني كربلاء هذه الخطفة إخواني (نعي)",2,"الأربعين1427هـ"],[5152,"يلي على الغبرة (نعي) + ماي الشط قال + جمرة الحنين من دم الحسين",45],[5151,"انصارٌ كحبيب ابن مظاهر وزهير ابن القين (3)",31],[5150,"انصارٌ كحبيب ابن مظاهر وزهير ابن القين (2)",46],[5149,"انصارٌ كحبيب ابن مظاهر وزهير ابن القين (1)",46],[5148,"واذبيحاً من قفاه (نعي) + يحيدر ما حضرت مسلم + إن كان دين محمد",54],[5147,"انت روحي وانيني يا قطيع الودجين (2) + هلال شهر الحزن من وافانا",23],[5146,"بأبي انت وامي يا حسين + انت روحي وانيني يا قطيع الودجين (1)",31],[5145,"يا ابن أمي الخيم يحسين محروقه (نعي) + يا ابن امي الوفى شيمه",39],[5144,"النصر آتٍ من زينبَ الصبر والثبات الله اكبر يا جند خيبر (2)",11],[5143,"النصر آتٍ من زينبَ الصبر والثبات الله اكبر يا جند خيبر (1)",11],[5142,"ايا رسول الأمه مظلومة محرومه مظلومة يا جداه",9],[5141,"يا ام البنين نوح وانين في فقد مقطوع الوتين (2)",22],[5140,"يا ام البنين نوح وانين في فقد مقطوع الوتين (1)",25],[5139,"قسما بالضلوع سوف نبكي وننادي لعن الله الأعادي",91],[5138,"حسنيون حسينيون بالولاء والوفاء",100],[5137,"قد اقسمنا بالعباس حتى يوم المحشر ان نحيا احرار",126,"السابع من محرم"],[5136,"على خيام الحرم يا حسين هجمت خيل أبن سفيان",52,"ليلة 10 محرم"],[5135,"قم ناشد الإسلام في مصابه (نعي) + أسمع يا حيدر صرختنا",36],[5134,"يتامى وما تراعونا يتامى احنى وتذبحونا",79],[5133,"امسه المساء والنار ما خلت لنا خيام (اقبل علي الليل وازدادت الوحشه)",92],[5132,"اشتكي بهالحاله (نعي) + عظم الله لكي الأجر بالجواد اه يا زهراء",40],[5131,"شيعو بالحزن نعش زينب شيعو الصرح الممرد علي ومحمد (2)",30],[5130,"شيعو بالحزن نعش زينب شيعو الصرح الممرد علي ومحمد (1)",30],[5129,"جمرة الحنين من دم الحسين اشعللتها بالفداء زينب",26],[5128,"يا قتيل العداء يا حسين يا سليب الرداء يا حسين (المقطع 4)",31],[5127,"يا قتيل العداء يا حسين يا سليب الرداء يا حسين (المقطع 3)",31],[5126,"يا قتيل العداء يا حسين يا سليب الرداء يا حسين (المقطع 2)",31],[5125,"يا قتيل العداء يا حسين يا سليب الرداء يا حسين (المقطع 1)",31]]},{"id":"abdalreda","n":"عبد الرضا النجفي","items":[[1607,"زينب الليلة تحرس العيلة",21],[1606,"زينب يا غريبة الله اشمصيبة",24],[1605,"يا حيدر ما تدري اشصار يا بوي",33],[1604,"بيّن أسراره واضح شعاره",25],[1603,"من راح أخونا",11],[1602,"وقفت زينب عالتل تندب",4],[1601,"يا خوي يا حسين",21],[1600,"تدري يا ابو السبطين حرقوا خيمنا",17],[1599,"سلّبونا روّعونا سلّبونا روّعونا",22],[1598,"الله ليل أحزاني الله يا ولياني",26],[1597,"انقلبت الناس علينا غايتها تغدر بينا",29],[1596,"أطفال ونساوين ظلت يا ابو حسين",22],[1595,"يا علي يا أبا الحسن",3],[1594,"الليلة شفت الدار وحشة ومظلمة",2],[1593,"تنتظرك يا عباس هالعيلة بضماها",10],[1592,"يا عباس إصبر على هذا الخبر",2],[1591,"قوم يا حامي الجار قوم حامينا",15],[1590,"والينا وينه مين يحامينا وينك يا حامي الجار",16],[1589,"يا بوي انهضمنا من ذبحوا زلمنا",19],[1588,"زينب تنادي من يظل يمها",29],[1587,"صرخة وتوحد بشر خل يسمعوها",9],[1586,"روح طيبة معانيها تعرف الحسن راعيها",28],[1585,"ذاب الحسن قلبه",19],[1584,"ليش هالوادم صارت علينا",24],[1583,"حسين ما يخفاك بالطف حاله",16],[1582,"من راح أخونا واللي ياويلونا",12],[1581,"خانوا بمسلم وين العهد صار",15],[1580,"الله شهاليوم علينا",16],[1579,"يا حسين الخيم يا حسين",4],[1578,"وين عني اليتامى والحرم",18]]},{"id":"jdarazi","n":"جعفر الدرازي","items":[[3976,"دم عاشوراء فيك يا حوراء جمرتٌ مشتعلة",45,"« ثأر الله الأعظم »،مشترك مع صالح"],[1577,"أتاني في المنام فرصت في هيام",9],[1576,"الحسين شمعة لا تنطفي تنير الثائرين",2,"استديو"],[1575,"الركب يمضي بإسم الإمام ينعى عليا",9,"استديو"],[1574,"طفلي من العطش ظمآن + الله وياك يا ابني",6,"استديو"],[1573,"إننا نشتكي من غربة يا أبا الفضل املأ القربة",31],[1572,"تبكيك عيني كيف لا تبكيك عين",8,"استديو"],[1571,"دم عاشوراء فيك يا حوراء",24,"استديو"],[1570,"زينب أنشودة الثائر حطمت مناوئ الجائر",10,"استديو"],[1569,"إنه محرم يا ولدي",4,"استديو"],[1568,"عباس إنت اللي جبتي وقوم ردني للوطن",7,"استديو"],[1567,"غايتي منيتي أوصلك يا حسين",4,"استديو"],[1566,"قالت زينب لإبن زياد لن نركع إلا لله",5,"استديو"],[1565,"لا الصوت يرهبني ولا طاغوت حزبك",2,"استديو"],[1564,"لا لا تقل أنك حزت الفخر يا طاغوت",2,"استديو"],[1563,"لعن الله الذين أسروك يا علي",17,"استديو"],[1562,"مأساتي مأساة الشريعة آلامي تبقى",3,"استديو"],[1561,"نداء من حسين الدم يصيح بالعباد",7,"استديو"],[1560,"ما أسولف لك على قلبي اشتحمل",9,"استديو"],[1559,"يا أهل الخيم جاكم علي قوموا له",3,"استديو"],[1558,"يا حسين بايع اليوم يزيد",3,"استديو"],[1557,"يا لهيباً يشعل الثورة يا زينب",5,"استديو"],[1556,"يوم المآسي عاد إلينا",9,"استديو"],[1555,"بعدها مصبيتك عندي يا بوي وهجموا الدار",3,"استديو"],[1554,"بين المآسي عادت الذكرى فإستقبلينا كربلا",13],[1553,"خيموا إن هذي كربلاء",13],[1552,"دم تفجر للإسلام يثأر بنداء الله أكبر",9,"استديو"],[1551,"عين زينب ما تنام بالغاضرية + تبت يد",5,"استديو"],[1550,"قالوا من ذا قلت حيدري + نذوب في الولاء",8],[1549,"كربلا ضمي الشهادة قدمي دماءها قربان",30]]},{"id":"sahwan","n":"جعفر سهوان","items":[[5337,"بين الغريب واخته الغريبة (ضرجوك بالسيوف)",85],[5336,"نعي+ ارق دمعي على السبط المطهر (2)",31],[5335,"نعي+ ارق دمعي على السبط المطهر (1)",31],[5334,"سيرحل للسماء شهيدا في الدماء (2)",23],[5333,"سيرحل للسماء شهيدا في الدماء (1)",30],[5332,"حسين يا حسين خيم الحزن عليها",10],[5331,"من أراضي الرزايا",3],[5330,"صرختي دوت يا سبط القيادة علم الشيعة قاموس الشهادة",49],[5329,"يا مفضوخ الهام تنعاك الأيتام",6],[5328,"قد صنعت عاشوراء بالرجل الحسيني والمرأه الزينبيه",20],[5327,"قد خيم الحزن والآهات",19],[5326,"يا دمائي كبري زلزلي المستكبرين",15],[5325,"بينما الركب يسر حومت عين الحسين",10],[5324,"من مكة خرج الضعن الحسيني",17],[5323,"يا حسين السماء قد بكتك دماء",44],[5322,"مذ اسقطوا راس الحسين يا امنا زينب (2)",23,"مع عبد الشهيد الثور"],[5321,"مذ اسقطوا راس الحسين يا امنا زينب (1)",32,"مع عبد الشهيد الثور"],[5320,"الأنصار الأنصار يوم الثار تطلق بركان الحرية (2)",23],[5319,"الأنصار الأنصار يوم الثار تطلق بركان الحرية (1)",28],[5318,"قسما بالمصاب الفاطمي الفضيع (2)",10],[5317,"قسما بالمصاب الفاطمي الفضيع (1)",25],[5316,"أروي الرزايا لمن للجرح ام للكفن (2)",4],[5315,"أروي الرزايا لمن للجرح ام للكفن (1)",24],[5314,"ماجت الأرض بدمع الثقلين",25],[5313,"يا محمد يا صراط الإستقامة",25]]},{"id":"hujayrat","n":"محمد الحجيرات","items":[[5362,"يا عباس جيب الماي لسكينة(يا أبا الفضل)",8,"استديو «وجه الصباح»"],[5361,"ام حسبت ان اصحاب الكهف(راس من فوق القنا)",7,"استديو «وجه الصباح»"],[5360,"وجه الصباح علي ليلٌ مظلم",10,"استديو «وجه الصباح»"],[5359,"وداعاً قد دنى صبح الرزايا",15,"استديو «وجه الصباح»"],[5358,"يا عمي نجمعت الظلام كلها بكربلا ضدك(نعي)",3,"استديو «وجه الصباح»"],[5357,"انا حبيب وحبيب ظاهر(يا مهجة الزهراء)",11,"استديو «وجه الصباح»"],[5356,"لا ليلي ليل الناس لا تغمض العين(ليلى تنادي)",6,"استديو «تراث عاشوراء»"],[5355,"زينب حشمت عباس وتنادي يا ابن حيدر",7,"استديو «تراث عاشوراء»"],[5354,"يا محلا الوداع بهالمسيه",11,"استديو «تراث عاشوراء»"],[5353,"يحسين اخبرك من طحت على الغبره",10,"استديو «تراث عاشوراء»"],[5352,"قلي يالميمون وين والينا",6,"استديو «تراث عاشوراء»"],[5351,"نار ابدليلي تسعر ما تنطفي يا الأكبر",10,"استديو «تراث عاشوراء»"],[5350,"يمه ذكريني من تمر زفة شباب",8,"استديو «تراث عاشوراء»"],[5349,"يحسين بضمايرنا صحنا بيك آمنا",12,"استديو «تراث عاشوراء»"],[5348,"في كل زمان صرخات(اين الطالب بالثارات)",6,"استديو «المسبيات»"],[5347,"وينك يا شيال العلم يلي كفلتني",7,"استديو «المسبيات»"],[5346,"يوليدي يا مذبوح عبد الله",10,"استديو «المسبيات»"],[5345,"يبني يا جاسم انا امك عنك امشي ميسره",9,"استديو «المسبيات»"],[5344,"جينه ننشد كربلاء مضيعينها",8,"استديو «المسبيات»"],[5343,"خدر وأيتام بغربتنا من يسمع بالطف صرختنا",7,"استديو «المسبيات»"],[5342,"يا مولاتي يا فاطمة اغيثيني اغيثيني",5,"استديو «بنت الهدى2» مع علي شبر"],[5341,"بويه يا حيدر نخيتك تحضر الساعة رجيتك سقطوني",6,"استديو «بنت الهدى2» مع علي شبر"],[5340,"صبت علي مصائبأ لو أنها",10,"استديو «بنت الهدى2» مع علي شبر"],[5339,"زهراء ضلعك تكسر لو ضلعي",12,"استديو «بنت الهدى2» مع علي شبر"],[5338,"لا تلومونا على حب البتول",9,"استديو «بنت الهدى2» مع علي شبر"]]},{"id":"adheed","n":"علي العضيد","items":[[5124,"قسما بالشفع وبالوتر والفجر وليال عشر اسقي الأطفال",6],[5123,"اليوم مات جدي الرسول اليوم ماتت امي البتول",13],[5122,"الوداع الوداع يا ابن امي الوداع",6],[5121,"يالأكبر بسمك صحت يالأكبر",2],[5120,"حالة ابحزن ننظرها ونقارن مصادرها",11],[5119,"جسام آنا أمك يبني جسام داقعد جاوبني",13],[5118,"آنا ام البنين وعهدي وفيته (قراءة 2)",4],[5117,"بجاه النبي وفاطمة وعلي اتمنه ترجع يحسين إلي",16],[5116,"أنصار إلك والتاريخ يشهد علينا",17],[5115,"آنا ام البنين وعهدي وفيته (قراءة 1)",6],[5114,"محرابك لو بابك ننشدها على صوابك(يا حيدر بغيابك)",10],[5113,"رحال أم الحزن ما وقف بالسيف(علي مولى يا كرار)",5],[5112,"آه عليك يالمرتضى",3],[5111,"شمس وأقمار إجت ثوار بني عمك",17],[5110,"تناغيني تسليني يا عبد الله يا عبد الله",6],[5109,"يوم الطف صاحت زينب اللهم تقبل يا رب 2",3],[5108,"يوم الطف صاحت زينب اللهم تقبل يا رب 1",9],[5107,"يا عبد الله القلب مقطوع سباحة",3],[5106,"حين طاح الأكبر وبدره اختفى",2],[5105,"جري دمك مثل دمي يالأكبر 2",7],[5104,"جري دمك مثل دمي يالأكبر 1",9],[5103,"إجري العبرة أذكر مسلم وإجري العبرة",7],[5102,"يا شباني انهدم حيلي",12],[5101,"هاي ام البنين الطاهرة الحرة",6],[5100,"يا دار اهلك عافوني يا دار بالهم خلوني",10]]},{"id":"rumi","n":"يوسف الرومي","items":[[5679,"وزجو فيك فلسفةً من التفريق والمكر (علي أيها البركان4)",30],[5678,"وإن جلست تقول علي (علي أيها الركان3)",30],[5677,"ولأن الجبهة ناصعتٌ قد هب السيف إلى التقبيل (علي أيها البركان2)",30],[5676,"صباح محمد وحسين والزهراء والحسن (علي أيها البركان1)",30],[5675,"يا شيخ الأنصار اقدم للأحرار علمهم كيف يثور الدم (2)",45],[5674,"يا شيخ الأنصار اقدم للأحرار علمهم كيف يثور الدم (1)",39],[5673,"عاد ركب الحزن يوم الأربعين بالسبايا واليتامى (2)",36],[5672,"عاد ركب الحزن يوم الأربعين بالسبايا واليتامى (1)",44],[5671,"هود الليل بسكونه ينزع الآلام (محراب حيدر بالفجر كبر2)",27],[5670,"اسمعُ الورقاء تشدو حبك حيدر (محراب حيدر بالفجر كبر1)",41],[5669,"رتلي أيام عاشوراء صرخات زينبية من نحور فاطمية (2)",22],[5668,"رتلي أيام عاشوراء صرخات زينبية من نحور فاطمية (1)",20],[5667,"يا كربلاء زين العباد فيك دمعاً بإتقاد",46],[5666,"قد اتاكِ خبر المصير فاعقدي العزم على المسير (2)",25],[5665,"قد اتاكِ خبر المصير فاعقدي العزم على المسير (1)",19],[5664,"وازينباه صرخة وازينباه ضمي جروحي بين الضريح (2)",31],[5663,"وازينباه صرخة وازينباه ضمي جروحي بين الضريح (1)",27],[5662,"أيها السائل عن ركب الحسين يمضي إلى أين كربلاء ستجيب",41],[5661,"هلي يا دموعي وواسي فاطمة (نعي) + السلام على زينب الصابرة",39],[5660,"يكفي يا زينب ترحال من مآسي إلى أهوال+هوسات",43],[5659,"ترجل مهر عباس فضم النهر واشتمله",33],[5658,"لا تسأل عن يمنى العباس عن يسراه عن جرح الراس (2)",43],[5657,"لا تسأل عن يمنى العباس عن يسراه عن جرح الراس (1)",44]]},{"id":"hasanisa","n":"حسن عيسى","items":[[5253,"يا قبور الشهداء لك جئنا",7],[5252,"من انا حتى تسلم علي زينب",25],[5251,"ذكرى الطف اورى في قلب الرزايا",3],[5250,"ارحل بحزبك يا يزيد فكلنا جند الشهيد",12],[5249,"يا دموعي للخبايا ترجمي اقصوصة الأحزان",3],[5248,"فاز بالجنة من والاكم وهوى في النار من عاداكم",14],[5247,"آت لكم يا قبور الآل إلى الزيارة",8],[5246,"الأكبر وقع وين يا فجعة حسين",23],[5245,"يا ليلة الرزايا يا ليلة المنايا",35],[5244,"تبكيك عيني بما بليت يا أخي",28],[5243,"ما خاب من والاكم متقربا 2",30],[5242,"ما خاب من والاكم متقربا 1",21],[5241,"جاءنا ناعي ليل الأسى للإمام الشهيد",6],[5240,"ضاقت علي الوسيعة واطلب الرخصة عمي يا حسين 3",10],[5239,"ضاقت علي الوسيعة واطلب الرخصة عمي يا حسين 2",25],[5238,"ضاقت علي الوسيعة واطلب الرخصة عمي يا حسين 1",18],[5237,"وين يا حسين تروح عني لتغيب يا بعد الورح",22],[5236,"ليلة حزن ما هي ليلة اعراس 2",5],[5235,"ليلة حزن ما هي ليلة اعراس 1",40],[5234,"ناحت الأحباب لك يا داحي الباب 2",12],[5233,"ناحت الأحباب لك يا داحي الباب 1",24],[5232,"كرمكم ربي بالشهادة والقتل للأحرار عاده",38]]},{"id":"mumin","n":"صالح المؤمن","items":[[5440,"يا حسين يالإسمك لحن عشق (أغلا من الروح)",10,"استديو «يا قتيل العبرات»"],[5439,"عبد الله تشاوينه ما أسمع ونينه",8,"استديو «يا قتيل العبرات»"],[5438,"يا وليدي شنه جرى خبرني يبني اشصار (آهات محمد)",11,"استديو «يا قتيل العبرات»"],[5437,"يا قتيل العبرات انت عزم وثبات",11,"استديو «يا قتيل العبرات»"],[5436,"طولي يا ليلة الوحشة وزيدي بصوابك علي (إجيتك)",11,"استديو «يا قتيل العبرات»"],[5435,"تركت الخلق طرا في هواك (إلهي)",5,"استديو «يا قتيل العبرات»"],[5434,"من طوحو عني الظعن (حن يالأبو)",9,"استديو «إلك دمعة»"],[5433,"يا رضيعي انحب عليك وانوح",9,"استديو «إلك دمعة»"],[5432,"بعد شأترجة من بعدك (اسمع عتابي) (نثر)",8,"استديو «إلك دمعة»"],[5431,"كعبة الوفاد انت يا حسين",6,"استديو «إلك دمعة»"],[5430,"آه يابني يا تعب عمري وربايه غربتني",6,"استديو «إلك دمعة»"],[5429,"عافوني خلاني بالدمعة والنوح",6,"استديو «إلك دمعة»"],[5428,"اسد على فلك وفي يده مريخ قاني الون محمر",8,"استديو «إلك دمعة»"],[5427,"يا حسين وياك انا من الذر يا مظلوم لا تنساني يوم المحشر",5,"استديو «آلام الحسين»"],[5426,"يا قلب يتحمل آلم طيف الحبايب عن عينه غايب",10,"استديو «آلام الحسين»"],[5425,"محبوبي يلي مسافر",8,"استديو «آلام الحسين»"],[5424,"عين حسين بآخر نظرة (ملاك الآلام)",10,"استديو «آلام الحسين»"],[5423,"ابا الفضل عباس إجيتك للنهر شكايه",12,"استديو «آلام الحسين»"],[5422,"حيرني الدهر بحسين وعلي ثقل همي",14,"استديو «آلام الحسين»"],[5421,"صنوان راسك فوق الرمح و القمر",7,"استديو «آلام الحسين»"]]},{"id":"qashqash","n":"نصرات قشاقش","items":[[5784,"وين السيف اليقطع راس الكفر بحده ، حيدر وينه حيدر وينه",2,"استديو"],[5783,"أنت الشمس وضحاها والليل إذا يغشاها",9],[5782,"يا أمير المؤمنين الكون ضجّ حينما السيف بنافوخك لجّ",4],[1621,"إنني بنت طه الأمين ، أسقط القوم مني جنيني",15],[1620,"يا شهيداً صاغ للمجد شعارا",12],[1619,"يا ريح الهاب وياك وديني",14],[1618,"يا حسين بضمايرنا وصحنا بيك آمنا",3],[1617,"وانطفت شمعة جسام",10],[1616,"أمك أنا يا حسين طفلك وين دليني",2],[1615,"علي علي أنت عماد الدين",9],[1614,"بايعناك يا إمامي - يا صانع المجد",6],[1613,"أيها الراجي نجاة في غدٍ بل كل حين",3,"استديو"],[1612,"رحم الله من هلّ الدمع على حسين",4,"استديو"],[1611,"عهدا منا حتى الموت لا لن نوالي غير حيدر",5,"استديو"],[1610,"في أرضك يا طفوف",7,"استديو"],[1609,"زينب يا غريبة الله اشمصيبة",7,"استديو"],[1608,"يمه ذكريني من تمر زفة شباب",1,"استديو"]]}]);
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
  function latItems(r) { return r.items; }
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
      var back = el("button", "chip", "← الرواديد"); back.onclick = function () { st.r = null; draw(); }; box.appendChild(back);
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
