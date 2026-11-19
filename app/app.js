'use strict';
/* Vice Cover Maker — offline GTA 6 style multi-panel cover studio.
   No network: all fonts and photos are vendored under app/. */

var SAMPLES = [
  'samples/boulevard.jpg',
  'samples/pier.jpg',
  'samples/portrait-woman.jpg',
  'samples/portrait-man.jpg'
];

var LAYOUTS = {
  'hero3':   { label: 'Hero + 3',   panels: function () { return [
    { x: 0, y: 0, w: 0.62, h: 1, rot: 0 },
    { x: 0.62, y: 0, w: 0.38, h: 1 / 3, rot: 0 },
    { x: 0.62, y: 1 / 3, w: 0.38, h: 1 / 3, rot: 0 },
    { x: 0.62, y: 2 / 3, w: 0.38, h: 1 / 3, rot: 0 }]; } },
  'grid4':   { label: 'Four-square', panels: function () { return [
    { x: 0, y: 0, w: 0.5, h: 0.5, rot: 0 },
    { x: 0.5, y: 0, w: 0.5, h: 0.5, rot: 0 },
    { x: 0, y: 0.5, w: 0.5, h: 0.5, rot: 0 },
    { x: 0.5, y: 0.5, w: 0.5, h: 0.5, rot: 0 }]; } },
  'full':    { label: 'Full bleed', panels: function () { return [
    { x: 0, y: 0, w: 1, h: 1, rot: 0 }]; } },
  'tilted':  { label: 'Tilted snaps', panels: function () { return [
    { x: 0, y: 0, w: 1, h: 1, rot: 0, bg: true },
    { x: 0.06, y: 0.10, w: 0.34, h: 0.52, rot: -0.10 },
    { x: 0.34, y: 0.30, w: 0.34, h: 0.52, rot: 0.06 },
    { x: 0.62, y: 0.08, w: 0.34, h: 0.52, rot: -0.04 }]; } },
  'grid9':   { label: 'Nine-grid',  panels: function () {
    var out = [];
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++)
      out.push({ x: c / 3, y: r / 3, w: 1 / 3, h: 1 / 3, rot: 0 });
    return out; } }
};

var TONES = {
  sunset: { label: 'Sunset',   top: 'rgba(255,94,60,0.20)',  bottom: 'rgba(255,46,136,0.28)', tint: 'rgba(255,170,60,0.10)' },
  neon:   { label: 'Neon',     top: 'rgba(34,230,210,0.16)', bottom: 'rgba(255,46,136,0.30)', tint: 'rgba(120,60,255,0.12)' },
  vice:   { label: 'Vice City',top: 'rgba(34,230,210,0.22)', bottom: 'rgba(255,120,200,0.22)', tint: 'rgba(255,46,136,0.08)' },
  gold:   { label: 'Gold',     top: 'rgba(255,200,87,0.20)', bottom: 'rgba(180,110,20,0.26)',  tint: 'rgba(255,220,140,0.10)' },
  night:  { label: 'Night',    top: 'rgba(20,20,80,0.30)',   bottom: 'rgba(5,5,20,0.42)',      tint: 'rgba(80,120,255,0.08)' }
};

var state = {
  layout: 'hero3', tone: 'sunset',
  title: 'VICE CITY', subtitle: 'Welcome to Leonida',
  grain: true, selected: 0,
  panels: [] // { photo, ox, oy, scale } — ox/oy in panel fractions, scale >= 1
};
var photos = [];   // { src, name, img }
var undoStack = [];
var redoStack = [];
var lastRects = []; // pixel rects of the last render, for hit-testing
var grainCanvas = null;

function $(id) { return document.getElementById(id); }
function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

