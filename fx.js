(function () {
  if (window.__fxInit) return; window.__fxInit = true;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var colors = ['#4ade80', '#86efac', '#34d399'];
  function rgba(hex, a) { var n = parseInt(hex.slice(1), 16); return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
  function start() {
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:45;mix-blend-mode:multiply;opacity:.6;';
    document.body.appendChild(canvas);
    var ctx = canvas.getContext('2d'), dpr = 1, parts = [], lx = null, ly = null;
    function size() { dpr = Math.min(2, window.devicePixelRatio || 1); canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; }
    size(); window.addEventListener('resize', size);
    window.addEventListener('pointermove', function (e) {
      var x = e.clientX * dpr, y = e.clientY * dpr; if (lx == null) { lx = x; ly = y; }
      var vx = (x - lx) * 0.12, vy = (y - ly) * 0.12; lx = x; ly = y;
      var col = colors[(Math.random() * colors.length) | 0];
      for (var i = 0; i < 2; i++) parts.push({ x: x, y: y, vx: vx + (Math.random() - .5) * 1.2, vy: vy + (Math.random() - .5) * 1.2, r: 1 + Math.random() * 1.2, life: 1, col: col });
      if (parts.length > 240) parts.splice(0, parts.length - 240);
    }, { passive: true });
    window.addEventListener('pointerdown', function (e) {
      var x = e.clientX, y = e.clientY, col = colors[(Math.random() * colors.length) | 0];
      var ring = document.createElement('div');
      ring.style.cssText = 'position:fixed;left:' + x + 'px;top:' + y + 'px;width:16px;height:16px;margin:-8px 0 0 -8px;border:2px solid ' + col + ';border-radius:50%;pointer-events:none;z-index:9999;';
      document.body.appendChild(ring);
      ring.animate([{ transform: 'scale(1)', opacity: .9 }, { transform: 'scale(6)', opacity: 0 }], { duration: 650, easing: 'cubic-bezier(.2,.7,.2,1)' }).onfinish = function () { ring.remove(); };
      for (var i = 0; i < 8; i++) {
        (function (i) {
          var p = document.createElement('div'), a = Math.PI * 2 * i / 8, d = 26 + Math.random() * 20;
          p.style.cssText = 'position:fixed;left:' + x + 'px;top:' + y + 'px;width:6px;height:6px;margin:-3px 0 0 -3px;background:' + col + ';border-radius:50%;pointer-events:none;z-index:9999;';
          document.body.appendChild(p);
          p.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: 'translate(' + (Math.cos(a) * d) + 'px,' + (Math.sin(a) * d) + 'px) scale(0)', opacity: 0 }], { duration: 600, easing: 'cubic-bezier(.2,.7,.2,1)' }).onfinish = function () { p.remove(); };
        })(i);
      }
    }, { passive: true });
    (function loop() {
      ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i]; p.x += p.vx; p.y += p.vy; var nx = -p.vy, ny = p.vx; p.vx += nx * 0.02; p.vy += ny * 0.02; p.vx *= 0.94; p.vy *= 0.94; p.life -= 0.012;
        var r = p.r * (0.6 + p.life * 0.8) * dpr, al = Math.max(0, p.life) * 0.5;
        var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, rgba(p.col, al)); g.addColorStop(1, rgba(p.col, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill();
      }
      parts = parts.filter(function (p) { return p.life > 0; });
      requestAnimationFrame(loop);
    })();
  }
  if (document.body) start(); else window.addEventListener('DOMContentLoaded', start);
})();