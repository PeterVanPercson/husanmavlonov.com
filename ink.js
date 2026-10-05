(function () {
  var root = document.documentElement;
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ink-toggle';
  btn.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M8 1a7 7 0 0 1 0 14z" fill="currentColor"/></svg>';
  function label() {
    var light = root.getAttribute('data-ink') === 'light';
    btn.setAttribute('aria-label', light ? 'Switch to dark' : 'Switch to light');
    btn.setAttribute('aria-pressed', light ? 'true' : 'false');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', light ? '#ffffff' : '#000000');
  }
  function flip() {
    var light = root.getAttribute('data-ink') !== 'light';
    if (light) root.setAttribute('data-ink', 'light'); else root.removeAttribute('data-ink');
    try { localStorage.setItem('hm-ink', light ? 'light' : 'dark'); } catch (e) {}
    label();
  }
  btn.addEventListener('click', function () {
    var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!document.startViewTransition || still) { flip(); return; }
    var r = btn.getBoundingClientRect();
    var x = r.left + r.width / 2, y = r.top + r.height / 2;
    root.style.setProperty('--ink-x', x + 'px');
    root.style.setProperty('--ink-y', y + 'px');
    root.style.setProperty('--ink-r', Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 'px');
    document.startViewTransition(flip);
  });
  label();
  document.body.appendChild(btn);
})();