function defaultPanels(count) {
  var out = [];
  for (var i = 0; i < count; i++)
    out.push({ photo: i, ox: 0, oy: 0, scale: 1 });
  return out;
}
function ensurePanels() {
  var n = LAYOUTS[state.layout].panels().length;
  while (state.panels.length < n) state.panels.push({ photo: state.panels.length, ox: 0, oy: 0, scale: 1 });
  state.panels.length = n;
  state.selected = clamp(state.selected, 0, n - 1);
}
function snapshot() { return JSON.stringify(state); }
function pushUndo() { undoStack.push(snapshot()); if (undoStack.length > 60) undoStack.shift(); redoStack.length = 0; }
function restore(json) { state = JSON.parse(json); ensurePanels(); syncControls(); render(); }
function doUndo() { if (!undoStack.length) return; redoStack.push(snapshot()); restore(undoStack.pop()); }
function doRedo() { if (!redoStack.length) return; undoStack.push(snapshot()); restore(redoStack.pop()); }

function loadImage(src) {
  return new Promise(function (resolve, reject) {
    var img = new Image();
    img.onload = function () { resolve(img); };
    img.onerror = function () { reject(new Error('failed to load ' + src)); };
    img.src = src;
  });
}
function addPhotoAt(src, index) {
  return loadImage(src).then(function (img) {
    photos[index] = { src: src, name: src.split('/').pop(), img: img };
    buildFilmstrip();
    ensurePanels();
  });
}
function buildFilmstrip() {
  var strip = $('filmstrip');
  strip.innerHTML = '';
  photos.forEach(function (p, i) {
    var thumb = document.createElement('img');
    thumb.src = p.src;
    thumb.alt = p.name;
    thumb.title = p.name + ' — click to use in selected panel';
    if (state.panels[state.selected] && state.panels[state.selected].photo === i) thumb.classList.add('sel');
    thumb.addEventListener('click', function () {
      pushUndo();
      ensurePanels();
      state.panels[state.selected].photo = i;
      buildFilmstrip();
      render();
    });
    strip.appendChild(thumb);
  });
}

