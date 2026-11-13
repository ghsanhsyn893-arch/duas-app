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

  function validData(d) {
    if (!d || typeof d.version !== "number" || !d.items || !Array.isArray(d.categories)) return false;
    return d.categories.every(function (c) {
      return c && c.id && Array.isArray(c.keys) && c.keys.every(function (k) {
        return d.items[k] && typeof d.items[k].text === "string";
      });
    });
  }
  function applyData(d) {
    DATA = d; ITEMS = d.items; CATS = d.categories; BOOKS = d.books || []; VERSION = d.version; OCC = d.occasions || []; MS = parseStarts(d.month_starts);
  }
  // آخر نسخة محفوظة من الإنترنت (إن كانت أحدث من المدمجة)
  try {
    var cached = JSON.parse(localStorage.getItem("remoteData") || "null");
    if (validData(cached) && cached.version > VERSION) applyData(cached);
  } catch (e) {}

  /* ---------------- تخزين الإعدادات ---------------- */
  var DEFAULTS = {
    theme: "auto",
    fs: 22,
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
      .replace(/[ً-ٰٟۖ-ۭـ]/g, "")
      .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
      .toLowerCase();
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
  buildIndex();

  function applyTheme() {
    var t = cfg.theme;
    if (t === "auto") {
      t = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-theme", t);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", t === "dark" ? "#0b2a20" : "#0f3d2e");
  }
  function applyFont() {
    document.documentElement.style.setProperty("--fs", cfg.fs + "px");
  }

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
    else if (v.type === "listen") renderListen(v);
    else if (v.type === "cal") renderCal();
    updateTabs();
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
    var v = stack[stack.length - 1], show = ["home", "lib", "listen", "favs", "cal", "tasbih", "hifz"].indexOf(v.type) >= 0;
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
  function splitMode() { try { return parseInt(localStorage.getItem("splitMode") || "0", 10) || 0; } catch (e) { return 0; } }
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
    try { var c = JSON.parse(localStorage.getItem("recs") || "null"); if (c && c.length) { recCache = c; return Promise.resolve(c); } } catch (e) {}
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
  function nativeHold(on) { try { if (window.NativeAudio && NativeAudio.hold) NativeAudio.hold(!!on); } catch (e) {} }
  function ensurePlayer() {
    if (PL.a) return;
    var a = document.createElement("audio"); a.preload = "auto"; a.style.display = "none"; document.body.appendChild(a); PL.a = a;
    var bar = el("div", "gplayer"); bar.hidden = true;
    var thumb = el("img", "gp-img"); thumb.alt = ""; coverSrc(thumb, "quran");
    PL.t = el("div", "gp-t");
    var prog = el("i", "gp-prog"); var pbox = el("span", "gp-pb"); pbox.appendChild(prog);
    var pp = el("button", "gp-b", "▶"), x = el("button", "gp-b gp-x", "✕");
    pp.onclick = function (e) { e.stopPropagation(); if (a.paused) a.play(); else a.pause(); };
    x.onclick = function (e) { e.stopPropagation(); a.pause(); a.removeAttribute("src"); a.load(); bar.hidden = true; nativeHold(false); closeNP(); };
    bar.onclick = function () { openNP(); };
    PL.pp = pp; PL.prog = prog;
    a.ontimeupdate = function () { syncNP(); };
    a.onplay = function () { nativeHold(true); syncNP(); };
    a.onpause = function () { nativeHold(false); syncNP(); };
    a.onended = function () { nativeHold(false); if (PL.next) PL.next(); };
    a.onloadedmetadata = function () { syncNP(); };
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
  function renderListen(v) {
    titleEl.textContent = "🎧 الاستماع للقرآن";
    var st = { rec: null, m: null };
    var q = el("input", "search"); q.type = "search"; q.placeholder = "ابحث عن قارئ: عبد الباسط، الحصري، المنشاوي...";
    try { q.value = localStorage.getItem("lastrec") || ""; } catch (e) {}
    var box = el("div"); viewEl.appendChild(q); viewEl.appendChild(box);
    function play(n, blobUrl) {
      var src = blobUrl || (st.m.s.replace(/\/?$/, "/") + pad3(n) + ".mp3");
      var rec = st.rec, m = st.m;
      playerLoad({
        src: src, title: "سورة " + (SURAHS[n - 1] || n), artist: rec.name,
        next: function () { var k = m.l.indexOf(n); if (k >= 0 && k + 1 < m.l.length) loadSurahOf(rec, m, m.l[k + 1]); },
        prev: function () { var k = m.l.indexOf(n); if (k > 0) loadSurahOf(rec, m, m.l[k - 1]); }
      });
    }
    function loadSurahOf(rec, m, n) {
      audGet(rec.id, m.id, n).then(function (bl) {
        var src = bl ? URL.createObjectURL(bl) : m.s.replace(/\/?$/, "/") + pad3(n) + ".mp3";
        playerLoad({
          src: src, title: "سورة " + (SURAHS[n - 1] || n), artist: rec.name,
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
          fetch(st.m.s.replace(/\/?$/, "/") + pad3(n) + ".mp3").then(function (r) {
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
    var fs = hijriFromStarts(date); if (fs) return fs;
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
  function renderTasbih() {
    titleEl.textContent = "المسبحة";
    var S = tsGet();
    if (!TSB[S.m] || !TSB[S.m].seq[S.st]) { S = { m: 0, st: 0, c: 0, tot: S.tot || 0 }; }
    var box = el("div", "tsb");
    var sel = el("select", "tsel");
    TSB.forEach(function (t, i) { var o = el("option", null, t.n); o.value = i; if (i === S.m) o.selected = true; sel.appendChild(o); });
    box.appendChild(sel);
    var name = el("div", "tname", "");
    var cnt = el("button", "tbtn", "0");
    var goal = el("div", "tgoal", "");
    var tot = el("div", "tgoal", "");
    var row = el("div", "reader-tools");
    var rs = el("button", "chip", "↺ تصفير");
    var vb = el("button", "chip", "");
    row.appendChild(rs); row.appendChild(vb);
    [sel, name, cnt, goal, tot, row].forEach(function (x) { box.appendChild(x); });
    viewEl.appendChild(box);
    var vibOn = true;
    try { vibOn = localStorage.getItem("tsvib") !== "0"; } catch (e) {}
    function buzz(ms) { if (vibOn && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} } }
    function paint() {
      var t = TSB[S.m], q = t.seq[S.st];
      name.textContent = q[0] || "";
      cnt.textContent = S.c;
      goal.textContent = q[1] ? ("الهدف: " + q[1] + (t.seq.length > 1 ? " — المرحلة " + (S.st + 1) + " من " + t.seq.length : "")) : "";
      tot.textContent = "المجموع الكلي: " + S.tot;
      vb.textContent = vibOn ? "📳 الاهتزاز: يعمل" : "🔇 الاهتزاز: متوقف";
      tsSet(S);
    }
    cnt.onclick = function () {
      var q = TSB[S.m].seq[S.st];
      S.c++; S.tot++;
      if (q[1] && S.c >= q[1]) {
        buzz([120, 60, 120]);
        if (S.st < TSB[S.m].seq.length - 1) { S.st++; S.c = 0; toast("المرحلة التالية: " + TSB[S.m].seq[S.st][0]); }
        else { toast("اكتمل التسبيح ✓"); S.c = 0; S.st = 0; }
      } else buzz(15);
      paint();
    };
    sel.onchange = function () { S.m = +sel.value; S.st = 0; S.c = 0; paint(); };
    rs.onclick = function () { S.c = 0; S.st = 0; paint(); };
    vb.onclick = function () { vibOn = !vibOn; try { localStorage.setItem("tsvib", vibOn ? "1" : "0"); } catch (e) {} paint(); };
    paint();
  }

  /* ---------------- الرئيسية ---------------- */
  function renderHome() {
    titleEl.textContent = "أدعية وزيارات";
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
        var keys = Object.keys(ITEMS).filter(function (k) { return INDEX[k].indexOf(q) !== -1; });
        var bh = BINDEX.filter(function (x) { return x.n.indexOf(q) !== -1; }).slice(0, 30);
        var bks = BOOKS.filter(function (b) {
          return norm(b.title + " " + (b.author || "") + " " + (b.desc || "")).indexOf(q) !== -1 ||
            (b.volumes || []).some(function (v) { return norm(v.title || "").indexOf(q) !== -1; });
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
      if (last) {
        var rb = el("button", "resume");
        rb.appendChild(el("span", "rt", "📖 تابع القراءة"));
        rb.appendChild(el("span", "rn", last.book.title));
        rb.appendChild(el("span", "rp", last.chTitle + (last.pct ? " — " + last.pct + "%" : "")));
        rb.onclick = function () { openBook(last.book.id); };
        box.appendChild(rb);
      }
      var dks = Object.keys(ITEMS);
      if (dks.length && !last) {
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
      ab.appendChild(el("span", "nm", "الاستماع للقرآن"));
      ab.appendChild(el("span", "ct", "تلاوات القرّاء"));
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
    b.appendChild(el("span", "ibadge", "❖"));
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
    [plus, minus, cp, sh, im, favChip("items", v.key)].forEach(function (b) { tools.appendChild(b); });
    viewEl.appendChild(tools);

    var paper = el("article", "paper");
    paper.appendChild(el("h2", null, it.title));
    paper.appendChild(el("div", "text", it.text));
    if (it.source) paper.appendChild(el("div", "source", "📚 المصدر: " + it.source));
    viewEl.appendChild(paper);
  }


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
      return { book: best.book, chTitle: vv.title + " – صفحة " + i2p(vv, best.p.ch || 0), pct: best.p.pct || 0 };
    }
    var i = Math.min(best.p.ch || 0, best.book.chapters.length - 1);
    return { book: best.book, chTitle: best.book.chapters[i].title, pct: best.p.pct || 0 };
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
    else if (p && p.pct) box.appendChild(el("span", "bp", "تمت قراءة " + p.pct + "%"));
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
    if (book.packBase) urls.push(book.packBase.replace(/\/?$/, "/") + part.f);
    urls.push(BASE + part.f);
    var P = window.Capacitor && window.Capacitor.Plugins || {};
    function viaFetch(u) {
      var mine = 0;
      return fetch(u).then(function (r) {
        if (!r.ok) throw new Error("http " + r.status);
        if (!r.body || !r.body.getReader) {
          return r.arrayBuffer().then(function (ab) { mine += ab.byteLength; add(ab.byteLength); return [new Blob([ab])]; });
        }
        var rd = r.body.getReader(), chunks = [];
        function pump() {
          return rd.read().then(function (x) {
            if (x.done) return chunks;
            chunks.push(x.value); mine += x.value.length; add(x.value.length);
            return pump();
          });
        }
        return pump();
      }).catch(function (e) { undo(mine); throw e; });
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
    [zo, zi, idxb, star, aib, spb, pageLbl].forEach(function (b) { tools.appendChild(b); });
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
    var rng = document.createElement("input");
    rng.type = "range"; rng.min = 16; rng.max = 40; rng.step = 2; rng.value = cfg.fs;
    rng.oninput = function () { cfg.fs = +rng.value; applyFont(); saveCfg(); };
    look.appendChild(row("حجم خط القراءة", null, rng));
    viewEl.appendChild(look);

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

  var scheduling = false;
  async function scheduleAll(askPermission) {
    if (!native()) {
      if (askPermission) toast("التذكيرات تعمل داخل تطبيق الأندرويد");
      return;
    }
    var ln = LN();
    if (!ln || scheduling) return;
    scheduling = true;
    try {
      var perm = await ln.checkPermissions();
      if (perm.display !== "granted") {
        perm = await ln.requestPermissions();
      }
      if (perm.display !== "granted") {
        if (askPermission) toast("فعّل إذن الإشعارات من إعدادات الهاتف");
        scheduling = false;
        return;
      }

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
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
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
