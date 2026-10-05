(() => {
    // The wheel sets where the page is going; the page eases there. Each frame
    // closes a fixed share of what is left (rate 6 per second: half the way in
    // about 115ms, settled in under a second), so a flick glides to a stop
    // instead of landing in steps. The distance is the wheel's own, one to one.
    // The page still scrolls natively, by window.scrollTo, so sticky sections
    // and every scroll listener see ordinary scroll positions.
    // Touch keeps the browser's own momentum, and Reduce Motion keeps the
    // plain wheel.
    const RATE = 6;
    const still = matchMedia('(prefers-reduced-motion: reduce)');
    const mouse = matchMedia('(hover: hover) and (pointer: fine)');
    if (!mouse.matches) return;

    let target = 0, current = 0, frame = 0, last = 0;
    const limit = () => document.documentElement.scrollHeight - window.innerHeight;

    // a list or panel under the pointer that can still scroll keeps the wheel
    function innerScroller(node, dy) {
        for (let el = node; el && el !== document.body && el.nodeType === 1; el = el.parentElement) {
            if (el.hasAttribute('data-scroll-native')) return true;
            if (el.scrollHeight <= el.clientHeight + 1) continue;
            const flow = getComputedStyle(el).overflowY;
            if (flow !== 'auto' && flow !== 'scroll') continue;
            if (dy < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true;
        }
        return false;
    }

    function stop() {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
    }

    function tick(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        current += (target - current) * (1 - Math.exp(-RATE * dt));
        if (Math.abs(target - current) < 0.5) { current = target; frame = 0; }
        else frame = requestAnimationFrame(tick);
        window.scrollTo(0, current);
    }

    window.addEventListener('wheel', (event) => {
        if (still.matches || event.defaultPrevented || event.ctrlKey || event.metaKey) return;
        if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
        if (innerScroller(event.target, event.deltaY)) return;
        event.preventDefault();
        const dy = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * window.innerHeight : event.deltaY;
        if (!frame) {
            target = current = window.scrollY;
            last = performance.now();
            frame = requestAnimationFrame(tick);
        }
        target = Math.max(0, Math.min(limit(), target + dy));
    }, { passive: false });

    // anything else that moves the page (keys, the scrollbar, a link to a
    // section, a script) takes over at once
    window.addEventListener('keydown', stop);
    window.addEventListener('mousedown', stop);
    window.addEventListener('touchstart', stop, { passive: true });
    window.addEventListener('scroll', () => {
        if (frame && Math.abs(window.scrollY - current) > 2) stop();
    }, { passive: true });
})();
