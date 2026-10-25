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
      return { books: Array.isArray(f.books) ? f.books : [], items: Array.isArray(f.items) ? f.items : [] };
    } catch (e) { return { books: [], items: [] }; }
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
           f.items.filter(function (k) { return ITEMS[k]; }).length;
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
        rb.onclick = function () { openBook(last.book.id); };
        box.appendChild(rb);
      }
      box.appendChild(el("div", "hello", "اختر القسم"));
      var grid = el("div", "grid");
      CATS.forEach(function (c) {
        if (c.parent) return;
        var b = el("button", "cat");
        b.appendChild(el("span", "ic", c.icon));
        b.appendChild(el("span", "nm", c.name));
        b.appendChild(el("span", "ct", (c.keys.length + CATS.reduce(function (n, x) { return n + (x.parent === c.id ? x.keys.length : 0); }, 0)) + " عنوان"));
        b.onclick = function () { go({ type: "cat", id: c.id }); };
        grid.appendChild(b);
      });
      var tb = el("button", "cat wide");
      tb.appendChild(el("span", "ic", "📿"));
      tb.appendChild(el("span", "nm", "المسبحة"));
      tb.appendChild(el("span", "ct", "عدّاد التسبيح"));
      tb.onclick = function () { go({ type: "tasbih" }); };
      grid.appendChild(tb);
      if (BOOKS.length) {
        var lb = el("button", "cat wide");
        lb.appendChild(el("span", "ic", "📚"));
        lb.appendChild(el("span", "nm", "المكتبة"));
        lb.appendChild(el("span", "ct", BOOKS.length + " كتاب"));
        lb.onclick = function () { go({ type: "lib" }); };
        grid.appendChild(lb);
      }
      var fb = el("button", "cat wide fav");
      fb.appendChild(el("span", "ic", "⭐"));
      fb.appendChild(el("span", "nm", "المفضلة"));
      fb.appendChild(el("span", "ct", favCount() ? favCount() + " عنصر" : "كتبك وأدعيتك المحفوظة"));
      fb.onclick = function () { go({ type: "favs" }); };
      grid.appendChild(fb);
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
    cv.src = BASE + "covers/" + b.id + ".jpg";
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
    if (!bks.length && !its.length) {
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

  function renderVolumes(book) {
    titleEl.textContent = book.title;
    var box = el("div");
    var bc = el("img", "bigcov"); bc.alt = "";
    bc.onerror = function () { bc.remove(); };
    bc.src = BASE + "covers/" + book.id + ".jpg";
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
    box.appendChild(el("div", "ainote", "يفتح قائمة المشاركة: اختر Claude أو Gemini أو أي تطبيق عندك. نص السؤال يُنسخ تلقائياً، الصقه إذا لم يظهر. الشرح آلي وقد يخطئ."));
    panel.appendChild(box);
    sheetEl.appendChild(panel);
    document.body.appendChild(sheetEl);
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
    pageLbl = el("span", "pglbl", "");
    [zo, zi, idxb, star, aib, pageLbl].forEach(function (b) { tools.appendChild(b); });
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
})();
