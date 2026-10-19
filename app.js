(function () {
  "use strict";

  var REMOTE_URL = "https://raw.githubusercontent.com/ghsanhsyn893-arch/duas-app/main/data.json";
  var DATA = window.DATA;
  var ITEMS = DATA.items;
  var CATS = DATA.categories;
  var BOOKS = DATA.books || [];
  var VERSION = DATA.version || 1;

  function validData(d) {
    if (!d || typeof d.version !== "number" || !d.items || !Array.isArray(d.categories)) return false;
    return d.categories.every(function (c) {
      return c && c.id && Array.isArray(c.keys) && c.keys.every(function (k) {
        return d.items[k] && typeof d.items[k].text === "string";
      });
    });
  }
  function applyData(d) {
    DATA = d; ITEMS = d.items; CATS = d.categories; BOOKS = d.books || []; VERSION = d.version;
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
      b.chapters.forEach(function (c, i) {
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

  /* ---------------- التنقل ---------------- */
  var stack = [{ type: "home" }];
  var query = "";

  function go(v) {
    if (stack[stack.length - 1].type === "book") savePos();
    stack.push(v); render(); window.scrollTo(0, 0);
  }
  function goBack() {
    if (sheetEl) { closeSheet(); return true; }
    if (stack.length > 1) {
      if (stack[stack.length - 1].type === "book") savePos();
      stack.pop(); render(); return true;
    }
    return false;
  }

  function render() {
    var v = stack[stack.length - 1];
    viewEl.textContent = "";
    btnBack.hidden = stack.length <= 1;
    if (v.type === "home") renderHome();
    else if (v.type === "cat") renderCat(v);
    else if (v.type === "item") renderItem(v);
    else if (v.type === "settings") renderSettings();
    else if (v.type === "lib") renderLib();
    else if (v.type === "book") renderBook(v);
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
        if (!keys.length && !bh.length) { box.appendChild(el("div", "empty", "ما لقينا نتيجة")); return; }
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
        rb.onclick = function () { go({ type: "book", id: last.book.id }); };
        box.appendChild(rb);
      }
      box.appendChild(el("div", "hello", "اختر القسم"));
      var grid = el("div", "grid");
      CATS.forEach(function (c) {
        var b = el("button", "cat");
        b.appendChild(el("span", "ic", c.icon));
        b.appendChild(el("span", "nm", c.name));
        b.appendChild(el("span", "ct", c.keys.length + " عنوان"));
        b.onclick = function () { go({ type: "cat", id: c.id }); };
        grid.appendChild(b);
      });
      if (BOOKS.length) {
        var lb = el("button", "cat wide");
        lb.appendChild(el("span", "ic", "📚"));
        lb.appendChild(el("span", "nm", "المكتبة"));
        lb.appendChild(el("span", "ct", BOOKS.length + " كتاب"));
        lb.onclick = function () { go({ type: "lib" }); };
        grid.appendChild(lb);
      }
      box.appendChild(grid);
    }
    search.addEventListener("input", function () { query = search.value; draw(); });
    draw();
  }

  function itemRow(k) {
    var b = el("button", "row");
    b.appendChild(el("span", null, ITEMS[k].title));
    b.appendChild(el("span", "chev", "‹"));
    b.onclick = function () { go({ type: "item", key: k }); };
    return b;
  }

  function renderCat(v) {
    var c = CATS.filter(function (x) { return x.id === v.id; })[0];
    titleEl.textContent = c.icon + " " + c.name;
    var list = el("div", "list");
    c.keys.forEach(function (k) { list.appendChild(itemRow(k)); });
    viewEl.appendChild(list);
  }

  /* ---------------- القراءة ---------------- */
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
    [plus, minus, cp, sh].forEach(function (b) { tools.appendChild(b); });
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
      if (p && (!best || p.t > best.p.t)) best = { book: b, p: p };
    });
    if (!best) return null;
    var i = Math.min(best.p.ch || 0, best.book.chapters.length - 1);
    return { book: best.book, chTitle: best.book.chapters[i].title, pct: best.p.pct || 0 };
  }

  function renderLib() {
    titleEl.textContent = "📚 المكتبة";
    var list = el("div", "list");
    BOOKS.forEach(function (b) {
      var btn = el("button", "row book");
      var box = el("span", "bk");
      box.appendChild(el("span", "bt", b.title));
      box.appendChild(el("span", "ba", b.author));
      var p = getPos(b.id);
      if (p && p.pct) box.appendChild(el("span", "bp", "تمت قراءة " + p.pct + "%"));
      btn.appendChild(box);
      btn.appendChild(el("span", "chev", "‹"));
      btn.onclick = function () { go({ type: "book", id: b.id }); };
      list.appendChild(btn);
    });
    if (!BOOKS.length) list.appendChild(el("div", "empty", "لا توجد كتب بعد"));
    viewEl.appendChild(list);
  }

  var sheetEl = null, scrollTimer = null, restoring = false, curBook = null;

  function barH() {
    var b = $("bar"), t = viewEl.querySelector(".reader-tools.sticky");
    return (b ? b.offsetHeight : 0) + (t ? t.offsetHeight : 0);
  }

  function chapEls() { return viewEl.querySelectorAll(".chap"); }

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
    if (!top || top.type !== "book") return;
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
    [plus, minus, idx].forEach(function (b) { tools.appendChild(b); });
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
    var saved = getPos(book.id);
    if (v.jump !== undefined) restoreTo(v.jump, 0);
    else if (saved) restoreTo(saved.ch || 0, saved.r || 0);
  }

  window.addEventListener("scroll", function () {
    if (!curBook) return;
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
    QUOTES = (CATS.filter(function (c) { return c.id === "c7"; })[0] || { keys: [] }).keys
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
  function checkUpdate() {
    if (!window.fetch) return;
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 10000);
    fetch(REMOTE_URL + "?t=" + Date.now(), { cache: "no-store", signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        clearTimeout(timer);
        if (!validData(d) || d.version <= VERSION) return;
        applyData(d);
        try { localStorage.setItem("remoteData", JSON.stringify(d)); } catch (e) {}
        buildQuotes();
        buildIndex();
        var top = stack[stack.length - 1];
        if (top.type === "book") { toast("تم تحديث المحتوى"); return; }
        if (top.type === "item" && !ITEMS[top.key]) stack = [{ type: "home" }];
        if (top.type === "cat" && !CATS.some(function (c) { return c.id === top.id; })) stack = [{ type: "home" }];
        render();
        scheduleAll(false);
        toast("تم تحديث المحتوى");
      })
      .catch(function () { clearTimeout(timer); });
  }

  applyTheme();
  applyFont();
  render();
  setupNative();
  checkUpdate();
})();
