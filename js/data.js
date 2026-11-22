(function (G) {
  "use strict";

  // ---------- Seeded PRNG ----------
  function mulberry32(seed) {
    let a = seed | 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- Cars ----------
  const CARS = [
    {
      id: 'gt',
      name: 'Apex GT',
      tagline: 'Balanced sports coupe',
      style: 'gt',
      color: '#e63946',
      accent: '#f8fafc',
      stats: { speed: 82, accel: 82, grip: 84, drift: 78, offroad: 52 },
      phys: {
        maxSpeed: 1220,
        accel: 860,
        brake: 1120,
        grip: 10.6,
        driftGrip: 2.1,
        offroadDrag: 2.3,
        offroadGrip: 5.2,
        steerMax: 0.68,
        yawGain: 0.0063,
        driftYawGain: 0.0080,
      }
    },
    {
      id: 'drift',
      name: 'Drift King',
      tagline: 'Tail-happy street tuner',
      style: 'drift',
      color: '#06b6d4',
      accent: '#1e293b',
      stats: { speed: 78, accel: 85, grip: 72, drift: 98, offroad: 55 },
      phys: {
        maxSpeed: 1170,
        accel: 900,
        brake: 1080,
        grip: 8.8,
        driftGrip: 1.55,
        offroadDrag: 2.2,
        offroadGrip: 5.0,
        steerMax: 0.74,
        yawGain: 0.0068,
        driftYawGain: 0.0092,
      }
    },
    {
      id: 'f1',
      name: 'Veloce F1',
      tagline: 'Razor-sharp open wheeler',
      style: 'f1',
      color: '#f97316',
      accent: '#0f172a',
      stats: { speed: 98, accel: 96, grip: 96, drift: 58, offroad: 28 },
      phys: {
        maxSpeed: 1380,
        accel: 1040,
        brake: 1360,
        grip: 13.0,
        driftGrip: 3.1,
        offroadDrag: 3.4,
        offroadGrip: 3.8,
        steerMax: 0.66,
        yawGain: 0.0066,
        driftYawGain: 0.0076,
      }
    },
    {
      id: 'rally',
      name: 'Baja Rally',
      tagline: 'All-terrain corner eater',
      style: 'rally',
      color: '#2563eb',
      accent: '#facc15',
      stats: { speed: 80, accel: 90, grip: 82, drift: 88, offroad: 96 },
      phys: {
        maxSpeed: 1180,
        accel: 940,
        brake: 1160,
        grip: 10.0,
        driftGrip: 1.85,
        offroadDrag: 0.75,
        offroadGrip: 8.6,
        steerMax: 0.72,
        yawGain: 0.0067,
        driftYawGain: 0.0086,
      }
    }
  ];

  // ---------- Modes ----------
  const MODES = [
    {
      id: 'highway',
      name: 'Highway Cruise',
      desc: 'Endless straight scenic drive'
    },
    {
      id: 'timetrial',
      name: 'Time Trial',
      desc: 'Beat medals & your ghost'
    },
    {
      id: 'traffic',
      name: 'Traffic Race',
      desc: 'Weave traffic for boost'
    },
    {
      id: 'drift',
      name: 'Drift Attack',
      desc: '2-min drift score run'
    },
    {
      id: 'cruise',
      name: 'Free Cruise',
      desc: 'Chill circuit driving'
    }
  ];

  // ---------- Tracks ----------
  const TRACK_DEFS = [
    {
      id: 'emerald',
      name: 'Emerald Circuit',
      subtitle: 'Countryside Grand Prix',
      seed: 20261121,
      world: { w: 3400, h: 2300 },
      roadW: 100,
      gripMul: 1.0,
      offroadMul: 1.0,
      medals: { gold: 20.0, silver: 23.5, bronze: 28.5 },
      theme: {
        bg: '#243d26',
        ground: '#2d4f30',
        patchDark: 'rgba(0,0,0,0.11)',
        patchLight: 'rgba(255,255,255,0.055)',
        shoulder: '#546e4b',
        asphalt: '#373d45',
        asphaltLine: 'rgba(255,255,255,0.55)',
        edgeLine: 'rgba(255,255,255,0.35)',
        curbA: '#dc2626',
        curbB: '#f1f5f9',
        minimapBg: 'rgba(22,42,26,0.9)',
        skidColor: 'rgba(18,20,24,',
        offroadParticle: 'rgba(126,98,64,',
        weather: 'none',
        night: false,
        swatch: ['#2d4f30', '#373d45', '#dc2626'],
      },
      control: [
        { x: 640,  y: 440 },
        { x: 1680, y: 310 },
        { x: 2660, y: 420 },
        { x: 3020, y: 900 },
        { x: 2640, y: 1320 },
        { x: 2900, y: 1840 },
        { x: 2150, y: 1980 },
        { x: 1420, y: 1700 },
        { x: 680,  y: 1880 },
        { x: 360,  y: 1220 },
      ]
    },
    {
      id: 'canyon',
      name: 'Sunset Canyon',
      subtitle: 'Red-Rock Hairpins',
      seed: 8842103,
      world: { w: 3600, h: 2400 },
      roadW: 96,
      gripMul: 0.94,
      offroadMul: 0.88,
      medals: { gold: 23.5, silver: 27.5, bronze: 33.0 },
      theme: {
        bg: '#6e341e',
        ground: '#8f4729',
        patchDark: 'rgba(74,24,10,0.16)',
        patchLight: 'rgba(255,200,140,0.08)',
        shoulder: '#b86b3e',
        asphalt: '#3e3836',
        asphaltLine: 'rgba(251,191,36,0.72)',
        edgeLine: 'rgba(255,240,210,0.32)',
        curbA: '#ea580c',
        curbB: '#fef3c7',
        minimapBg: 'rgba(72,32,18,0.9)',
        skidColor: 'rgba(30,22,18,',
        offroadParticle: 'rgba(186,105,62,',
        weather: 'dust',
        night: false,
        swatch: ['#8f4729', '#3e3836', '#f59e0b'],
      },
      control: [
        { x: 600,  y: 520 },
        { x: 1550, y: 320 },
        { x: 2300, y: 660 },
        { x: 3120, y: 420 },
        { x: 3260, y: 1120 },
        { x: 2480, y: 1320 },
        { x: 2920, y: 1960 },
        { x: 1860, y: 2080 },
        { x: 1150, y: 1560 },
        { x: 460,  y: 1920 },
        { x: 340,  y: 1160 },
      ]
    },
    {
      id: 'neon',
      name: 'Midnight Neon',
      subtitle: 'Rainy City Street Circuit',
      seed: 7771337,
      world: { w: 3400, h: 2400 },
      roadW: 94,
      gripMul: 0.85,
      offroadMul: 0.95,
      medals: { gold: 24.0, silver: 28.0, bronze: 34.0 },
      theme: {
        bg: '#0b1020',
        ground: '#111827',
        patchDark: 'rgba(0,0,0,0.22)',
        patchLight: 'rgba(56,189,248,0.04)',
        shoulder: '#1f2937',
        asphalt: '#1e2430',
        asphaltLine: 'rgba(56,189,248,0.65)',
        edgeLine: 'rgba(232,121,249,0.45)',
        curbA: '#06b6d4',
        curbB: '#e879f9',
        minimapBg: 'rgba(10,14,28,0.92)',
        skidColor: 'rgba(8,10,16,',
        offroadParticle: 'rgba(100,116,139,',
        weather: 'rain',
        night: true,
        swatch: ['#111827', '#06b6d4', '#e879f9'],
      },
      control: [
        { x: 640,  y: 440 },
        { x: 1960, y: 400 },
        { x: 2960, y: 460 },
        { x: 3000, y: 1160 },
        { x: 2180, y: 1180 },
        { x: 2140, y: 1620 },
        { x: 2920, y: 1720 },
        { x: 2820, y: 2080 },
        { x: 1200, y: 2040 },
        { x: 460,  y: 1940 },
        { x: 420,  y: 1120 },
      ]
    },
    {
      id: 'alpine',
      name: 'Alpine Pass',
      subtitle: 'Snowy Mountain Switchbacks',
      seed: 4209911,
      world: { w: 3600, h: 2500 },
      roadW: 92,
      gripMul: 0.80,
      offroadMul: 1.25,
      medals: { gold: 28.5, silver: 33.5, bronze: 40.0 },
      theme: {
        bg: '#cbd5e1',
        ground: '#dde6f0',
        patchDark: 'rgba(100,116,139,0.14)',
        patchLight: 'rgba(255,255,255,0.45)',
        shoulder: '#94a3b8',
        asphalt: '#475569',
        asphaltLine: 'rgba(248,250,252,0.75)',
        edgeLine: 'rgba(186,230,253,0.55)',
        curbA: '#0284c7',
        curbB: '#f8fafc',
        minimapBg: 'rgba(30,41,59,0.9)',
        skidColor: 'rgba(30,41,59,',
        offroadParticle: 'rgba(226,232,240,',
        weather: 'snow',
        night: false,
        swatch: ['#dde6f0', '#475569', '#0284c7'],
      },
      control: [
        { x: 640,  y: 480 },
        { x: 1660, y: 340 },
        { x: 2780, y: 420 },
        { x: 3220, y: 920 },
        { x: 2540, y: 1200 },
        { x: 3180, y: 1680 },
        { x: 2760, y: 2180 },
        { x: 1680, y: 2100 },
        { x: 1460, y: 1480 },
        { x: 760,  y: 2040 },
        { x: 360,  y: 1480 },
        { x: 420,  y: 900 },
      ]
    }
  ];

  // ---------- Spline & Track Builder ----------
  function catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return {
      x: 0.5 * (
        2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
      ),
      y: 0.5 * (
        2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
      ),
    };
  }

  function buildTrack(def) {
    const rand = mulberry32(def.seed);
    const ctrl = def.control;
    const samplesPerSeg = 72;
    const points = [];
    for (let i = 0; i < ctrl.length; i++) {
      const p0 = ctrl[(i - 1 + ctrl.length) % ctrl.length];
      const p1 = ctrl[i];
      const p2 = ctrl[(i + 1) % ctrl.length];
      const p3 = ctrl[(i + 2) % ctrl.length];
      for (let j = 0; j < samplesPerSeg; j++) {
        points.push(catmullRom(p0, p1, p2, p3, j / samplesPerSeg));
      }
    }

    // Rotate spline so index 0 sits cleanly on the middle of the main straightaway
    const shift = Math.floor(samplesPerSeg * 0.5);
    const rotated = points.slice(shift).concat(points.slice(0, shift));
    points.length = 0;
    for (let i = 0; i < rotated.length; i++) points.push(rotated[i]);

    const N = points.length;
    const segLen = new Float32Array(N);
    const cumLen = new Float32Array(N);
    const tangents = new Array(N);
    const curvatures = new Float32Array(N);
    let trackLen = 0;

    for (let i = 0; i < N; i++) {
      const a = points[i];
      const b = points[(i + 1) % N];
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      segLen[i] = d;
      cumLen[i] = trackLen;
      trackLen += d;
    }

    for (let i = 0; i < N; i++) {
      const prev = points[(i - 2 + N) % N];
      const next = points[(i + 2) % N];
      const angle = Math.atan2(next.y - prev.y, next.x - prev.x);
      tangents[i] = { x: Math.cos(angle), y: Math.sin(angle), angle };
    }

    // Signed curvature at each point (for curbs & corner chevrons)
    for (let i = 0; i < N; i++) {
      const a0 = tangents[(i - 4 + N) % N].angle;
      const a1 = tangents[(i + 4) % N].angle;
      let da = a1 - a0;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      curvatures[i] = da;
    }

    // Helper functions
    function pointAt(t) {
      const f = (((t % 1) + 1) % 1) * N;
      const i = Math.floor(f) % N;
      const j = (i + 1) % N;
      const u = f - Math.floor(f);
      return {
        x: points[i].x + (points[j].x - points[i].x) * u,
        y: points[i].y + (points[j].y - points[i].y) * u,
      };
    }

    function tangentAt(t) {
      const p = pointAt(t);
      const q = pointAt(t + 0.003);
      const a = Math.atan2(q.y - p.y, q.x - p.x);
      return { x: Math.cos(a), y: Math.sin(a), angle: a };
    }

    function minDistToTrack(x, y) {
      let m = Infinity;
      for (let i = 0; i < N; i += 3) {
        const dx = points[i].x - x;
        const dy = points[i].y - y;
        const d = dx * dx + dy * dy;
        if (d < m) m = d;
      }
      return Math.sqrt(m);
    }

    function nearestIdx(x, y, hintIdx) {
      // If hintIdx provided, check local window first, fallback to global if far
      if (hintIdx != null) {
        let best = hintIdx;
        let bestD = Infinity;
        for (let off = -45; off <= 45; off++) {
          const i = (hintIdx + off + N) % N;
          const dx = points[i].x - x;
          const dy = points[i].y - y;
          const d = dx * dx + dy * dy;
          if (d < bestD) { bestD = d; best = i; }
        }
        if (bestD < 260 * 260) {
          return { idx: best, dist: Math.sqrt(bestD) };
        }
      }
      let best = 0, bestD = Infinity;
      for (let i = 0; i < N; i++) {
        const dx = points[i].x - x;
        const dy = points[i].y - y;
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = i; }
      }
      return { idx: best, dist: Math.sqrt(bestD) };
    }

    // Build curbs along high-curvature sections
    const curbs = [];
    const halfW = def.roadW / 2;
    for (let i = 0; i < N; i += 2) {
      const c = curvatures[i];
      if (Math.abs(c) > 0.14) {
        const p = points[i];
        const p2 = points[(i + 2) % N];
        const tan = tangents[i];
        const tan2 = tangents[(i + 2) % N];
        const nx = -tan.y, ny = tan.x;
        const nx2 = -tan2.y, ny2 = tan2.x;
        const side = c > 0 ? 1 : -1; // inside curb
        const off = side * (halfW + 3);
        curbs.push({
          x1: p.x + nx * off, y1: p.y + ny * off,
          x2: p2.x + nx2 * off, y2: p2.y + ny2 * off,
          alt: Math.floor(i / 4) % 2 === 0,
        });
      }
    }

    // Build corner chevrons on outside of sharp turns
    const chevrons = [];
    for (let i = 0; i < N; i += 14) {
      const c = curvatures[i];
      if (Math.abs(c) > 0.24) {
        const p = points[i];
        const tan = tangents[i];
        const nx = -tan.y, ny = tan.x;
        const outside = c > 0 ? -1 : 1;
        const dist = halfW + 24;
        chevrons.push({
          x: p.x + nx * outside * dist,
          y: p.y + ny * outside * dist,
          angle: tan.angle,
          dir: c > 0 ? 1 : -1,
        });
      }
    }

    // Streetlamps for night track
    const lamps = [];
    if (def.theme.night) {
      for (let i = 0; i < N; i += 24) {
        const p = points[i];
        const tan = tangents[i];
        const nx = -tan.y, ny = tan.x;
        const side = (Math.floor(i / 24) % 2 === 0) ? 1 : -1;
        lamps.push({
          x: p.x + nx * side * (halfW + 26),
          y: p.y + ny * side * (halfW + 26),
        });
      }
    }

    // Ice patches for alpine track
    const icePatches = [];
    if (def.id === 'alpine') {
      for (let i = 30; i < N - 30; i += 110) {
        const p = points[i];
        const tan = tangents[i];
        icePatches.push({
          x: p.x, y: p.y,
          rx: 56 + rand() * 34,
          ry: 24 + rand() * 14,
          angle: tan.angle,
        });
      }
    }

    // Ground patches
    const patches = [];
    for (let i = 0; i < 180; i++) {
      const x = rand() * def.world.w;
      const y = rand() * def.world.h;
      if (minDistToTrack(x, y) > halfW + 28) {
        patches.push({
          x, y,
          rx: 45 + rand() * 120,
          ry: 30 + rand() * 75,
          a: rand() * Math.PI,
          dark: rand() > 0.48,
        });
      }
    }

    // Grandstand near start/finish
    const sPt = points[0];
    const sTan = tangents[0];
    const sNx = -sTan.y, sNy = sTan.x;
    const grandstand = {
      x: sPt.x - sNx * (halfW + 66),
      y: sPt.y - sNy * (halfW + 66),
      angle: sTan.angle,
      w: 190,
      h: 44,
    };

    // Scenic pond for emerald
    let pond = null;
    if (def.id === 'emerald') {
      for (let tries = 0; tries < 60; tries++) {
        const px = 700 + rand() * (def.world.w - 1400);
        const py = 550 + rand() * (def.world.h - 1100);
        if (minDistToTrack(px, py) > halfW + 200) {
          pond = { x: px, y: py, rx: 140, ry: 92, a: rand() * Math.PI };
          break;
        }
      }
    }

    // Theme-specific props (trees, buildings, mesas, rocks)
    const props = [];
    const propTarget = def.id === 'neon' ? 110 : 185;
    for (let i = 0; i < 420 && props.length < propTarget; i++) {
      const x = 70 + rand() * (def.world.w - 140);
      const y = 70 + rand() * (def.world.h - 140);
      const minClr = def.id === 'neon' ? halfW + 86 : halfW + 58;
      if (minDistToTrack(x, y) < minClr) continue;
      if (Math.hypot(x - grandstand.x, y - grandstand.y) < 130) continue;
      if (pond && Math.hypot(x - pond.x, y - pond.y) < 165) continue;

      if (def.id === 'neon') {
        const bw = 55 + rand() * 90;
        const bh = 55 + rand() * 90;
        props.push({
          type: 'building',
          x, y, w: bw, h: bh,
          hue: rand() > 0.5 ? '#06b6d4' : '#e879f9',
          litSeed: Math.floor(rand() * 1000),
        });
      } else if (def.id === 'canyon') {
        const roll = rand();
        if (roll < 0.22) {
          props.push({ type: 'mesa', x, y, r: 30 + rand() * 38 });
        } else if (roll < 0.72) {
          props.push({ type: 'cactus', x, y, r: 8 + rand() * 7, a: rand() * Math.PI });
        } else {
          props.push({ type: 'rock', x, y, r: 7 + rand() * 11 });
        }
      } else if (def.id === 'alpine') {
        if (rand() < 0.8) {
          props.push({ type: 'pine', x, y, r: 14 + rand() * 16 });
        } else {
          props.push({ type: 'rock', x, y, r: 8 + rand() * 12 });
        }
      } else {
        if (rand() < 0.82) {
          props.push({ type: 'tree', x, y, r: 14 + rand() * 16, shade: rand() });
        } else {
          props.push({ type: 'rock', x, y, r: 5 + rand() * 8 });
        }
      }
    }

    return {
      def,
      points,
      N,
      segLen,
      cumLen,
      trackLen,
      tangents,
      curvatures,
      curbs,
      chevrons,
      lamps,
      icePatches,
      patches,
      grandstand,
      pond,
      props,
      startPt: points[0],
      startTan: tangents[0],
      checkpoints: [
        Math.floor(N * 0.25),
        Math.floor(N * 0.50),
        Math.floor(N * 0.75),
      ],
      pointAt,
      tangentAt,
      nearestIdx,
      minDistToTrack,
    };
  }

  // ---------- Persistence ----------
  const STORAGE_KEY = 'drive_sim_v2';
  const defaultStore = {
    prefs: {
      trackId: 'emerald',
      carId: 'gt',
      modeId: 'highway',
      muted: false,
      radio: false,
      camMode: 'dynamic', // dynamic | tight
      forceTouch: false,
    },
    bestLaps: {},   // trackId -> { time, carId }
    ghosts: {},     // trackId -> flat array [t, x, y, a, ...]
    bestDrift: {},  // trackId -> number
    bestHighwayKm: 0,
  };

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(defaultStore));
      const parsed = JSON.parse(raw);
      return {
        prefs: Object.assign({}, defaultStore.prefs, parsed.prefs || {}),
        bestLaps: parsed.bestLaps || {},
        ghosts: parsed.ghosts || {},
        bestDrift: parsed.bestDrift || {},
        bestHighwayKm: parsed.bestHighwayKm || 0,
      };
    } catch (e) {
      return JSON.parse(JSON.stringify(defaultStore));
    }
  }

  function saveStore(store) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (e) {
      // Storage full or disabled; trim ghosts if needed
      try {
        const trimmed = Object.assign({}, store, { ghosts: {} });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      } catch (_) {}
    }
  }

  function getMedal(trackDef, timeSec) {
    if (timeSec == null) return null;
    if (timeSec <= trackDef.medals.gold) return 'gold';
    if (timeSec <= trackDef.medals.silver) return 'silver';
    if (timeSec <= trackDef.medals.bronze) return 'bronze';
    return null;
  }

  function fmtTime(t) {
    if (t == null || !isFinite(t)) return '--:--.--';
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    return m + ':' + s.toFixed(2).padStart(5, '0');
  }

  G.mulberry32 = mulberry32;
  G.CARS = CARS;
  G.MODES = MODES;
  G.TRACK_DEFS = TRACK_DEFS;
  G.buildTrack = buildTrack;
  G.loadStore = loadStore;
  G.saveStore = saveStore;
  G.getMedal = getMedal;
  G.fmtTime = fmtTime;
})(window.DriveSim = window.DriveSim || {});
