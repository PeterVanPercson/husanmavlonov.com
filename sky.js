/* sky.js — light scroll parallax for the halftone clouds.
   The wrapper (.cloud-p) takes the translate; the img inside keeps its own
   CSS drift animation, so the two transforms never fight. */
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var layers = document.querySelectorAll('.bg-clouds .cloud-p');
  if (!layers.length) return;
  // (drift-phase anchoring lives in the inline script right after .bg-clouds —
  // it must run BEFORE first paint, which a deferred script cannot guarantee)
  var ticking = false;
  function apply() {
    var y = window.scrollY || 0;
    for (var i = 0; i < layers.length; i++) {
      var d = parseFloat(layers[i].getAttribute('data-depth')) || 0.06;
      layers[i].style.transform = 'translate3d(0,' + (-y * d).toFixed(1) + 'px,0)';
    }
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(apply); }
  }, { passive: true });
  apply();
})();