/* ---- drawing ---- */
function makeGrain() {
  var c = document.createElement('canvas');
  c.width = 160; c.height = 160;
  var g = c.getContext('2d');
  var data = g.createImageData(160, 160);
  for (var i = 0; i < data.data.length; i += 4) {
    var v = Math.floor(Math.random() * 255);
    data.data[i] = v; data.data[i + 1] = v; data.data[i + 2] = v; data.data[i + 3] = 255;
  }
  g.putImageData(data, 0, 0);
  return c;
}
function drawImageCover(ctx, img, x, y, w, h, ox, oy, scale) {
  // Cover-fit: scale so the photo fills the whole panel (the larger of the
  // two axis ratios wins), then centre it; ox/oy nudge it in panel fractions.
  var iw = img.naturalWidth, ih = img.naturalHeight;
  var s = Math.max(w / iw, h / ih) * (scale || 1);
  var dw = iw * s, dh = ih * s;
  var dx = x + (w - dw) / 2 + (ox || 0) * w;
  var dy = y + (h - dh) / 2 + (oy || 0) * h;
  ctx.drawImage(img, dx, dy, dw, dh);
}
function applyGrade(ctx, W, H, toneName) {
  var t = TONES[toneName] || TONES.sunset;
  var g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, t.top);
  g.addColorStop(1, t.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = t.tint;
  ctx.fillRect(0, 0, W, H);
}
function applyVignette(ctx, W, H) {
  var g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
function applyGrain(ctx, W, H) {
  if (!grainCanvas) grainCanvas = makeGrain();
  ctx.save();
  ctx.globalAlpha = 0.07;
  var pat = ctx.createPattern(grainCanvas, 'repeat');
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
function drawTitle(ctx, W, H, title, subtitle) {
  var pad = Math.round(W * 0.045);
  var size = Math.round(W * 0.115);
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.font = size + 'px Anton, sans-serif';
  ctx.lineWidth = Math.max(2, Math.round(size / 14));
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  var ty = H - Math.round(H * 0.10);
  ctx.strokeText(title, pad, ty);
  var grad = ctx.createLinearGradient(0, ty - size, 0, ty);
  grad.addColorStop(0, '#fff7d6');
  grad.addColorStop(0.55, '#ffb347');
  grad.addColorStop(1, '#ff2e88');
  ctx.fillStyle = grad;
  ctx.fillText(title, pad, ty);
  if (subtitle) {
    ctx.font = Math.round(W * 0.042) + 'px Pacifico, cursive';
    ctx.shadowColor = '#ff2e88';
    ctx.shadowBlur = Math.round(W * 0.02);
    ctx.fillStyle = '#7df9ff';
    ctx.fillText(subtitle, pad + Math.round(W * 0.01), ty + Math.round(H * 0.06));
  }
  ctx.restore();
}
function renderCover(ctx, W, H, st) {
  var rects = LAYOUTS[st.layout].panels();
  ctx.save();
  ctx.fillStyle = '#0d0a14';
  ctx.fillRect(0, 0, W, H);
  var gap = Math.max(2, Math.round(W * 0.006));
  lastRects = [];
  rects.forEach(function (r, i) {
    var px = r.x * W, py = r.y * H, pw = r.w * W, ph = r.h * H;
    var p = st.panels[i] || { photo: i, ox: 0, oy: 0, scale: 1 };
    var photo = photos[p.photo % Math.max(photos.length, 1)];
    if (!photo) return;
    ctx.save();
    if (r.rot) {
      ctx.translate(px + pw / 2, py + ph / 2);
      ctx.rotate(r.rot);
      ctx.translate(-pw / 2, -ph / 2);
      px = 0; py = 0;
    }
    ctx.beginPath();
    ctx.rect(px + (r.bg ? 0 : gap / 2), py + (r.bg ? 0 : gap / 2), pw - (r.bg ? 0 : gap), ph - (r.bg ? 0 : gap));
    ctx.clip();
    drawImageCover(ctx, photo.img, px, py, pw, ph, p.ox, p.oy, p.scale);
    ctx.restore();
    if (r.rot) { // white snapshot border
      ctx.save();
      ctx.translate(r.x * W + pw / 2, r.y * H + ph / 2);
      ctx.rotate(r.rot);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = Math.max(3, Math.round(W * 0.008));
      ctx.strokeRect(-pw / 2, -ph / 2, pw, ph);
      ctx.restore();
    } else if (!r.bg) {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = Math.max(1, gap / 2);
      ctx.strokeRect(px + gap / 2, py + gap / 2, pw - gap, ph - gap);
    }
    lastRects.push({ x: r.x * W, y: r.y * H, w: pw, h: ph });
  });
  applyGrade(ctx, W, H, st.tone);
  applyVignette(ctx, W, H);
  if (st.grain) applyGrain(ctx, W, H);
  drawTitle(ctx, W, H, st.title, st.subtitle);
  // selected panel outline (editor only, drawn on the visible canvas)
  if (st === state && ctx === $('coverCanvas').getContext('2d')) {
    var sel = lastRects[state.selected];
    if (sel) {
      ctx.save();
      ctx.strokeStyle = '#22e6d2';
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 6]);
      ctx.strokeRect(sel.x + 2, sel.y + 2, sel.w - 4, sel.h - 4);
      ctx.restore();
    }
  }
  ctx.restore();
}
function render() {
  var canvas = $('coverCanvas');
  if (!canvas || !photos.length) return;
  ensurePanels();
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  // keep the preview square-ish for hero layouts; full-bleed stays square too
  renderCover(ctx, W, H, state);
  buildFilmstrip();
}
function exportPNG(w, h) {
  var off = document.createElement('canvas');
  off.width = w; off.height = h;
  renderCover(off.getContext('2d'), w, h, state);
  return new Promise(function (resolve, reject) {
    off.toBlob(function (blob) {
      if (!blob) { reject(new Error('export failed')); return; }
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'vice-cover-' + w + 'x' + h + '.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      $('statusLine').textContent = 'Exported ' + w + '×' + h + ' PNG (' + Math.round(blob.size / 1024) + ' KiB).';
      resolve(blob);
    }, 'image/png');
  });
}
window.__exportPNG = exportPNG; // headless verification hook
window.__renderCover = renderCover;

