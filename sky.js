/* sky.js — light scroll parallax for the halftone clouds.
   The wrapper (.cloud-p) takes the translate; the img inside keeps its own
   CSS drift animation, so the two transforms never fight. */
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var layers = document.querySelectorAll('.bg-clouds .cloud-p');
  if (!layers.length) return;
  // anchor the drift phase to the wall clock so a drifter is in the SAME spot
  // on every page — no jump when navigating (alternate = 2×duration cycle)
  document.querySelectorAll('.cloud-p img').forEach(function (img) {
    var d = parseFloat(getComputedStyle(img).animationDuration) || 160;
    img.style.animationDelay = (-(Date.now() / 1000 % (2 * d))).toFixed(1) + 's';
  });
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
