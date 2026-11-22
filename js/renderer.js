(function (G) {
  "use strict";

  // Pre-rendered procedural ground texture cache per track ID
  const patternCache = {};
  const weatherDrops = [];
  for (let i = 0; i < 95; i++) {
    weatherDrops.push({
      x: Math.random(),
      y: Math.random(),
      spd: 0.55 + Math.random() * 0.75,
      size: 1.5 + Math.random() * 2.5,
      drift: (Math.random() - 0.5) * 0.25,
    });
  }

  function getGroundPattern(ctx, trackDef) {
    if (patternCache[trackDef.id]) return patternCache[trackDef.id];
    const tile = document.createElement('canvas');
    tile.width = 128;
    tile.height = 128;
    const tctx = tile.getContext('2d');
    const th = trackDef.theme;
    tctx.fillStyle = th.ground;
    tctx.fillRect(0, 0, 128, 128);

    const rand = G.mulberry32(trackDef.seed + 7);
    for (let i = 0; i < 90; i++) {
      const x = rand() * 128;
      const y = rand() * 128;
      tctx.fillStyle = rand() > 0.5 ? th.patchDark : th.patchLight;
      if (trackDef.id === 'emerald') {
        tctx.fillRect(x, y, 2, 5);
      } else if (trackDef.id === 'alpine') {
        tctx.beginPath();
        tctx.arc(x, y, 1 + rand() * 2, 0, Math.PI * 2);
        tctx.fill();
      } else {
        tctx.fillRect(x, y, 3, 2);
      }
    }
    const pat = ctx.createPattern(tile, 'repeat');
    patternCache[trackDef.id] = pat;
    return pat;
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCarSprite(ctx, x, y, angle, carDef, opts) {
    opts = opts || {};
    const steer = opts.steer || 0;
    const braking = !!opts.braking;
    const boosting = !!opts.boosting;
    const night = !!opts.night;
    const ghost = !!opts.ghost;

    const style = carDef.style || 'gt';
    const L = style === 'f1' ? 50 : (style === 'rally' ? 44 : 47);
    const Wd = style === 'f1' ? 22 : (style === 'rally' ? 25 : 24);
    const nightAmt = typeof opts.night === 'number' ? opts.night : (opts.night ? 1 : 0);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    if (ghost) ctx.globalAlpha = 0.45;

    // Headlight cones (bright on night track, smoothly faded during highway twilight)
    if (!ghost && nightAmt > 0.02) {
      const grad = ctx.createRadialGradient(L * 0.45, 0, 4, L * 0.45 + 150, 0, 170);
      grad.addColorStop(0, 'rgba(255,250,220,' + (0.42 * nightAmt) + ')');
      grad.addColorStop(0.55, 'rgba(220,240,255,' + (0.14 * nightAmt) + ')');
      grad.addColorStop(1, 'rgba(220,240,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(L * 0.45, -Wd * 0.32);
      ctx.lineTo(L * 0.45 + 230, -88);
      ctx.lineTo(L * 0.45 + 230, 88);
      ctx.lineTo(L * 0.45, Wd * 0.32);
      ctx.closePath();
      ctx.fill();
    }

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    roundRectPath(ctx, -L / 2 + 3, -Wd / 2 + 5, L, Wd, 7);
    ctx.fill();

    // Boost exhaust glow
    if (boosting && !ghost) {
      const fl = 14 + Math.random() * 14;
      const g = ctx.createLinearGradient(-L / 2, 0, -L / 2 - fl, 0);
      g.addColorStop(0, '#38bdf8');
      g.addColorStop(0.5, '#f97316');
      g.addColorStop(1, 'rgba(249,115,22,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-L / 2, -5);
      ctx.lineTo(-L / 2 - fl, 0);
      ctx.lineTo(-L / 2, 5);
      ctx.closePath();
      ctx.fill();
    }

    // Wheels (front wheels visibly rotate with steer!)
    const wx = L * 0.31;
    const wy = Wd * 0.5 + (style === 'f1' ? 1.5 : -0.5);
    const wheelCol = style === 'rally' ? '#1e293b' : '#111318';

    function drawWheel(px, py, rot) {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(rot);
      ctx.fillStyle = wheelCol;
      roundRectPath(ctx, -5.5, -3.5, 11, 7, 2);
      ctx.fill();
      if (style === 'rally') {
        ctx.fillStyle = '#facc15';
        ctx.fillRect(-2, -1.5, 4, 3);
      }
      ctx.restore();
    }

    drawWheel(-wx, -wy, 0);
    drawWheel(-wx,  wy, 0);
    drawWheel( wx, -wy, steer * 0.72);
    drawWheel( wx,  wy, steer * 0.72);

    // Body by car class
    if (style === 'f1') {
      // Rear wing
      ctx.fillStyle = carDef.accent;
      roundRectPath(ctx, -L / 2 - 1, -Wd / 2 - 1, 7, Wd + 2, 2);
      ctx.fill();
      // Tapered chassis
      ctx.fillStyle = carDef.color;
      ctx.beginPath();
      ctx.moveTo(-L / 2 + 4, -Wd * 0.42);
      ctx.lineTo(L * 0.12, -Wd * 0.36);
      ctx.lineTo(L * 0.48, -Wd * 0.16);
      ctx.lineTo(L * 0.48, Wd * 0.16);
      ctx.lineTo(L * 0.12, Wd * 0.36);
      ctx.lineTo(-L / 2 + 4, Wd * 0.42);
      ctx.closePath();
      ctx.fill();
      // Front wing
      ctx.fillStyle = carDef.accent;
      roundRectPath(ctx, L / 2 - 6, -Wd / 2 - 1, 6, Wd + 2, 2);
      ctx.fill();
      // Cockpit + helmet
      ctx.fillStyle = '#0f172a';
      roundRectPath(ctx, -6, -5.5, 15, 11, 4);
      ctx.fill();
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Main coupe/hatch body
      ctx.fillStyle = carDef.color;
      roundRectPath(ctx, -L / 2, -Wd / 2, L, Wd, 7);
      ctx.fill();

      // Style accents
      if (style === 'gt') {
        // Center racing stripe
        ctx.fillStyle = carDef.accent;
        ctx.fillRect(-L / 2 + 2, -2.5, L - 4, 5);
      } else if (style === 'drift') {
        // Carbon hood + rear wing
        ctx.fillStyle = '#1e293b';
        roundRectPath(ctx, L * 0.12, -Wd / 2 + 3, L * 0.34, Wd - 6, 3);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        roundRectPath(ctx, -L / 2 + 1, -Wd / 2 + 1, 5, Wd - 2, 2);
        ctx.fill();
      } else if (style === 'rally') {
        // Side stripes + roof scoop
        ctx.fillStyle = carDef.accent;
        ctx.fillRect(-L / 2 + 4, -Wd / 2 + 2, L - 8, 2.5);
        ctx.fillRect(-L / 2 + 4, Wd / 2 - 4.5, L - 8, 2.5);
      }

      // Cabin
      ctx.fillStyle = 'rgba(15,23,42,0.92)';
      roundRectPath(ctx, -L * 0.2, -Wd / 2 + 3.5, L * 0.42, Wd - 7, 4);
      ctx.fill();

      // Windshield highlight
      ctx.fillStyle = 'rgba(186,230,253,0.42)';
      roundRectPath(ctx, L * 0.12, -Wd / 2 + 5, 6, Wd - 10, 2);
      ctx.fill();

      if (style === 'rally') {
        ctx.fillStyle = '#f8fafc';
        roundRectPath(ctx, -3, -3.5, 8, 7, 2);
        ctx.fill();
      }
    }

    // Headlights
    ctx.fillStyle = '#fef9c3';
    ctx.fillRect(L / 2 - 2.5, -Wd / 2 + 3.5, 2.5, 4.5);
    ctx.fillRect(L / 2 - 2.5, Wd / 2 - 8, 2.5, 4.5);

    // Brake lights
    ctx.fillStyle = braking ? '#ff2a2a' : '#7f1d1d';
    ctx.fillRect(-L / 2, -Wd / 2 + 3, 2.5, 5);
    ctx.fillRect(-L / 2, Wd / 2 - 8, 2.5, 5);
    if (braking && !ghost) {
      ctx.fillStyle = 'rgba(255,40,40,0.45)';
      ctx.beginPath();
      ctx.arc(-L / 2 - 2, -Wd / 2 + 5.5, 7, 0, Math.PI * 2);
      ctx.arc(-L / 2 - 2, Wd / 2 - 5.5, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawTrafficCar(ctx, t, night) {
    const L = t.len, Wd = t.wid;
    const nightAmt = typeof night === 'number' ? night : (night ? 1 : 0);
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.angle);

    if (nightAmt > 0.02) {
      const grad = ctx.createRadialGradient(L * 0.45, 0, 2, L * 0.45 + 90, 0, 95);
      grad.addColorStop(0, 'rgba(255,245,200,' + (0.28 * nightAmt) + ')');
      grad.addColorStop(1, 'rgba(255,245,200,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(L * 0.45, -Wd * 0.3);
      ctx.lineTo(L * 0.45 + 125, -45);
      ctx.lineTo(L * 0.45 + 125, 45);
      ctx.lineTo(L * 0.45, Wd * 0.3);
      ctx.closePath();
      ctx.fill();
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    roundRectPath(ctx, -L / 2 + 3, -Wd / 2 + 5, L, Wd, 5);
    ctx.fill();

    // Body
    ctx.fillStyle = t.color;
    roundRectPath(ctx, -L / 2, -Wd / 2, L, Wd, t.kind === 'truck' ? 4 : 6);
    ctx.fill();

    if (t.kind === 'truck') {
      // Cab + cargo divider
      ctx.fillStyle = 'rgba(15,23,42,0.85)';
      roundRectPath(ctx, L * 0.16, -Wd / 2 + 3, L * 0.24, Wd - 6, 3);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(L * 0.1, -Wd / 2 + 1, 3, Wd - 2);
    } else if (t.kind === 'van') {
      ctx.fillStyle = 'rgba(15,23,42,0.85)';
      roundRectPath(ctx, L * 0.1, -Wd / 2 + 3.5, L * 0.28, Wd - 7, 3);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(15,23,42,0.88)';
      roundRectPath(ctx, -L * 0.18, -Wd / 2 + 3.5, L * 0.38, Wd - 7, 4);
      ctx.fill();
    }

    // Headlights & taillights
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(L / 2 - 2, -Wd / 2 + 3, 2, 4);
    ctx.fillRect(L / 2 - 2, Wd / 2 - 7, 2, 4);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-L / 2, -Wd / 2 + 3, 2, 4);
    ctx.fillRect(-L / 2, Wd / 2 - 7, 2, 4);

    ctx.restore();
  }

  function drawProp(ctx, p, night) {
    if (p.type === 'tree') {
      ctx.fillStyle = 'rgba(0,0,0,0.26)';
      ctx.beginPath();
      ctx.ellipse(p.x + 6, p.y + 8, p.r, p.r * 0.82, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.shade > 0.5 ? '#1b3a20' : '#224728';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.shade > 0.5 ? '#2e6136' : '#356f3f';
      ctx.beginPath();
      ctx.arc(p.x - p.r * 0.22, p.y - p.r * 0.22, p.r * 0.68, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'pine') {
      ctx.fillStyle = 'rgba(15,23,42,0.22)';
      ctx.beginPath();
      ctx.ellipse(p.x + 5, p.y + 7, p.r, p.r * 0.82, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e3a34';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2d5a4f';
      ctx.beginPath();
      ctx.arc(p.x - 2, p.y - 2, p.r * 0.72, 0, Math.PI * 2);
      ctx.fill();
      // Snow cap
      ctx.fillStyle = 'rgba(241,245,249,0.85)';
      ctx.beginPath();
      ctx.arc(p.x - p.r * 0.18, p.y - p.r * 0.18, p.r * 0.42, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'rock') {
      ctx.fillStyle = '#57534e';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#a8a29e';
      ctx.beginPath();
      ctx.arc(p.x - p.r * 0.25, p.y - p.r * 0.25, p.r * 0.52, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'mesa') {
      ctx.fillStyle = 'rgba(0,0,0,0.24)';
      ctx.beginPath();
      ctx.arc(p.x + 8, p.y + 10, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7c2d12';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#9a3412';
      ctx.beginPath();
      ctx.arc(p.x - 3, p.y - 3, p.r * 0.72, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c2410c';
      ctx.beginPath();
      ctx.arc(p.x - 5, p.y - 5, p.r * 0.42, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'cactus') {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.arc(p.x + 3, p.y + 4, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#15803d';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(p.x - 2, p.y - 2, p.r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'building') {
      const bx = p.x - p.w / 2, by = p.y - p.h / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(bx + 8, by + 10, p.w, p.h);
      ctx.fillStyle = '#161f33';
      ctx.fillRect(bx, by, p.w, p.h);
      ctx.strokeStyle = p.hue;
      ctx.globalAlpha = night ? 0.55 : 0.25;
      ctx.lineWidth = 2;
      ctx.strokeRect(bx + 1, by + 1, p.w - 2, p.h - 2);
      ctx.globalAlpha = 1;
      // Rooftop details / lit skylight grid
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(bx + 10, by + 10, p.w - 20, p.h - 20);
      ctx.fillStyle = p.hue;
      ctx.globalAlpha = 0.22;
      ctx.fillRect(bx + 14, by + 14, Math.max(8, p.w * 0.25), Math.max(8, p.h * 0.25));
      ctx.globalAlpha = 1;
    }
  }

  // Color parsing & interpolation for smooth highway biome transitions
  const colorCache = {};
  function parseColor(str) {
    if (colorCache[str]) return colorCache[str];
    let res = [0, 0, 0, 1];
    if (str[0] === '#') {
      const h = str.slice(1);
      res = [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
        1,
      ];
    } else {
      const m = str.match(/[\d.]+/g);
      if (m && m.length >= 3) {
        res = [Number(m[0]), Number(m[1]), Number(m[2]), m[3] != null ? Number(m[3]) : 1];
      }
    }
    colorCache[str] = res;
    return res;
  }

  function lerpColor(a, b, t) {
    if (t <= 0.001) return a;
    if (t >= 0.999) return b;
    const ca = parseColor(a), cb = parseColor(b);
    const r = Math.round(ca[0] + (cb[0] - ca[0]) * t);
    const g = Math.round(ca[1] + (cb[1] - ca[1]) * t);
    const bl = Math.round(ca[2] + (cb[2] - ca[2]) * t);
    const al = ca[3] + (cb[3] - ca[3]) * t;
    return 'rgba(' + r + ',' + g + ',' + bl + ',' + al.toFixed(3) + ')';
  }

  function renderHighway(ctx, mctx, sim, W, H, DPR, dt, camMode) {
    const hw = sim.highway;
    const bDef = hw.biome;
    const nDef = hw.nextBiome || bDef;
    const blend = hw.blend || 0;
    const thA = bDef.theme;
    const thB = nDef.theme;

    const bgCol = lerpColor(thA.bg, thB.bg, blend);
    const shoulderCol = lerpColor(thA.shoulder, thB.shoulder, blend);
    const asphaltCol = lerpColor(thA.asphalt, thB.asphalt, blend);
    const edgeCol = lerpColor(thA.edgeLine, thB.edgeLine, blend);
    const dashCol = lerpColor(thA.asphaltLine, thB.asphaltLine, blend);
    const nightAmt = (thA.night ? 1 : 0) * (1 - blend) + (thB.night ? 1 : 0) * blend;
    const rainAmt = (thA.weather === 'rain' ? 1 - blend : 0) + (thB.weather === 'rain' ? blend : 0);
    const snowAmt = (thA.weather === 'snow' ? 1 - blend : 0) + (thB.weather === 'snow' ? blend : 0);

    const c = sim.car;
    const cam = sim.cam;
    const halfW = hw.roadW / 2;

    const speedAbs = Math.hypot(c.vx, c.vy);
    const speedNorm = Math.min(speedAbs / (sim.carDef.phys.maxSpeed * 1.12), 1.2);
    dt = Math.min(dt, 0.08) || 1 / 60;

    // Smooth zoom out at high speed so forward visibility expands as you go faster
    const baseScale = camMode === 'tight' ? 1.36 : 1.22;
    const targetScale = Math.max(0.74, baseScale - Math.min(speedNorm, 1.15) * 0.38 - (c.boosting ? 0.06 : 0));
    cam.scale += (targetScale - cam.scale) * Math.min(1, 3.2 * dt);
    const scale = cam.scale;

    // Zero-lag forward tracking: keep car anchored in the lower quarter (~73% down screen)
    // so ~73% of the screen is ALWAYS open highway ahead regardless of speed!
    const desiredLookX = (H / scale) * (camMode === 'tight' ? 0.19 : 0.24);
    if (cam.lookX == null) cam.lookX = desiredLookX;
    cam.lookX += (desiredLookX - cam.lookX) * Math.min(1, 4.5 * dt);
    cam.x = c.x + cam.lookX;

    // Gentle lateral follow
    const targetY = c.y * 0.35;
    cam.y += (targetY - cam.y) * Math.min(1, 6.0 * dt);
    const shakeX = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake * 14 : 0;
    const shakeY = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake * 14 : 0;

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = bgCol;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W / 2 + shakeX, H / 2 + shakeY);
    ctx.scale(scale, scale);
    // Rotate -90 deg so world +x (forward) points straight UP and +y points RIGHT
    ctx.rotate(-Math.PI / 2);
    ctx.translate(-cam.x, -cam.y);

    // Visible world bounds (rotated: screen H maps to world x, screen W maps to world y)
    const halfFwd = (H / scale) / 2 + 160;
    const halfLat = (W / scale) / 2 + 160;
    const viewL = cam.x - halfFwd;
    const viewR = cam.x + halfFwd;
    const viewT = cam.y - halfLat;
    const viewB = cam.y + halfLat;

    // Infinite tiled ground pattern with smooth crossfade into next biome
    ctx.fillStyle = getGroundPattern(ctx, bDef);
    ctx.fillRect(viewL, viewT, viewR - viewL, viewB - viewT);
    if (blend > 0.005 && nDef !== bDef) {
      ctx.globalAlpha = blend;
      ctx.fillStyle = getGroundPattern(ctx, nDef);
      ctx.fillRect(viewL, viewT, viewR - viewL, viewB - viewT);
      ctx.globalAlpha = 1;
    }

    // Terrain patches (each patch retains its own region's shading)
    for (let i = 0; i < hw.patches.length; i++) {
      const p = hw.patches[i];
      if (p.x + p.rx < viewL || p.x - p.rx > viewR) continue;
      ctx.fillStyle = p.color || (p.dark ? thA.patchDark : thA.patchLight);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.rx, p.ry, p.a, 0, Math.PI * 2);
      ctx.fill();
    }

    // Scenic passing ponds
    for (let i = 0; i < hw.ponds.length; i++) {
      const p = hw.ponds[i];
      if (p.x + p.rx < viewL || p.x - p.rx > viewR) continue;
      ctx.fillStyle = '#c2b280';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.rx + 10, p.ry + 10, p.a, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0ea5e9';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.rx, p.ry, p.a, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.beginPath();
      ctx.ellipse(p.x - p.rx * 0.2, p.y - p.ry * 0.2, p.rx * 0.5, p.ry * 0.35, p.a, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- 3-Lane Scenic Highway ----
    const roadX = viewL - 40;
    const roadLen = (viewR - viewL) + 80;

    // Paved shoulders & guardrail strips
    ctx.fillStyle = shoulderCol;
    ctx.fillRect(roadX, -(halfW + 24), roadLen, hw.roadW + 48);

    // Subtle metallic guardrail lines
    ctx.fillStyle = 'rgba(226,232,240,0.45)';
    ctx.fillRect(roadX, -(halfW + 22), roadLen, 4);
    ctx.fillRect(roadX, halfW + 18, roadLen, 4);

    // Asphalt surface
    ctx.fillStyle = asphaltCol;
    ctx.fillRect(roadX, -halfW, roadLen, hw.roadW);

    // Subtle darker tire tracks in the 3 lanes
    ctx.fillStyle = 'rgba(0,0,0,0.09)';
    for (let li = 0; li < 3; li++) {
      ctx.fillRect(roadX, hw.laneYs[li] - 16, roadLen, 32);
    }

    // Solid outer edge lines
    ctx.fillStyle = edgeCol;
    ctx.fillRect(roadX, -halfW + 4, roadLen, 3);
    ctx.fillRect(roadX, halfW - 7, roadLen, 3);

    // Dashed lane dividers (aligned to world x so they rush past smoothly)
    const dashStep = 72;
    const firstDash = Math.floor(viewL / dashStep) * dashStep;
    ctx.fillStyle = dashCol;
    for (let dx = firstDash; dx < viewR; dx += dashStep) {
      ctx.fillRect(dx, -33 - 1.75, 34, 3.5);
      ctx.fillRect(dx,  33 - 1.75, 34, 3.5);
    }

    // Scenery props
    for (let i = 0; i < hw.props.length; i++) {
      const p = hw.props[i];
      const pad = p.r || Math.max(p.w || 40, p.h || 40);
      if (p.x + pad < viewL || p.x - pad > viewR || p.y + pad < viewT || p.y - pad > viewB) continue;
      drawProp(ctx, p, nightAmt > 0.35);
    }

    // Streetlamps (always draw any streamed night lamps ahead/around with smooth glow)
    if (hw.lamps.length > 0) {
      const lampGlow = Math.max(0.25, nightAmt);
      for (let i = 0; i < hw.lamps.length; i++) {
        const l = hw.lamps[i];
        if (l.x + 110 < viewL || l.x - 110 > viewR) continue;
        const grd = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, 95);
        grd.addColorStop(0, 'rgba(56,189,248,' + (0.34 * lampGlow) + ')');
        grd.addColorStop(0.5, 'rgba(232,121,249,' + (0.11 * lampGlow) + ')');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(l.x, l.y, 95, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e0f2fe';
        ctx.beginPath();
        ctx.arc(l.x, l.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Particles
    for (let i = 0; i < sim.particles.length; i++) {
      const p = sim.particles[i];
      const a = Math.max(0, p.life / p.maxLife) * 0.6;
      ctx.fillStyle = p.color + a + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1.35 - a * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }

    // Highway traffic
    for (let i = 0; i < sim.traffic.length; i++) {
      const t = sim.traffic[i];
      if (t.x + 80 < viewL || t.x - 80 > viewR) continue;
      drawTrafficCar(ctx, t, nightAmt);
    }

    // Player car
    drawCarSprite(ctx, c.x, c.y, c.angle, sim.carDef, {
      steer: c.steer,
      braking: c.brake > 0.15,
      boosting: c.boosting,
      night: nightAmt,
    });

    // Overhead highway milestone gantries (text oriented horizontally upright on screen)
    ctx.font = '800 10px "SF Mono", ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < hw.signs.length; i++) {
      const sg = hw.signs[i];
      if (sg.x + 40 < viewL || sg.x - 40 > viewR) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(sg.x - 10, -(halfW + 18), 14, hw.roadW + 36);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(sg.x - 6, -(halfW + 20), 12, hw.roadW + 40);
      ctx.fillStyle = '#065f46';
      ctx.fillRect(sg.x - 10, -82, 20, 164);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(sg.x - 10, -82, 20, 164);
      ctx.save();
      ctx.translate(sg.x, 0);
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(sg.label, 0, 3.5);
      ctx.restore();
    }

    // Popups (rotated upright so text reads horizontally on screen)
    ctx.font = '800 13px "SF Mono", ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < sim.popups.length; i++) {
      const p = sim.popups[i];
      const alpha = Math.min(1, (p.life / p.maxLife) * 1.6);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.PI / 2);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillText(p.text, 1.5, 1.5);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    // Smoothly faded screen-space weather (rain / snow)
    if (rainAmt > 0.02 || snowAmt > 0.02) {
      const isRain = rainAmt >= snowAmt;
      const wAmt = isRain ? rainAmt : snowAmt;
      ctx.strokeStyle = 'rgba(186,230,253,' + (0.28 * wAmt) + ')';
      ctx.fillStyle = 'rgba(255,255,255,' + (0.65 * wAmt) + ')';
      ctx.lineWidth = 1.4;
      for (let i = 0; i < weatherDrops.length; i++) {
        const d = weatherDrops[i];
        d.y = (d.y + dt * (isRain ? 1.45 : 0.16) * d.spd) % 1;
        d.x = (d.x + dt * (isRain ? -0.22 : d.drift) + 1) % 1;
        const px = d.x * W, py = d.y * H;
        if (isRain) {
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px - 6, py + 18);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(px, py, d.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Vertical speed lines rushing downward along left & right edges
    if (speedNorm > 0.52 || c.boosting) {
      const intensity = c.boosting ? 0.95 : Math.min(1, (speedNorm - 0.52) / 0.48);
      const count = Math.floor(15 * intensity);
      ctx.strokeStyle = c.boosting
        ? 'rgba(56,189,248,' + (0.24 * intensity) + ')'
        : 'rgba(255,255,255,' + (0.16 * intensity) + ')';
      ctx.lineWidth = c.boosting ? 2.4 : 1.8;
      const cx = W / 2;
      for (let i = 0; i < count; i++) {
        const sx = Math.random() * W;
        if (Math.abs(sx - cx) < W * 0.16) continue;
        const sy = Math.random() * H;
        const len = 55 + Math.random() * 140 * intensity;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx, sy + len);
        ctx.stroke();
      }
    }

    // Smooth vignette
    const vigAlpha = 0.30 + nightAmt * 0.22;
    const vgrad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.78);
    vgrad.addColorStop(0, 'rgba(0,0,0,0)');
    vgrad.addColorStop(1, 'rgba(0,0,0,' + vigAlpha + ')');
    ctx.fillStyle = vgrad;
    ctx.fillRect(0, 0, W, H);

    // Vertical Highway Radar Minimap
    if (mctx) drawHighwayRadar(mctx, sim, lerpColor(thA.minimapBg, thB.minimapBg, blend), asphaltCol);
  }

  function drawHighwayRadar(mctx, sim, bgCol, asphaltCol) {
    const hw = sim.highway;
    const mw = mctx.canvas.width, mh = mctx.canvas.height;

    mctx.clearRect(0, 0, mw, mh);
    mctx.fillStyle = bgCol;
    mctx.fillRect(0, 0, mw, mh);

    // Draw vertical 3-lane highway strip centered in radar
    const stripW = 66;
    const sx = (mw - stripW) / 2;
    mctx.fillStyle = asphaltCol;
    mctx.fillRect(sx, 0, stripW, mh);
    mctx.strokeStyle = 'rgba(255,255,255,0.28)';
    mctx.lineWidth = 1;
    mctx.setLineDash([6, 6]);
    mctx.beginPath();
    mctx.moveTo(sx + stripW / 3, 0);
    mctx.lineTo(sx + stripW / 3, mh);
    mctx.moveTo(sx + (stripW * 2) / 3, 0);
    mctx.lineTo(sx + (stripW * 2) / 3, mh);
    mctx.stroke();
    mctx.setLineDash([]);

    // Traffic blips relative to player (player sits near bottom at y = 78%, driving UP)
    const py = mh * 0.78;
    const rangeX = 1900; // world px ahead shown on radar
    for (let i = 0; i < sim.traffic.length; i++) {
      const t = sim.traffic[i];
      const ry = py - ((t.x - sim.car.x) / rangeX) * (mh * 0.78);
      if (ry < -8 || ry > mh + 8) continue;
      const rx = mw / 2 + (t.y / hw.roadW) * stripW;
      mctx.fillStyle = t.color;
      mctx.fillRect(rx - 2.5, ry - 4, 5, 8);
    }

    // Player upward chevron
    const px = mw / 2 + (sim.car.y / hw.roadW) * stripW;
    mctx.fillStyle = sim.carDef.color;
    mctx.strokeStyle = '#ffffff';
    mctx.lineWidth = 1.4;
    mctx.beginPath();
    mctx.moveTo(px, py - 6);
    mctx.lineTo(px - 4, py + 4);
    mctx.lineTo(px, py + 2);
    mctx.lineTo(px + 4, py + 4);
    mctx.closePath();
    mctx.fill();
    mctx.stroke();

    // Label
    mctx.fillStyle = 'rgba(248,250,252,0.65)';
    mctx.font = '700 9px "SF Mono", ui-monospace, monospace';
    mctx.fillText('RADAR', 8, 14);
  }

  function render(ctx, mctx, sim, W, H, DPR, dt, camMode) {
    if (sim.modeId === 'highway' && sim.highway && sim.race.state !== 'menu') {
      renderHighway(ctx, mctx, sim, W, H, DPR, dt, camMode);
      return;
    }
    const tr = sim.track;
    const th = tr.def.theme;
    const c = sim.car;
    const cam = sim.cam;

    const speedAbs = Math.hypot(c.vx, c.vy);
    const speedNorm = Math.min(speedAbs / sim.carDef.phys.maxSpeed, 1.2);
    dt = Math.min(dt, 0.08) || 1 / 60;

    // Camera target
    if (sim.race.state === 'menu') {
      // Gentle scenic orbit around the start area on menu
      const t = performance.now() * 0.00018;
      const targetX = tr.startPt.x + Math.cos(t) * 240;
      const targetY = tr.startPt.y + Math.sin(t) * 160;
      cam.x += (targetX - cam.x) * Math.min(1, 2.5 * dt);
      cam.y += (targetY - cam.y) * Math.min(1, 2.5 * dt);
      cam.scale += (1.1 - cam.scale) * Math.min(1, 2.5 * dt);
    } else {
      const lookFactor = camMode === 'tight' ? 0.16 : 0.27;
      const lookX = Math.cos(c.angle) * speedAbs * lookFactor;
      const lookY = Math.sin(c.angle) * speedAbs * lookFactor;
      const targetX = c.x + lookX;
      const targetY = c.y + lookY;
      const stiff = 28, damp = 2 * Math.sqrt(stiff);
      cam.vx += ((targetX - cam.x) * stiff - cam.vx * damp) * dt;
      cam.vy += ((targetY - cam.y) * stiff - cam.vy * damp) * dt;
      cam.x += cam.vx * dt;
      cam.y += cam.vy * dt;

      const baseScale = camMode === 'tight' ? 1.62 : 1.44;
      const targetScale = baseScale - Math.min(speedNorm, 1) * 0.44 - (c.boosting ? 0.06 : 0);
      cam.scale += (targetScale - cam.scale) * Math.min(1, 3.4 * dt);
    }

    const scale = cam.scale;
    const shakeX = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake * 14 : 0;
    const shakeY = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake * 14 : 0;

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = th.bg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W / 2 + shakeX, H / 2 + shakeY);
    ctx.scale(scale, scale);
    ctx.translate(-cam.x, -cam.y);

    // Visible world culling bounds
    const vw = W / scale, vh = H / scale;
    const viewL = cam.x - vw / 2 - 120;
    const viewR = cam.x + vw / 2 + 120;
    const viewT = cam.y - vh / 2 - 120;
    const viewB = cam.y + vh / 2 + 120;

    // Ground with procedural pattern
    ctx.fillStyle = getGroundPattern(ctx, tr.def);
    ctx.fillRect(0, 0, tr.def.world.w, tr.def.world.h);

    // Terrain patches
    for (let i = 0; i < tr.patches.length; i++) {
      const p = tr.patches[i];
      if (p.x + p.rx < viewL || p.x - p.rx > viewR || p.y + p.ry < viewT || p.y - p.ry > viewB) continue;
      ctx.fillStyle = p.dark ? th.patchDark : th.patchLight;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.rx, p.ry, p.a, 0, Math.PI * 2);
      ctx.fill();
    }

    // Scenic pond (Emerald)
    if (tr.pond) {
      const p = tr.pond;
      ctx.fillStyle = '#c2b280';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.rx + 10, p.ry + 10, p.a, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0ea5e9';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.rx, p.ry, p.a, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.beginPath();
      ctx.ellipse(p.x - p.rx * 0.2, p.y - p.ry * 0.2, p.rx * 0.5, p.ry * 0.38, p.a, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- Road layers ----
    const pts = tr.points;
    const N = tr.N;
    const rw = tr.def.roadW;

    function traceTrack() {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i <= N; i++) {
        const pt = pts[i % N];
        ctx.lineTo(pt.x, pt.y);
      }
    }

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Outer shoulder
    traceTrack();
    ctx.strokeStyle = th.shoulder;
    ctx.lineWidth = rw + 22;
    ctx.stroke();

    // Edge border
    traceTrack();
    ctx.strokeStyle = th.edgeLine;
    ctx.lineWidth = rw + 4;
    ctx.stroke();

    // Main asphalt
    traceTrack();
    ctx.strokeStyle = th.asphalt;
    ctx.lineWidth = rw;
    ctx.stroke();

    // Subtle dark racing groove
    traceTrack();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = rw * 0.58;
    ctx.stroke();

    // Ice patches on Alpine
    for (let i = 0; i < tr.icePatches.length; i++) {
      const ip = tr.icePatches[i];
      if (ip.x + ip.rx < viewL || ip.x - ip.rx > viewR || ip.y + ip.rx < viewT || ip.y - ip.rx > viewB) continue;
      ctx.save();
      ctx.translate(ip.x, ip.y);
      ctx.rotate(ip.angle);
      ctx.fillStyle = 'rgba(186,230,253,0.34)';
      ctx.beginPath();
      ctx.ellipse(0, 0, ip.rx, ip.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // Center dashed line
    traceTrack();
    ctx.strokeStyle = th.asphaltLine;
    ctx.lineWidth = 3.5;
    ctx.setLineDash([24, 30]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Curvature-based racing curbs
    ctx.lineWidth = 8;
    ctx.lineCap = 'butt';
    for (let i = 0; i < tr.curbs.length; i++) {
      const cb = tr.curbs[i];
      if (cb.x1 < viewL && cb.x2 < viewL) continue;
      if (cb.x1 > viewR && cb.x2 > viewR) continue;
      if (cb.y1 < viewT && cb.y2 < viewT) continue;
      if (cb.y1 > viewB && cb.y2 > viewB) continue;
      ctx.strokeStyle = cb.alt ? th.curbA : th.curbB;
      ctx.beginPath();
      ctx.moveTo(cb.x1, cb.y1);
      ctx.lineTo(cb.x2, cb.y2);
      ctx.stroke();
    }

    // Corner chevron signs
    for (let i = 0; i < tr.chevrons.length; i++) {
      const ch = tr.chevrons[i];
      if (ch.x < viewL || ch.x > viewR || ch.y < viewT || ch.y > viewB) continue;
      ctx.save();
      ctx.translate(ch.x, ch.y);
      ctx.rotate(ch.angle);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-10, -5, 20, 10);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-4, -3);
      ctx.lineTo(2, 0);
      ctx.lineTo(-4, 3);
      ctx.stroke();
      ctx.restore();
    }

    // Persistent tire skidmarks
    ctx.lineWidth = 3.6;
    ctx.lineCap = 'round';
    for (let i = 0; i < sim.skids.length; i++) {
      const s = sim.skids[i];
      if (s.x1 < viewL && s.x2 < viewL) continue;
      if (s.x1 > viewR && s.x2 > viewR) continue;
      if (s.y1 < viewT && s.y2 < viewT) continue;
      if (s.y1 > viewB && s.y2 > viewB) continue;
      ctx.strokeStyle = s.color + s.alpha + ')';
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    }

    // Checkered Start/Finish Line
    const sPt = tr.startPt;
    const sTan = tr.startTan;
    const sNx = -sTan.y, sNy = sTan.x;
    const cols = 8, rows = 2, band = 16;
    const cellW = (rw - 6) / cols, cellH = band / rows;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const off = -rw / 2 + 3 + (col + 0.5) * cellW;
        const along = (r + 0.5) * cellH - band / 2;
        const px = sPt.x + sNx * off + sTan.x * along;
        const py = sPt.y + sNy * off + sTan.y * along;
        ctx.fillStyle = (r + col) % 2 === 0 ? '#f8fafc' : '#111827';
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(sTan.angle);
        ctx.fillRect(-cellH / 2, -cellW / 2, cellH, cellW);
        ctx.restore();
      }
    }

    // Grandstand near start/finish
    if (tr.grandstand) {
      const g = tr.grandstand;
      if (g.x + 140 > viewL && g.x - 140 < viewR && g.y + 140 > viewT && g.y - 140 < viewB) {
        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.rotate(g.angle);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        roundRectPath(ctx, -g.w / 2 + 5, -g.h / 2 + 6, g.w, g.h, 6);
        ctx.fill();
        ctx.fillStyle = '#334155';
        roundRectPath(ctx, -g.w / 2, -g.h / 2, g.w, g.h, 6);
        ctx.fill();
        // Bleacher rows
        const rowColors = ['#ef4444', '#facc15', '#38bdf8', '#f8fafc'];
        for (let r = 0; r < 3; r++) {
          ctx.fillStyle = '#475569';
          ctx.fillRect(-g.w / 2 + 8, -g.h / 2 + 6 + r * 11, g.w - 16, 7);
          for (let sx = -g.w / 2 + 14; sx < g.w / 2 - 14; sx += 11) {
            ctx.fillStyle = rowColors[Math.abs(Math.floor(sx + r * 7)) % rowColors.length];
            ctx.beginPath();
            ctx.arc(sx, -g.h / 2 + 9.5 + r * 11, 2.6, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }
    }

    // Scenery props
    for (let i = 0; i < tr.props.length; i++) {
      const p = tr.props[i];
      const pad = p.r || Math.max(p.w || 40, p.h || 40);
      if (p.x + pad < viewL || p.x - pad > viewR || p.y + pad < viewT || p.y - pad > viewB) continue;
      drawProp(ctx, p, th.night);
    }

    // Streetlamps glow on night track
    if (th.night && tr.lamps.length > 0) {
      for (let i = 0; i < tr.lamps.length; i++) {
        const l = tr.lamps[i];
        if (l.x + 110 < viewL || l.x - 110 > viewR || l.y + 110 < viewT || l.y - 110 > viewB) continue;
        const grd = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, 85);
        grd.addColorStop(0, 'rgba(56,189,248,0.32)');
        grd.addColorStop(0.45, 'rgba(232,121,249,0.10)');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(l.x, l.y, 85, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e0f2fe';
        ctx.beginPath();
        ctx.arc(l.x, l.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Particles
    for (let i = 0; i < sim.particles.length; i++) {
      const p = sim.particles[i];
      const a = Math.max(0, p.life / p.maxLife) * 0.6;
      ctx.fillStyle = p.color + a + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1.35 - a * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }

    // Ghost car (Time Trial)
    if (sim.ghostPose && sim.race.state !== 'menu') {
      drawCarSprite(ctx, sim.ghostPose.x, sim.ghostPose.y, sim.ghostPose.angle, sim.carDef, {
        ghost: true,
      });
    }

    // Traffic cars
    for (let i = 0; i < sim.traffic.length; i++) {
      drawTrafficCar(ctx, sim.traffic[i], th.night);
    }

    // Player car
    if (sim.race.state !== 'menu') {
      drawCarSprite(ctx, c.x, c.y, c.angle, sim.carDef, {
        steer: c.steer,
        braking: c.brake > 0.15 || c.handbrake,
        boosting: c.boosting,
        night: th.night,
      });
    }

    // Start Gantry arch overhead (with live signal lights!)
    ctx.save();
    ctx.translate(sPt.x, sPt.y);
    ctx.rotate(sTan.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-5, -rw / 2 - 14, 14, rw + 28);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-7, -rw / 2 - 16, 14, rw + 32);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-7, -rw / 2 - 16, 14, rw + 32);

    // 3 racing start lights
    const st = sim.race.state;
    const cd = Math.ceil(sim.race.countdown);
    for (let li = 0; li < 3; li++) {
      const ly = -22 + li * 22;
      let col = '#334155';
      if (st === 'countdown') {
        if (li < 4 - cd) col = '#ef4444';
      } else if (st === 'racing' && sim.race.raceTime < 1.5) {
        col = '#22c55e';
      }
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(0, ly, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Floating world popups (NEAR MISS, DRIFT BANK, etc.)
    ctx.font = '800 13px "SF Mono", ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < sim.popups.length; i++) {
      const p = sim.popups[i];
      const alpha = Math.min(1, (p.life / p.maxLife) * 1.6);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillText(p.text, p.x + 1.5, p.y + 1.5);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    // ---- Screen-space Weather (Rain / Snow) ----
    if (th.weather === 'rain' || th.weather === 'snow') {
      const isRain = th.weather === 'rain';
      ctx.strokeStyle = isRain ? 'rgba(186,230,253,0.28)' : 'rgba(255,255,255,0.65)';
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 1.4;
      for (let i = 0; i < weatherDrops.length; i++) {
        const d = weatherDrops[i];
        d.y = (d.y + dt * (isRain ? 1.45 : 0.16) * d.spd) % 1;
        d.x = (d.x + dt * (isRain ? -0.22 : d.drift) + 1) % 1;
        const px = d.x * W;
        const py = d.y * H;
        if (isRain) {
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px - 6, py + 18);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(px, py, d.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // ---- Speed lines ----
    if ((speedNorm > 0.58 || c.boosting) && sim.race.state === 'racing') {
      const intensity = c.boosting ? 0.95 : Math.min(1, (speedNorm - 0.58) / 0.42);
      const count = Math.floor(14 * intensity);
      ctx.strokeStyle = c.boosting
        ? 'rgba(56,189,248,' + (0.24 * intensity) + ')'
        : 'rgba(255,255,255,' + (0.16 * intensity) + ')';
      ctx.lineWidth = c.boosting ? 2.4 : 1.8;
      const cx = W / 2, cy = H / 2;
      const ang = Math.atan2(c.vy, c.vx);
      for (let i = 0; i < count; i++) {
        const a = ang + Math.PI + (Math.random() - 0.5) * 2.5;
        const r0 = Math.min(W, H) * (0.32 + Math.random() * 0.14);
        const r1 = r0 + 65 + Math.random() * 140 * intensity;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.stroke();
      }
    }

    // ---- Vignette ----
    const vigAlpha = th.night ? 0.52 : 0.32;
    const vgrad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.78);
    vgrad.addColorStop(0, 'rgba(0,0,0,0)');
    vgrad.addColorStop(1, 'rgba(0,0,0,' + vigAlpha + ')');
    ctx.fillStyle = vgrad;
    ctx.fillRect(0, 0, W, H);

    // ---- Minimap ----
    if (mctx) drawMinimap(mctx, sim);
  }

  function drawMinimap(mctx, sim) {
    const tr = sim.track;
    const th = tr.def.theme;
    const mw = mctx.canvas.width;
    const mh = mctx.canvas.height;
    const s = Math.min(mw / tr.def.world.w, mh / tr.def.world.h) * 0.88;
    const ox = (mw - tr.def.world.w * s) / 2;
    const oy = (mh - tr.def.world.h * s) / 2;

    mctx.clearRect(0, 0, mw, mh);
    mctx.fillStyle = th.minimapBg;
    mctx.fillRect(0, 0, mw, mh);

    mctx.lineJoin = 'round';
    mctx.lineCap = 'round';
    mctx.beginPath();
    mctx.moveTo(ox + tr.points[0].x * s, oy + tr.points[0].y * s);
    for (let i = 1; i <= tr.N; i += 2) {
      const pt = tr.points[i % tr.N];
      mctx.lineTo(ox + pt.x * s, oy + pt.y * s);
    }
    mctx.closePath();
    mctx.strokeStyle = 'rgba(255,255,255,0.45)';
    mctx.lineWidth = tr.def.roadW * s + 2.5;
    mctx.stroke();
    mctx.strokeStyle = th.asphalt;
    mctx.lineWidth = Math.max(3, tr.def.roadW * s);
    mctx.stroke();

    // Start marker
    mctx.fillStyle = '#f8fafc';
    mctx.beginPath();
    mctx.arc(ox + tr.startPt.x * s, oy + tr.startPt.y * s, 3, 0, Math.PI * 2);
    mctx.fill();

    // Ghost dot
    if (sim.ghostPose) {
      mctx.fillStyle = 'rgba(255,255,255,0.75)';
      mctx.beginPath();
      mctx.arc(ox + sim.ghostPose.x * s, oy + sim.ghostPose.y * s, 3, 0, Math.PI * 2);
      mctx.fill();
    }

    // Traffic dots
    for (let i = 0; i < sim.traffic.length; i++) {
      const t = sim.traffic[i];
      mctx.fillStyle = t.color;
      mctx.beginPath();
      mctx.arc(ox + t.x * s, oy + t.y * s, 2.3, 0, Math.PI * 2);
      mctx.fill();
    }

    // Player directional chevron
    if (sim.race.state !== 'menu') {
      const px = ox + sim.car.x * s;
      const py = oy + sim.car.y * s;
      mctx.save();
      mctx.translate(px, py);
      mctx.rotate(sim.car.angle);
      mctx.fillStyle = sim.carDef.color;
      mctx.strokeStyle = '#ffffff';
      mctx.lineWidth = 1.4;
      mctx.beginPath();
      mctx.moveTo(6.5, 0);
      mctx.lineTo(-4.5, -4);
      mctx.lineTo(-2.5, 0);
      mctx.lineTo(-4.5, 4);
      mctx.closePath();
      mctx.fill();
      mctx.stroke();
      mctx.restore();
    }
  }

  G.Renderer = { render };
})(window.DriveSim = window.DriveSim || {});
