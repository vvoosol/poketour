'use strict';
(() => {
  const frames = Object.freeze({
    portrait: Object.freeze({ width: 360, height: 800 }),
    landscape: Object.freeze({ width: 800, height: 360 }),
  });
  function measure(width, height, orientation) {
    const mode = orientation || (width > height ? 'landscape' : 'portrait');
    const frame = frames[mode];
    return { mode, ...frame, scale: Math.min(width / frame.width, height / frame.height) };
  }
  window.PoketourLayout = Object.freeze({ frames, measure });
  const stage = document.getElementById('game-stage');
  const canvas = stage.querySelector('.game-window');
  function fit() {
    // A phone keyboard changes the available space, not the physical orientation.
    const orientation = window.matchMedia('(pointer: coarse)').matches && window.screen.orientation?.type;
    const layout = measure(stage.clientWidth, stage.clientHeight, orientation ? (orientation.startsWith('landscape') ? 'landscape' : 'portrait') : undefined);
    if (!(layout.scale > 0)) return;
    const changed = canvas.dataset.layout !== layout.mode;
    canvas.dataset.layout = layout.mode;
    canvas.style.setProperty('--game-scale', String(layout.scale));
    canvas.dataset.fitted = 'true';
    if (changed) window.dispatchEvent(new CustomEvent('poketour:layout'));
  }
  new ResizeObserver(fit).observe(stage);
  window.screen.orientation?.addEventListener('change', fit);
  fit();
})();