/* ---- controls ---- */
function syncControls() {
  document.querySelectorAll('#layoutBtns .btn').forEach(function (b) {
    b.classList.toggle('active', b.dataset.layout === state.layout);
  });
  document.querySelectorAll('#toneBtns .btn').forEach(function (b) {
    b.classList.toggle('active', b.dataset.tone === state.tone);
  });
  $('titleInput').value = state.title;
  $('subtitleInput').value = state.subtitle;
  $('grainToggle').checked = state.grain;
}
function buildControlButtons() {
  var lb = $('layoutBtns');
  Object.keys(LAYOUTS).forEach(function (key) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'btn'; b.dataset.layout = key;
    b.textContent = LAYOUTS[key].label;
    b.addEventListener('click', function () {
      if (state.layout === key) return;
      pushUndo(); state.layout = key; ensurePanels(); syncControls(); render();
    });
    lb.appendChild(b);
  });
  var tb = $('toneBtns');
  Object.keys(TONES).forEach(function (key) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'btn'; b.dataset.tone = key;
    b.textContent = TONES[key].label;
    b.addEventListener('click', function () {
      pushUndo(); state.tone = key; syncControls(); render();
    });
    tb.appendChild(b);
  });
}
function canvasPoint(e) {
  var canvas = $('coverCanvas');
  var r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * canvas.width, y: (e.clientY - r.top) / r.height * canvas.height };
}
function panelAt(pt) {
  for (var i = lastRects.length - 1; i >= 0; i--) {
    var r = lastRects[i];
    if (pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h) return i;
  }
  return -1;
}
function bindEditor() {
  var canvas = $('coverCanvas');
  var dragging = false, moved = false, last = null;
  canvas.addEventListener('pointerdown', function (e) {
    var pt = canvasPoint(e);
    var idx = panelAt(pt);
    if (idx < 0) return;
    pushUndo();
    state.selected = idx;
    dragging = true; moved = false; last = pt;
    canvas.setPointerCapture(e.pointerId);
    render();
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!dragging || !last) return;
    var pt = canvasPoint(e);
    var p = state.panels[state.selected];
    var r = lastRects[state.selected];
    if (!p || !r) return;
    p.ox = clamp(p.ox + (pt.x - last.x) / r.w, -0.6, 0.6);
    p.oy = clamp(p.oy + (pt.y - last.y) / r.h, -0.6, 0.6);
    moved = true; last = pt;
    render();
  });
  canvas.addEventListener('pointerup', function () {
    if (dragging && !moved) { undoStack.pop(); } // plain click: no change to undo
    dragging = false; last = null;
  });
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    var idx = panelAt(canvasPoint(e));
    if (idx < 0) return;
    pushUndo();
    var p = state.panels[idx];
    p.scale = clamp(p.scale * (e.deltaY < 0 ? 1.08 : 0.93), 1, 3);
    render();
  }, { passive: false });

  $('fileInput').addEventListener('change', function (e) {
    var files = Array.prototype.slice.call(e.target.files || []);
    var jobs = files.map(function (f) {
      return new Promise(function (resolve) {
        var reader = new FileReader();
        reader.onload = function () {
          loadImage(reader.result).then(function (img) {
            photos.push({ src: reader.result, name: f.name, img: img });
            resolve();
          }).catch(resolve);
        };
        reader.readAsDataURL(f);
      });
    });
    Promise.all(jobs).then(function () { buildFilmstrip(); render(); });
    e.target.value = '';
  });
  var dz = $('dropZone');
  dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.classList.add('drag'); });
  dz.addEventListener('dragleave', function () { dz.classList.remove('drag'); });
  dz.addEventListener('drop', function (e) {
    e.preventDefault(); dz.classList.remove('drag');
    var files = Array.prototype.slice.call(e.dataTransfer.files || []).filter(function (f) { return f.type.indexOf('image/') === 0; });
    var jobs = files.map(function (f) {
      return new Promise(function (resolve) {
        var reader = new FileReader();
        reader.onload = function () {
          loadImage(reader.result).then(function (img) {
            photos.push({ src: reader.result, name: f.name, img: img });
            resolve();
          }).catch(resolve);
        };
        reader.readAsDataURL(f);
      });
    });
    Promise.all(jobs).then(function () { buildFilmstrip(); render(); });
  });
  $('undoBtn').addEventListener('click', doUndo);
  $('redoBtn').addEventListener('click', doRedo);
  $('titleInput').addEventListener('input', function (e) { state.title = e.target.value.toUpperCase(); render(); });
  $('subtitleInput').addEventListener('input', function (e) { state.subtitle = e.target.value; render(); });
  $('grainToggle').addEventListener('change', function (e) { pushUndo(); state.grain = e.target.checked; render(); });
  $('zoomInBtn').addEventListener('click', function () { pushUndo(); var p = state.panels[state.selected]; if (p) p.scale = clamp(p.scale * 1.15, 1, 3); render(); });
  $('zoomOutBtn').addEventListener('click', function () { pushUndo(); var p = state.panels[state.selected]; if (p) p.scale = clamp(p.scale / 1.15, 1, 3); render(); });
  $('prevPhotoBtn').addEventListener('click', function () {
    pushUndo(); var p = state.panels[state.selected];
    if (p && photos.length) { p.photo = (p.photo - 1 + photos.length) % photos.length; buildFilmstrip(); render(); }
  });
  $('nextPhotoBtn').addEventListener('click', function () {
    pushUndo(); var p = state.panels[state.selected];
    if (p && photos.length) { p.photo = (p.photo + 1) % photos.length; buildFilmstrip(); render(); }
  });
  document.querySelectorAll('[data-export]').forEach(function (b) {
    b.addEventListener('click', function () {
      var parts = b.dataset.export.split('x');
      exportPNG(parseInt(parts[0], 10), parseInt(parts[1], 10)).catch(function (err) {
        $('statusLine').textContent = 'Export failed: ' + err.message;
      });
    });
  });
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); doUndo(); }
    else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); doRedo(); }
  });
}

/* ---- boot ---- */
function boot() {
  var params = new URLSearchParams(window.location.search);
  var shot = params.get('shot');
  buildControlButtons();
  bindEditor();
  syncControls();
  var jobs = SAMPLES.map(function (src, i) { return addPhotoAt(src, i); });
  Promise.all(jobs).then(function () {
    // Samples are all in now: give each panel its own photo.
    state.panels = defaultPanels(LAYOUTS[state.layout].panels().length);
    if (shot === 'cover') {
      $('editor').hidden = true;
      document.querySelector('.topbar').hidden = true;
      document.body.style.overflow = 'hidden';
      $('coverShot').hidden = false;
      state.layout = 'hero3'; state.tone = 'sunset';
      state.title = 'VICE CITY'; state.subtitle = 'Welcome to Leonida';
      ensurePanels();
      var c = $('shotCanvas');
      renderCover(c.getContext('2d'), c.width, c.height, state);
      document.title = 'Vice City — cover shot';
    } else {
      render();
    }
    window.__ready = true;
  }).catch(function (err) {
    var s = $('statusLine');
    if (s) s.textContent = 'Some sample photos failed to load: ' + err.message;
    window.__ready = true;
  });
}
document.addEventListener('DOMContentLoaded', boot);
