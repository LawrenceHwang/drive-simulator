(function (G) {
  "use strict";

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const minimap = document.getElementById('minimap');
  const mctx = minimap.getContext('2d');

  // DOM refs
  const hudLayer = document.getElementById('hud-layer');
  const hudLeft = document.getElementById('hud-left');
  const hudDrift = document.getElementById('hud-drift');
  const hudDriftPts = document.getElementById('hud-drift-pts');
  const hudDriftSub = document.getElementById('hud-drift-sub');
  const hudGear = document.getElementById('hud-gear');
  const hudKmh = document.getElementById('hud-kmh');
  const rpmFill = document.getElementById('rpm-fill');
  const boostFill = document.getElementById('boost-fill');
  const hudBanner = document.getElementById('hud-banner');
  const hudBannerMain = document.getElementById('hud-banner-main');
  const hudBannerSub = document.getElementById('hud-banner-sub');

  const menuEl = document.getElementById('menu');
  const trackGrid = document.getElementById('track-grid');
  const carGrid = document.getElementById('car-grid');
  const modeGrid = document.getElementById('mode-grid');
  const startBtn = document.getElementById('btn-start');
  const menuSfxBtn = document.getElementById('menu-sfx');
  const menuRadioBtn = document.getElementById('menu-radio');

  const pauseModal = document.getElementById('pause-modal');
  const finishModal = document.getElementById('finish-modal');
  const touchEl = document.getElementById('touch');

  // Toolbar buttons
  const btnPause = document.getElementById('btn-pause');
  const btnSfx = document.getElementById('btn-sfx');
  const btnRadio = document.getElementById('btn-radio');
  const btnCam = document.getElementById('btn-cam');
  const btnReset = document.getElementById('btn-reset');

  // Canvas resize
  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
  }
  window.addEventListener('resize', resize);
  resize();

  // State & Store
  const store = G.loadStore();
  const trackCache = {};

  function getBuiltTrack(id) {
    if (!trackCache[id]) {
      const def = G.TRACK_DEFS.find(t => t.id === id) || G.TRACK_DEFS[0];
      trackCache[id] = G.buildTrack(def);
    }
    return trackCache[id];
  }

  function getCarDef(id) {
    return G.CARS.find(c => c.id === id) || G.CARS[0];
  }

  let sim = null;

  function rebuildSim() {
    const tr = getBuiltTrack(store.prefs.trackId);
    const car = getCarDef(store.prefs.carId);
    sim = G.Physics.createSim(tr, car, store.prefs.modeId, store);
  }

  // Apply saved audio & touch prefs
  G.Audio.setMuted(store.prefs.muted);
  if (store.prefs.forceTouch) document.body.classList.add('force-touch');

  // ---------- Input (Keyboard + Touch + Gamepad) ----------
  const keyInput = { up: false, down: false, left: false, right: false, handbrake: false, boost: false };
  const touchInput = { up: false, down: false, left: false, right: false, handbrake: false, boost: false };

  const KEYMAP = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    Space: 'handbrake',
    ShiftLeft: 'boost', ShiftRight: 'boost', KeyB: 'boost',
  };

  window.addEventListener('keydown', (e) => {
    if (KEYMAP[e.code]) {
      keyInput[KEYMAP[e.code]] = true;
      if (sim && sim.race.state !== 'menu') e.preventDefault();
    }
    if (e.code === 'Enter') {
      if (sim.race.state === 'menu') launchDrive();
      else if (sim.race.state === 'finish') launchDrive();
    }
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (sim.race.state === 'racing' || sim.race.state === 'countdown') togglePause(true);
      else if (sim.race.state === 'paused') togglePause(false);
    }
    if (e.code === 'KeyR' && sim.race.state === 'racing') {
      G.Physics.resetToTrack(sim);
      G.Audio.playClick();
    }
    if (e.code === 'KeyM') toggleSfx();
    if (e.code === 'KeyN') toggleRadio();
    if (e.code === 'KeyC') toggleCamera();
  });

  window.addEventListener('keyup', (e) => {
    if (KEYMAP[e.code]) {
      keyInput[KEYMAP[e.code]] = false;
    }
  });

  window.addEventListener('blur', () => {
    for (const k in keyInput) keyInput[k] = false;
    for (const k in touchInput) touchInput[k] = false;
  });

  function bindTouch(id, key) {
    const el = document.getElementById(id);
    if (!el) return;
    const on = (e) => {
      e.preventDefault();
      touchInput[key] = true;
      el.classList.add('active');
      G.Audio.ensure();
    };
    const off = (e) => {
      e.preventDefault();
      touchInput[key] = false;
      el.classList.remove('active');
    };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
    el.addEventListener('pointerleave', off);
  }
  bindTouch('t-left', 'left');
  bindTouch('t-right', 'right');
  bindTouch('t-gas', 'up');
  bindTouch('t-brake', 'down');
  bindTouch('t-drift', 'handbrake');
  bindTouch('t-boost', 'boost');

  function pollInput() {
    const inp = {
      up: keyInput.up || touchInput.up,
      down: keyInput.down || touchInput.down,
      left: keyInput.left || touchInput.left,
      right: keyInput.right || touchInput.right,
      handbrake: keyInput.handbrake || touchInput.handbrake,
      boost: keyInput.boost || touchInput.boost,
    };
    // Optional Gamepad support
    if (navigator.getGamepads) {
      const pads = navigator.getGamepads();
      const gp = pads && pads[0];
      if (gp) {
        if (gp.axes[0] < -0.25) inp.left = true;
        if (gp.axes[0] > 0.25) inp.right = true;
        if ((gp.buttons[7] && gp.buttons[7].pressed) || (gp.buttons[0] && gp.buttons[0].pressed)) inp.up = true;
        if ((gp.buttons[6] && gp.buttons[6].pressed) || (gp.buttons[1] && gp.buttons[1].pressed)) inp.down = true;
        if (gp.buttons[2] && gp.buttons[2].pressed) inp.handbrake = true;
        if (gp.buttons[3] && gp.buttons[3].pressed) inp.boost = true;
      }
    }
    return inp;
  }

  const SVG_SFX_ON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
  const SVG_SFX_OFF = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';

  // ---------- Audio / Settings Toggles ----------
  function syncToggleUI() {
    const muted = store.prefs.muted;
    const radio = store.prefs.radio;
    btnSfx.innerHTML = muted ? SVG_SFX_OFF : SVG_SFX_ON;
    btnSfx.classList.toggle('on', !muted);
    menuSfxBtn.textContent = muted ? 'SFX: OFF' : 'SFX: ON';
    menuSfxBtn.classList.toggle('active', !muted);

    btnRadio.classList.toggle('on', radio);
    menuRadioBtn.textContent = radio ? 'Radio: ON' : 'Radio: OFF';
    menuRadioBtn.classList.toggle('active', radio);

    const pSfx = document.getElementById('p-sfx');
    const pRadio = document.getElementById('p-radio');
    const pCam = document.getElementById('p-cam');
    const pTouch = document.getElementById('p-touch');
    if (pSfx) pSfx.textContent = muted ? 'Sound Effects: OFF' : 'Sound Effects: ON';
    if (pRadio) pRadio.textContent = radio ? 'Synth Bus Radio: ON' : 'Synth Bus Radio: OFF';
    if (pCam) pCam.textContent = 'Camera: ' + (store.prefs.camMode === 'tight' ? 'Tight Chase' : 'Dynamic Zoom');
    if (pTouch) pTouch.textContent = 'On-Screen Controls: ' + (store.prefs.forceTouch ? 'ON' : 'Auto');
  }

  function toggleSfx() {
    store.prefs.muted = !store.prefs.muted;
    G.Audio.setMuted(store.prefs.muted);
    G.saveStore(store);
    syncToggleUI();
  }

  function toggleRadio() {
    store.prefs.radio = !store.prefs.radio;
    G.Audio.setRadio(store.prefs.radio);
    G.saveStore(store);
    syncToggleUI();
  }

  function toggleCamera() {
    store.prefs.camMode = store.prefs.camMode === 'tight' ? 'dynamic' : 'tight';
    G.saveStore(store);
    syncToggleUI();
    if (sim && sim.race.state === 'racing') {
      G.Physics.showBanner(sim, store.prefs.camMode === 'tight' ? 'TIGHT CAM' : 'DYNAMIC CAM', '', 0.8);
    }
  }

  function toggleTouchUI() {
    store.prefs.forceTouch = !store.prefs.forceTouch;
    document.body.classList.toggle('force-touch', store.prefs.forceTouch);
    G.saveStore(store);
    syncToggleUI();
  }

  // ---------- Menu Rendering ----------
  function renderMenu() {
    // Tracks
    trackGrid.innerHTML = '';
    G.TRACK_DEFS.forEach((t) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'choice-card' + (store.prefs.trackId === t.id ? ' selected' : '');
      const rec = store.bestLaps[t.id];
      const medal = rec ? G.getMedal(t, rec.time) : null;
      const medalHtml = medal ? `<span class="medal-tag medal-${medal}">${medal}</span>` : '';
      const recText = rec ? `Best ${G.fmtTime(rec.time)}${medalHtml}` : `Gold ${G.fmtTime(t.medals.gold)}`;

      card.innerHTML = `
        <div class="swatch-bar">
          <span style="background:${t.theme.swatch[0]}"></span>
          <span style="background:${t.theme.swatch[1]}"></span>
          <span style="background:${t.theme.swatch[2]}"></span>
        </div>
        <div class="choice-name">${t.name}</div>
        <div class="choice-sub">${t.subtitle}</div>
        <div class="choice-record mono">${recText}</div>
      `;
      card.addEventListener('click', () => {
        G.Audio.playClick();
        store.prefs.trackId = t.id;
        G.saveStore(store);
        rebuildSim();
        renderMenu();
      });
      trackGrid.appendChild(card);
    });

    // Cars
    carGrid.innerHTML = '';
    G.CARS.forEach((c) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'choice-card' + (store.prefs.carId === c.id ? ' selected' : '');
      card.innerHTML = `
        <span class="car-dot" style="background:${c.color}"></span>
        <div class="choice-name">${c.name}</div>
        <div class="choice-sub">${c.tagline}</div>
        <div class="stat-bars">
          <div class="stat-line"><span>SPD</span><div class="stat-bg"><div class="stat-fg" style="width:${c.stats.speed}%"></div></div></div>
          <div class="stat-line"><span>GRP</span><div class="stat-bg"><div class="stat-fg" style="width:${c.stats.grip}%"></div></div></div>
          <div class="stat-line"><span>DRF</span><div class="stat-bg"><div class="stat-fg" style="width:${c.stats.drift}%"></div></div></div>
          <div class="stat-line"><span>OFF</span><div class="stat-bg"><div class="stat-fg" style="width:${c.stats.offroad}%"></div></div></div>
        </div>
      `;
      card.addEventListener('click', () => {
        G.Audio.playClick();
        store.prefs.carId = c.id;
        G.saveStore(store);
        rebuildSim();
        renderMenu();
      });
      carGrid.appendChild(card);
    });

    // Modes
    modeGrid.innerHTML = '';
    G.MODES.forEach((m) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'choice-card' + (store.prefs.modeId === m.id ? ' selected' : '');
      card.innerHTML = `
        <div class="choice-name">${m.name}</div>
        <div class="choice-sub">${m.desc}</div>
      `;
      card.addEventListener('click', () => {
        G.Audio.playClick();
        store.prefs.modeId = m.id;
        G.saveStore(store);
        rebuildSim();
        renderMenu();
      });
      modeGrid.appendChild(card);
    });
  }

  // ---------- Flow Control ----------
  function launchDrive() {
    G.Audio.ensure();
    G.Audio.setMuted(store.prefs.muted);
    G.Audio.setRadio(store.prefs.radio);
    G.Audio.playClick();

    menuEl.classList.add('hidden');
    pauseModal.classList.add('hidden');
    finishModal.classList.add('hidden');
    hudLayer.classList.remove('hidden');
    touchEl.classList.remove('hidden');

    rebuildSim();
    G.Physics.startSession(sim);
  }

  function returnToMenu() {
    G.Audio.playClick();
    G.Audio.updateEngine(false, 0, 0, 1, 0, 0, false, false);
    pauseModal.classList.add('hidden');
    finishModal.classList.add('hidden');
    hudLayer.classList.add('hidden');
    touchEl.classList.add('hidden');
    menuEl.classList.remove('hidden');

    rebuildSim();
    renderMenu();
  }

  let prePauseState = 'racing';
  function togglePause(pause) {
    if (!sim) return;
    if (pause) {
      if (sim.race.state !== 'racing' && sim.race.state !== 'countdown') return;
      prePauseState = sim.race.state;
      sim.race.state = 'paused';
      G.Audio.updateEngine(false, 0, 0, 1, 0, 0, false, false);
      pauseModal.classList.remove('hidden');
      syncToggleUI();
    } else {
      if (sim.race.state !== 'paused') return;
      sim.race.state = prePauseState;
      pauseModal.classList.add('hidden');
    }
  }

  let finishShown = false;
  function showFinishModal() {
    if (finishShown) return;
    finishShown = true;
    G.Audio.updateEngine(false, 0, 0, 1, 0, 0, false, false);
    const r = sim.race;
    const score = r.driftScore;
    let grade = 'C';
    if (score >= 18000) grade = 'S';
    else if (score >= 11000) grade = 'A';
    else if (score >= 5500) grade = 'B';

    document.getElementById('fin-grade').textContent = grade;
    document.getElementById('fin-score').textContent = score.toLocaleString();
    document.getElementById('fin-best').textContent = r.bestDrift.toLocaleString();
    document.getElementById('fin-combo').textContent = r.bestCombo.toLocaleString();
    document.getElementById('fin-track').textContent = sim.track.def.name;
    finishModal.classList.remove('hidden');
  }

  // Bind UI buttons
  startBtn.addEventListener('click', launchDrive);
  menuSfxBtn.addEventListener('click', toggleSfx);
  menuRadioBtn.addEventListener('click', toggleRadio);
  btnPause.addEventListener('click', () => togglePause(true));
  btnSfx.addEventListener('click', toggleSfx);
  btnRadio.addEventListener('click', toggleRadio);
  btnCam.addEventListener('click', toggleCamera);
  btnReset.addEventListener('click', () => {
    if (sim && sim.race.state === 'racing') {
      G.Physics.resetToTrack(sim);
      G.Audio.playClick();
    }
  });

  document.getElementById('p-resume').addEventListener('click', () => togglePause(false));
  document.getElementById('p-restart').addEventListener('click', () => { finishShown = false; launchDrive(); });
  document.getElementById('p-sfx').addEventListener('click', toggleSfx);
  document.getElementById('p-radio').addEventListener('click', toggleRadio);
  document.getElementById('p-cam').addEventListener('click', toggleCamera);
  document.getElementById('p-touch').addEventListener('click', toggleTouchUI);
  document.getElementById('p-menu').addEventListener('click', returnToMenu);

  document.getElementById('f-again').addEventListener('click', () => { finishShown = false; launchDrive(); });
  document.getElementById('f-menu').addEventListener('click', () => { finishShown = false; returnToMenu(); });

  // ---------- HUD Updater ----------
  function updateHUD() {
    if (!sim || sim.race.state === 'menu') return;
    const r = sim.race;
    const c = sim.car;
    const tr = sim.track.def;

    if (r.state === 'finish') {
      showFinishModal();
    } else {
      finishShown = false;
    }

    // Left Telemetry Panel
    if (sim.modeId === 'drift') {
      const m = Math.floor(r.driftTimeLeft / 60);
      const s = Math.floor(r.driftTimeLeft % 60);
      const tStr = m + ':' + String(s).padStart(2, '0');
      hudLeft.innerHTML = `
        <div class="hud-row"><span class="hud-label">Time Left</span><span class="hud-val big mono">${tStr}</span></div>
        <div class="hud-row"><span class="hud-label">Score</span><span class="hud-val mono">${r.driftScore.toLocaleString()}</span></div>
        <div class="hud-row"><span class="hud-label">Record</span><span class="hud-val mono">${r.bestDrift.toLocaleString()}</span></div>
        <div class="hud-row"><span class="hud-label">Best Combo</span><span class="hud-val mono">${r.bestCombo.toLocaleString()}</span></div>
      `;
    } else {
      const lapElapsed = r.raceTime - r.lapStart;
      const medal = G.getMedal(tr, r.bestLap);
      const medalHtml = medal ? `<span class="medal-tag medal-${medal}">${medal}</span>` : '';
      let deltaHtml = '';
      if (r.sectorDeltaTimer > 0 && r.sectorDelta != null) {
        const fast = r.sectorDelta <= 0;
        const sign = fast ? '-' : '+';
        deltaHtml = `<div class="hud-delta mono ${fast ? 'fast' : 'slow'}">SECTOR ${sign}${Math.abs(r.sectorDelta).toFixed(2)}s</div>`;
      }
      const extraRow = sim.modeId === 'traffic'
        ? `<div class="hud-row"><span class="hud-label">Near Miss</span><span class="hud-val mono">${r.nearMisses}</span></div>`
        : `<div class="hud-row"><span class="hud-label">Last</span><span class="hud-val mono">${G.fmtTime(r.lastLap)}</span></div>`;

      hudLeft.innerHTML = `
        <div class="hud-row"><span class="hud-label">Lap</span><span class="hud-val big mono">${r.lap}</span></div>
        <div class="hud-row"><span class="hud-label">Time</span><span class="hud-val mono">${G.fmtTime(lapElapsed)}</span></div>
        ${deltaHtml}
        ${extraRow}
        <div class="hud-row"><span class="hud-label">Best</span><span class="hud-val mono">${G.fmtTime(r.bestLap)}${medalHtml}</span></div>
      `;
    }

    // Active Drift Pill
    if (r.driftCurrent >= 25) {
      hudDrift.classList.add('active');
      hudDriftPts.textContent = Math.round(r.driftCurrent).toLocaleString() + ' × ' + r.driftMulti;
      hudDriftSub.textContent = r.driftMulti >= 4 ? 'INSANE DRIFT!' : 'DRIFT COMBO';
    } else {
      hudDrift.classList.remove('active');
    }

    // Speed, Gear, RPM, Boost
    const speedAbs = Math.hypot(c.vx, c.vy);
    const kmh = Math.round(speedAbs * 0.21);
    hudKmh.textContent = kmh;
    hudGear.textContent = c.gear;
    rpmFill.style.width = Math.round(c.rpm * 100) + '%';
    boostFill.style.width = Math.round(c.boost) + '%';
    boostFill.classList.toggle('boosting', c.boosting);

    // Center Banner
    if (r.msgTimer > 0 && r.msgText) {
      hudBanner.classList.add('show');
      hudBannerMain.textContent = r.msgText;
      hudBannerSub.textContent = r.msgSub || '';
    } else {
      hudBanner.classList.remove('show');
    }
  }

  // ---------- Main Loop ----------
  rebuildSim();
  renderMenu();
  syncToggleUI();

  // Expose sim for debugging / automated verification
  G.getSim = () => sim;
  G.launchDrive = launchDrive;

  let lastTime = performance.now();
  let accumulator = 0;

  function frame(now) {
    let dt = (now - lastTime) / 1000;
    lastTime = now;
    dt = Math.min(dt, 0.1);
    accumulator += dt;

    const input = pollInput();
    let steps = 0;
    while (accumulator >= G.PHYS_DT && steps < 8) {
      G.Physics.step(sim, input, G.PHYS_DT);
      accumulator -= G.PHYS_DT;
      steps++;
    }
    if (steps === 8) accumulator = 0;

    G.Renderer.render(ctx, mctx, sim, W, H, DPR, dt, store.prefs.camMode);
    updateHUD();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  // Register Service Worker for offline play on GitHub Pages / HTTPS / localhost
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
})(window.DriveSim = window.DriveSim || {});
