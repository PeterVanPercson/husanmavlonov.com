/* Contribution skyline: a year of GitHub activity as a heat map that folds up
   into an isometric skyline. Vanilla port of the ContributionSkyline React
   component; one canvas, one camera swinging between straight-down (2D) and
   the corner (3D) while each week's bars rise in a wave, oldest to newest.
   Data: /contributions.json, refreshed daily by .github/workflows/contributions.yml */
(function () {
  var root = document.getElementById('skyline');
  if (!root) return;

  var DAY = 86400000;
  var clamp01 = function (v) { return v > 0 ? (v < 1 ? v : 1) : 0; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var easeInOut = function (x) { var t = clamp01(x); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var easeOut = function (x) { return 1 - Math.pow(1 - clamp01(x), 3); };
  var smooth = function (a, b, x) { var t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  var toKey = function (ms) { return new Date(ms).toISOString().slice(0, 10); };
  var dayMs = function (s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return Date.UTC(+m[1], +m[2] - 1, +m[3]); };

  var YAW3 = Math.PI / 4, ELEV3 = 34 * Math.PI / 180;
  var YAW_R = [8 * Math.PI / 180, 82 * Math.PI / 180], ELEV_R = [18 * Math.PI / 180, 62 * Math.PI / 180];
  var camera = function (e, dy, de) {
    var yaw = Math.min(YAW_R[1], Math.max(0, lerp(0, YAW3 + dy, e)));
    var elev = lerp(Math.PI / 2, Math.min(ELEV_R[1], Math.max(ELEV_R[0], ELEV3 + de)), e);
    return { cs: Math.cos(yaw), sn: Math.sin(yaw), se: Math.sin(elev), ce: Math.cos(elev) };
  };
  var riseAt = function (t, week, weeks, day) {
    var d = (weeks > 1 ? week / (weeks - 1) : 0) * 0.36 + (day / 6) * 0.06;
    return easeOut((t - d) / 0.58);
  };
  var barHeight = function (c, max) { return c > 0 && max > 0 ? 0.4 + Math.pow(c / max, 0.85) * 7.2 : 0.2; };
  var levelOf = function (c, busy) { return c <= 0 ? 0 : busy <= 0 ? 4 : 1 + Math.min(3, Math.floor((c / busy) * 4)); };

  // ink on the navy card: empty cell, then four levels from sky blue up to the site's cream
  var FG = [248, 247, 242], BG = [10, 47, 94];
  var hex = function (h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; };
  var COLS = [[BG[0] + (FG[0] - BG[0]) * 0.11, BG[1] + (FG[1] - BG[1]) * 0.11, BG[2] + (FG[2] - BG[2]) * 0.11]]
    .concat(['#2f6aa6', '#5d97cc', '#a9cbe8', '#f4efdf'].map(hex));
  var rgb = function (r, g, b) { return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')'; };

  var nf = new Intl.NumberFormat('en-US');
  var df = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  var dfy = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  var dfl = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  var mf = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });
  var wf = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' });
  var noun = function (n) { return n === 1 ? 'contribution' : 'contributions'; };
  var range = function (a, b, y) { if (!a || !b) return '—'; var f = y ? dfy : df; return f.format(dayMs(a)) + ' — ' + f.format(dayMs(b)); };

  function build(data) {
    var counts = {}, end = 0;
    data.forEach(function (d) {
      var ms = dayMs(d.date);
      if (ms > end) end = ms;
      if (d.count > 0) counts[toKey(ms)] = (counts[toKey(ms)] || 0) + d.count;
    });
    var start = end - 364 * DAY;
    start -= new Date(start).getUTCDay() * DAY;
    var cells = [];
    for (var ms = start, i = 0; ms <= end; ms += DAY, i++) {
      var k = toKey(ms);
      cells.push({ date: k, count: counts[k] || 0, level: 0, week: Math.floor(i / 7), day: i % 7 });
    }
    var nz = cells.map(function (c) { return c.count; }).filter(function (c) { return c > 0; }).sort(function (a, b) { return a - b; });
    var busy = nz.length ? nz[Math.floor(0.95 * (nz.length - 1))] : 0;
    cells.forEach(function (c) { c.level = levelOf(c.count, busy); });

    var total = 0, best = 0, bestDate = null, run = 0, runStart = null, longest = { days: 0, start: null, end: null };
    cells.forEach(function (c) {
      total += c.count;
      if (c.count > best) { best = c.count; bestDate = c.date; }
      if (c.count > 0) {
        if (run === 0) runStart = c.date;
        run++;
        if (run > longest.days) longest = { days: run, start: runStart, end: c.date };
      } else run = 0;
    });
    var j = cells.length - 1;
    if (j >= 0 && cells[j].count === 0) j--;
    var endAt = j;
    while (j >= 0 && cells[j].count > 0) j--;
    var cur = endAt - j > 0 ? { days: endAt - j, start: cells[j + 1].date, end: cells[endAt].date } : { days: 0, start: null, end: null };

    var weeks = cells[cells.length - 1].week + 1, months = [], prev = -1;
    for (var w = 0; w < weeks; w++) {
      var c = cells[w * 7];
      if (!c) break;
      var m = +c.date.slice(5, 7);
      if (m !== prev) months.push({ week: w, label: mf.format(dayMs(c.date)).toLowerCase() });
      prev = m;
    }
    if (months.length > 1 && months[1].week - months[0].week < 3) months.shift();

    return {
      cells: cells, weeks: weeks, max: nz.length ? nz[nz.length - 1] : 0, months: months,
      stats: { total: total, first: cells[0].date, last: cells[cells.length - 1].date, busiest: { count: best, date: bestDate }, longest: longest, current: cur }
    };
  }

  function pointInQuad(p, o, x, y) {
    var sign = 0;
    for (var k = 0; k < 4; k++) {
      var ax = p[o + k * 2], ay = p[o + k * 2 + 1], b = (k + 1) % 4;
      var cross = (p[o + b * 2] - ax) * (y - ay) - (p[o + b * 2 + 1] - ay) * (x - ax);
      if (Math.abs(cross) < 1e-9) continue;
      var s = cross > 0 ? 1 : -1;
      if (sign === 0) sign = s; else if (s !== sign) return false;
    }
    return sign !== 0;
  }
  function quadPath(ctx, p, o, r) {
    if (r < 0.3) {
      ctx.moveTo(p[o], p[o + 1]); ctx.lineTo(p[o + 2], p[o + 3]); ctx.lineTo(p[o + 4], p[o + 5]); ctx.lineTo(p[o + 6], p[o + 7]);
      ctx.closePath();
      return;
    }
    ctx.moveTo((p[o + 6] + p[o]) / 2, (p[o + 7] + p[o + 1]) / 2);
    for (var k = 0; k < 4; k++) { var b = (k + 1) % 4; ctx.arcTo(p[o + k * 2], p[o + k * 2 + 1], p[o + b * 2], p[o + b * 2 + 1], r); }
    ctx.closePath();
  }

  function stat(b, cls) {
    return '<div class="sk-stat ' + cls + '"><div class="sk-stat-label">' + b.label + '</div>' +
      '<div class="sk-stat-val"><b>' + b.value + '</b> <span>' + b.unit + '</span></div>' +
      '<div class="sk-stat-sub">' + b.sub + '</div></div>';
  }

  function mount(model) {
    var st = model.stats;
    var blocks = [
      { label: '1 year total', value: nf.format(st.total), unit: noun(st.total), sub: range(st.first, st.last, true) },
      { label: 'busiest day', value: nf.format(st.busiest.count), unit: noun(st.busiest.count), sub: st.busiest.date ? df.format(dayMs(st.busiest.date)) : '—' },
      { label: 'longest streak', value: nf.format(st.longest.days), unit: st.longest.days === 1 ? 'day' : 'days', sub: range(st.longest.start, st.longest.end) },
      { label: 'current streak', value: nf.format(st.current.days), unit: st.current.days === 1 ? 'day' : 'days', sub: range(st.current.start, st.current.end) }
    ];
    var touch = window.matchMedia('(hover: none)').matches;
    var names = ['no contributions', 'light', 'moderate', 'heavy', 'heaviest'];
    root.innerHTML =
      '<div class="sk-head"><p class="sk-title"><b>' + nf.format(st.total) + '</b> ' + noun(st.total) + ' in the last year</p>' +
      '<div class="sk-toggle" role="group" aria-label="Chart view"><span class="sk-pill" aria-hidden="true"></span>' +
      '<button type="button" data-v="2d" aria-label="Flat heat map" title="flat heat map"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" fill="currentColor"/><rect x="9" y="1.5" width="5.5" height="5.5" rx="1" fill="currentColor"/><rect x="1.5" y="9" width="5.5" height="5.5" rx="1" fill="currentColor"/><rect x="9" y="9" width="5.5" height="5.5" rx="1" fill="currentColor"/></svg></button>' +
      '<button type="button" data-v="3d" aria-label="3D skyline" title="3d skyline"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 1.2 14.2 4.6v6.8L8 14.8 1.8 11.4V4.6Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M1.8 4.6 8 8l6.2-3.4M8 8v6.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></button></div></div>' +
      '<div class="sk-body"><div class="sk-wrap"><div class="sk-stage">' +
      '<canvas tabindex="0" role="img"></canvas>' +
      '<div class="sk-corner sk-tr" aria-hidden="true">' + stat(blocks[0], 'end') + stat(blocks[1], 'end') + '</div>' +
      '<div class="sk-corner sk-bl" aria-hidden="true">' + stat(blocks[2], 'start') + stat(blocks[3], 'start') + '</div>' +
      '</div><div class="sk-tip" role="tooltip"><span class="sk-tip-text"></span><i aria-hidden="true"></i></div></div>' +
      '<div class="sk-row"><div><div class="sk-row-grid">' + blocks.map(function (b) { return stat(b, 'stack'); }).join('') + '</div></div></div>' +
      '<div class="sk-foot"><span class="sk-hints"><span>' + (touch ? 'tap a day for details' : 'hover a day for details · arrow keys to explore') + '</span><span>' + (touch ? 'drag sideways to orbit' : 'drag to orbit · double-click to reset') + '</span></span>' +
      '<span class="sk-legend"><span>less</span>' + COLS.map(function (c, i) {
        return '<button type="button" data-l="' + i + '" style="background:' + rgb(c[0], c[1], c[2]) + '" aria-label="Highlight ' + names[i] + ' days" title="' + names[i] + '"></button>';
      }).join('') + '<span>more</span></span></div></div>' +
      '<p class="sk-sr" aria-live="polite"></p>';

    var stage = root.querySelector('.sk-stage'), canvas = root.querySelector('canvas'), ctx = canvas.getContext('2d');
    var tip = root.querySelector('.sk-tip'), tipText = root.querySelector('.sk-tip-text'), sr = root.querySelector('.sk-sr');
    var toggleBtns = root.querySelectorAll('.sk-toggle button'), legendBtns = root.querySelectorAll('.sk-legend button');
    if (!ctx) return;

    var reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    var reduced = reduceMq.matches;
    var font = '400 10px ' + getComputedStyle(root).fontFamily;
    var view = '3d', legendLevel = -1;
    var t = 0, target = 0, entered = false;
    var yaw = 0, elev = 0, yawGoal = 0, elevGoal = 0;
    var W = 0, H2 = 0, H3 = 0, Hmax = 0, lastH = -1, dpr = 1, gutter = 30, labelW = 30;
    var n = model.cells.length, weeks = model.weeks;
    var wk = new Float32Array(n), dy = new Float32Array(n), lv = new Uint8Array(n), hgt = new Float32Array(n), zs = new Float32Array(n);
    var hover = new Float32Array(n), dim = new Float32Array(n), polys = new Float32Array(n * 24), faces = new Uint8Array(n);
    var order = [];
    for (var i = 0; i < n; i++) {
      var c = model.cells[i];
      wk[i] = c.week; dy[i] = c.day; lv[i] = c.level; hgt[i] = barHeight(c.count, model.max);
      order.push(i);
    }
    var weekdayRows = [];
    for (var d = 0; d < 7 && d < n; d++) {
      var dow = new Date(dayMs(model.cells[d].date)).getUTCDay();
      if (dow === 1 || dow === 3 || dow === 5) weekdayRows.push({ day: d, label: wf.format(dayMs(model.cells[d].date)).toLowerCase() });
    }
    ctx.font = font;
    labelW = Math.ceil(Math.max(20, Math.max.apply(null, weekdayRows.map(function (r) { return ctx.measureText(r.label).width; })))) + 8;
    var hovered = -1, pinned = -1, activeIdx = -1, tipW = 0, raf = 0, last = 0;

    var describe = function (i) {
      var c = model.cells[i];
      return (c.count ? nf.format(c.count) + ' ' + noun(c.count) : 'no contributions') + ' on ' + dfl.format(dayMs(c.date));
    };

    var extent = function (cam, e, full) {
      var w = lerp(0.78, 0.9, e), off = (1 - w) / 2;
      var minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
      var add = function (x, y, z) {
        var px = x * cam.cs - y * cam.sn, py = (x * cam.sn + y * cam.cs) * cam.se - z * cam.ce;
        if (px < minx) minx = px; if (px > maxx) maxx = px; if (py < miny) miny = py; if (py > maxy) maxy = py;
      };
      for (var i = 0; i < n; i++) {
        var x0 = wk[i] + off, y0 = dy[i] + off, z = full ? hgt[i] * e : zs[i];
        add(x0, y0, z); add(x0 + w, y0, z); add(x0, y0 + w, z);
        add(x0 + w, y0 + w, 0); add(x0, y0 + w, 0); add(x0 + w, y0, 0);
      }
      add(0, 7 + 1.5 * e, 0); add(weeks, 7 + 1.5 * e, 0);
      return { minx: minx, maxx: maxx, miny: miny, maxy: maxy };
    };

    var layoutDom = function () {
      var is3d = view === '3d';
      var corners = W >= 560;
      root.classList.toggle('is-3d', is3d);
      root.classList.toggle('has-corners', is3d && corners);
      root.style.setProperty('--sk-big', Math.round(Math.max(30, Math.min(56, W * 0.058))) + 'px');
      toggleBtns.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.v === view ? 'true' : 'false'); });
      canvas.setAttribute('aria-label', nf.format(st.total) + ' ' + noun(st.total) + ' between ' + range(st.first, st.last, true) +
        ', shown as a ' + (is3d ? '3D skyline' : 'heat map') + '. Use the arrow keys to read individual days.');
      canvas.style.touchAction = is3d ? 'pan-y' : 'auto';
    };

    var relayout = function () {
      var w = Math.round(stage.clientWidth);
      if (!w) return;
      W = w;
      gutter = W < 520 ? 0 : labelW;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      var b2 = extent(camera(0, 0, 0), 0, true);
      H2 = 24 + ((b2.maxy - b2.miny) / (b2.maxx - b2.minx)) * (W - gutter - 4);
      var b3 = extent(camera(1, 0, 0), 1, true);
      var natural = ((b3.maxy - b3.miny) / (b3.maxx - b3.minx)) * (W - 40) + 40;
      H3 = Math.max(Math.min(natural, W * 0.72, 620), Math.min(natural, 240));
      Hmax = Math.ceil(Math.max(H2, H3));
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(Hmax * dpr);
      canvas.style.width = W + 'px';
      canvas.style.height = Hmax + 'px';
      lastH = -1;
      layoutDom();
      draw();
    };

    var draw = function () {
      if (!W) return;
      var e = easeInOut(t), cam = camera(e, yaw, elev), Hc = lerp(H2, H3, e);
      if (Math.abs(Hc - lastH) > 0.2) { stage.style.height = Hc.toFixed(1) + 'px'; lastH = Hc; }
      for (var i = 0; i < n; i++) zs[i] = riseAt(t, wk[i], weeks, dy[i]) * hgt[i];
      var b = extent(cam, e, false);
      var pad = lerp(2, 20, e), left = pad + gutter * (1 - e), top = pad + 20 * (1 - e);
      var aw = W - left - pad, ah = Hc - top - pad;
      var bw = Math.max(1e-6, b.maxx - b.minx), bh = Math.max(1e-6, b.maxy - b.miny);
      var s = Math.min(aw / bw, ah / bh);
      var ox = left + (aw - bw * s) / 2 - b.minx * s, oy = top + (ah - bh * s) / 2 - b.miny * s;
      var cs = cam.cs, sn = cam.sn, se = cam.se, ce = cam.ce;
      var px = function (x, y) { return ox + (x * cs - y * sn) * s; };
      var py = function (x, y, z) { return oy + ((x * sn + y * cs) * se - z * ce) * s; };

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, Hmax);
      order.sort(function (a, c) { return (wk[a] + 0.5) * sn + (dy[a] + 0.5) * cs - ((wk[c] + 0.5) * sn + (dy[c] + 0.5) * cs); });

      var w = lerp(0.78, 0.9, e), off = (1 - w) / 2, radius = lerp(0.17, 0.03, e) * s, outline = (1 - e) * 0.07, lift = 0.7 * e;
      var E = COLS[0];
      for (var k = 0; k < n; k++) {
        i = order[k];
        var x0 = wk[i] + off, y0 = dy[i] + off, x1 = x0 + w, y1 = y0 + w, z = zs[i] + hover[i] * lift, o = i * 24;
        polys[o] = px(x0, y0); polys[o + 1] = py(x0, y0, z);
        polys[o + 2] = px(x1, y0); polys[o + 3] = py(x1, y0, z);
        polys[o + 4] = px(x1, y1); polys[o + 5] = py(x1, y1, z);
        polys[o + 6] = px(x0, y1); polys[o + 7] = py(x0, y1, z);
        polys[o + 8] = px(x0, y1); polys[o + 9] = py(x0, y1, 0);
        polys[o + 10] = px(x1, y1); polys[o + 11] = py(x1, y1, 0);
        polys[o + 12] = polys[o + 4]; polys[o + 13] = polys[o + 5];
        polys[o + 14] = polys[o + 6]; polys[o + 15] = polys[o + 7];
        polys[o + 16] = px(x1, y0); polys[o + 17] = py(x1, y0, 0);
        polys[o + 18] = polys[o + 10]; polys[o + 19] = polys[o + 11];
        polys[o + 20] = polys[o + 4]; polys[o + 21] = polys[o + 5];
        polys[o + 22] = polys[o + 2]; polys[o + 23] = polys[o + 3];

        var tall = z * ce * s, f = 0;
        if (tall > 0.35 && w * cs * s > 0.35) f |= 1;
        if (tall > 0.35 && w * sn * s > 0.35) f |= 2;
        faces[i] = f;

        var C = COLS[lv[i]], r = C[0], g = C[1], bl = C[2], dd = dim[i], hv = hover[i];
        if (dd > 0.002) { r += (E[0] - r) * 0.72 * dd; g += (E[1] - g) * 0.72 * dd; bl += (E[2] - bl) * 0.72 * dd; }
        if (hv > 0.002) { var mm = 0.16 * hv; r += (FG[0] - r) * mm; g += (FG[1] - g) * mm; bl += (FG[2] - bl) * mm; }
        if (f & 1) { ctx.beginPath(); quadPath(ctx, polys, o + 8, 0); ctx.fillStyle = rgb(r * 0.84, g * 0.84, bl * 0.84); ctx.fill(); }
        if (f & 2) { ctx.beginPath(); quadPath(ctx, polys, o + 16, 0); ctx.fillStyle = rgb(r * 0.68, g * 0.68, bl * 0.68); ctx.fill(); }
        ctx.beginPath();
        quadPath(ctx, polys, o, radius);
        ctx.fillStyle = rgb(r, g, bl);
        ctx.fill();
        if (outline > 0.004) { ctx.strokeStyle = 'rgba(248,247,242,' + outline.toFixed(3) + ')'; ctx.lineWidth = 1; ctx.stroke(); }
        if (hv > 0.02) { ctx.strokeStyle = 'rgba(248,247,242,' + (0.85 * hv).toFixed(3) + ')'; ctx.lineWidth = 1.5; ctx.stroke(); }
      }

      ctx.font = font;
      var a2 = 1 - smooth(0, 0.4, e), a3 = smooth(0.62, 1, e), edge, x, m, mi;
      if (a2 > 0.004) {
        ctx.fillStyle = 'rgba(219,229,242,' + a2.toFixed(3) + ')';
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        edge = -Infinity;
        for (mi = 0; mi < model.months.length; mi++) {
          m = model.months[mi];
          x = px(m.week + off, -0.3);
          var tw = ctx.measureText(m.label).width;
          if (x < edge || x + tw > W) continue;
          ctx.fillText(m.label, x, py(m.week + off, -0.3, 0) - 3);
          edge = x + tw + 6;
        }
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        if (gutter > 0) weekdayRows.forEach(function (r) { ctx.fillText(r.label, px(0, r.day + 0.5) - 6, py(0, r.day + 0.5, 0)); });
      }
      if (a3 > 0.004) {
        ctx.fillStyle = 'rgba(219,229,242,' + a3.toFixed(3) + ')';
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        edge = -Infinity;
        for (mi = 0; mi < model.months.length; mi++) {
          m = model.months[mi];
          x = px(m.week + 0.5, 7.3);
          if (x < edge || x + ctx.measureText(m.label).width > W) continue;
          ctx.fillText(m.label, x, py(m.week + 0.5, 7.3, 0) + 2);
          edge = x + ctx.measureText(m.label).width + 10;
        }
      }

      if (activeIdx >= 0) {
        i = activeIdx;
        z = zs[i] + hover[i] * lift;
        var tx = px(wk[i] + 0.5, dy[i] + 0.5);
        var ty = Math.min(py(wk[i] + off, dy[i] + off, z), py(wk[i] + off + w, dy[i] + off, z), py(wk[i] + off, dy[i] + off + w, z));
        var half = tipW / 2, cx = Math.min(W - half - 2, Math.max(half + 2, tx));
        tip.style.transform = 'translate(' + (cx - half).toFixed(1) + 'px,' + (ty - 8).toFixed(1) + 'px) translateY(-100%)';
        tip.style.setProperty('--arrow', (tx - cx + half).toFixed(1) + 'px');
      }
    };

    var tick = function (now) {
      raf = 0;
      var dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      var moving = false;
      if (t !== target) {
        var step = reduced ? 1 : (dt * 1000) / 1300;
        t = target > t ? Math.min(target, t + step) : Math.max(target, t - step);
        moving = true;
      }
      var ko = reduced ? 1 : 1 - Math.exp(-dt * 12);
      yaw += (yawGoal - yaw) * ko;
      elev += (elevGoal - elev) * ko;
      if (Math.abs(yawGoal - yaw) > 1e-4 || Math.abs(elevGoal - elev) > 1e-4) moving = true;
      else { yaw = yawGoal; elev = elevGoal; }
      var kh = reduced ? 1 : 1 - Math.exp(-dt * 16), kd = reduced ? 1 : 1 - Math.exp(-dt * 10);
      for (var i = 0; i < n; i++) {
        var hg = i === activeIdx ? 1 : 0, dg = legendLevel >= 0 && lv[i] !== legendLevel ? 1 : 0, h = hover[i], d = dim[i];
        if (h !== hg) { hover[i] = Math.abs(hg - h) < 0.003 ? hg : h + (hg - h) * kh; moving = true; }
        if (d !== dg) { dim[i] = Math.abs(dg - d) < 0.003 ? dg : d + (dg - d) * kd; moving = true; }
      }
      draw();
      if (moving) raf = requestAnimationFrame(tick);
    };
    var kick = function () {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };

    var refreshActive = function () {
      var next = hovered >= 0 ? hovered : pinned;
      if (next === activeIdx) return;
      activeIdx = next;
      if (next >= 0) {
        var c = model.cells[next];
        tipText.innerHTML = '<b>' + (c.count ? nf.format(c.count) + ' ' + noun(c.count) : 'no contributions') + '</b><span> on ' + dfy.format(dayMs(c.date)) + '</span>';
        tip.classList.add('on');
        tipW = tip.offsetWidth;
      } else tip.classList.remove('on');
      tip.setAttribute('aria-hidden', next < 0 ? 'true' : 'false');
      kick();
    };

    var hit = function (x, y) {
      for (var k = n - 1; k >= 0; k--) {
        var i = order[k], o = i * 24;
        if (pointInQuad(polys, o, x, y)) return i;
        if (faces[i] & 1 && pointInQuad(polys, o + 8, x, y)) return i;
        if (faces[i] & 2 && pointInQuad(polys, o + 16, x, y)) return i;
      }
      return -1;
    };
    var local = function (ev) { var r = canvas.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
    var cursor = function (i) { return target === 1 ? 'grab' : i >= 0 ? 'pointer' : 'default'; };

    var drag = null;
    canvas.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0) return;
      var can = target === 1;
      drag = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, yaw: yawGoal, elev: elevGoal, moved: false, orbit: can, mouse: ev.pointerType === 'mouse' };
      if (can) try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
    });
    canvas.addEventListener('pointermove', function (ev) {
      if (drag && drag.orbit && ev.pointerId === drag.id) {
        var dx = ev.clientX - drag.x, dyy = ev.clientY - drag.y;
        if (drag.moved || Math.hypot(dx, dyy) > 4) {
          drag.moved = true;
          yawGoal = Math.min(YAW_R[1] - YAW3, Math.max(YAW_R[0] - YAW3, drag.yaw + dx * 0.006));
          if (drag.mouse) elevGoal = Math.min(ELEV_R[1] - ELEV3, Math.max(ELEV_R[0] - ELEV3, drag.elev + dyy * 0.004));
          canvas.style.cursor = 'grabbing';
          hovered = -1;
          refreshActive();
          kick();
          return;
        }
      }
      if (ev.pointerType !== 'mouse') return;
      var p = local(ev), i = hit(p[0], p[1]);
      if (i !== hovered) { hovered = i; refreshActive(); }
      canvas.style.cursor = cursor(i);
    });
    canvas.addEventListener('pointerup', function (ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      var moved = drag.moved;
      drag = null;
      if (canvas.hasPointerCapture(ev.pointerId)) canvas.releasePointerCapture(ev.pointerId);
      canvas.style.cursor = cursor(-1);
      if (moved) return;
      var p = local(ev), i = hit(p[0], p[1]);
      pinned = i === pinned ? -1 : i;
      if (ev.pointerType !== 'mouse') hovered = -1;
      refreshActive();
    });
    canvas.addEventListener('pointercancel', function () { drag = null; });
    canvas.addEventListener('pointerleave', function () { if (drag) return; hovered = -1; refreshActive(); });
    canvas.addEventListener('dblclick', function () { yawGoal = 0; elevGoal = 0; kick(); });
    canvas.addEventListener('blur', function () { pinned = -1; refreshActive(); });
    canvas.addEventListener('keydown', function (ev) {
      var keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Escape'];
      if (keys.indexOf(ev.key) < 0) return;
      ev.preventDefault();
      if (ev.key === 'Escape') { pinned = -1; hovered = -1; refreshActive(); return; }
      var i = pinned >= 0 ? pinned : activeIdx >= 0 ? activeIdx : n - 1;
      if (pinned >= 0 || activeIdx >= 0) {
        if (ev.key === 'ArrowLeft') i -= 7;
        if (ev.key === 'ArrowRight') i += 7;
        if (ev.key === 'ArrowUp') i -= 1;
        if (ev.key === 'ArrowDown') i += 1;
        if (ev.key === 'Home') i = 0;
        if (ev.key === 'End') i = n - 1;
      }
      pinned = Math.max(0, Math.min(n - 1, i));
      hovered = -1;
      refreshActive();
      sr.textContent = describe(pinned);
    });

    var setTarget = function () {
      var goal = view === '3d' ? 1 : 0;
      if (!entered || goal === target) return;
      target = goal;
      if (goal === 0) { yawGoal = 0; elevGoal = 0; }
      canvas.style.cursor = cursor(-1);
      kick();
    };
    toggleBtns.forEach(function (b) {
      b.addEventListener('click', function () { view = b.dataset.v; layoutDom(); setTarget(); });
    });
    var legend = root.querySelector('.sk-legend');
    var setLegend = function (l) {
      legendLevel = l;
      legendBtns.forEach(function (b) { b.setAttribute('aria-pressed', +b.dataset.l === l ? 'true' : 'false'); });
      kick();
    };
    legendBtns.forEach(function (b) {
      var l = +b.dataset.l;
      b.addEventListener('mouseenter', function () { setLegend(l); });
      b.addEventListener('focus', function () { setLegend(l); });
      b.addEventListener('blur', function () { setLegend(-1); });
      b.addEventListener('click', function () { setLegend(legendLevel === l ? -1 : l); });
    });
    legend.addEventListener('mouseleave', function () { setLegend(-1); });
    reduceMq.addEventListener && reduceMq.addEventListener('change', function () { reduced = reduceMq.matches; kick(); });

    relayout();
    // the skyline rises out of the flat map the first time it scrolls into view
    var enter = function () { if (entered) return; entered = true; if (reduced) t = 1; setTarget(); draw(); };
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        if (es.some(function (en) { return en.isIntersecting; })) { enter(); io.disconnect(); }
      }, { threshold: 0.35 });
      io.observe(stage);
    } else enter();
    new ResizeObserver(function () { if (Math.round(stage.clientWidth) !== W) relayout(); }).observe(stage);
  }

  fetch('/contributions.json', { cache: 'no-cache' })
    .then(function (r) { return r.json(); })
    .then(function (d) { if (d && d.length) mount(build(d)); })
    .catch(function () { root.closest('section').hidden = true; });
})();
