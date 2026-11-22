(function (G) {
  "use strict";

  const PHYS_DT = 1 / 120;
  const REVERSE_MAX = 320;
  const BASE_DRAG = 0.24;
  const MAX_SKIDS = 650;
  const MAX_PARTICLES = 280;
  const DRIFT_DURATION = 120; // 2-minute Drift Attack

  const TRAFFIC_TYPES = [
    { kind: 'sedan', len: 44, wid: 22, speedMul: 1.0,  colors: ['#ffd166', '#4ecdc4', '#a78bfa', '#fb7185', '#f8fafc'] },
    { kind: 'van',   len: 52, wid: 25, speedMul: 0.86, colors: ['#94a3b8', '#fde047', '#38bdf8', '#fb923c'] },
    { kind: 'truck', len: 64, wid: 27, speedMul: 0.74, colors: ['#e2e8f0', '#cbd5e1', '#fca5a5'] },
  ];

  function createSim(track, carDef, modeId, store) {
    const rand = G.mulberry32(track.def.seed + 99);
    const savedBest = store.bestLaps[track.def.id] ? store.bestLaps[track.def.id].time : null;
    const savedGhost = store.ghosts[track.def.id] || null;
    const savedDrift = store.bestDrift[track.def.id] || 0;

    const sim = {
      track,
      carDef,
      modeId,
      store,
      rand,
      car: {
        x: track.startPt.x,
        y: track.startPt.y,
        angle: track.startTan.angle,
        vx: 0,
        vy: 0,
        vf: 0,
        vl: 0,
        steer: 0,
        throttle: 0,
        brake: 0,
        radius: 15,
        boost: 60,
        boosting: false,
        gear: '1',
        gearNum: 1,
        rpm: 0.18,
        onOffroad: false,
        onIce: false,
        drifting: false,
        handbrake: false,
        prevRearL: null,
        prevRearR: null,
      },
      traffic: [],
      skids: [],
      skidHead: 0,
      particles: [],
      popups: [],
      ghostData: savedGhost,
      ghostPose: null,
      ghostRec: [],
      ghostRecTimer: 0,
      highway: null,
      cam: {
        x: track.startPt.x,
        y: track.startPt.y,
        vx: 0,
        vy: 0,
        scale: 1.38,
        shake: 0,
      },
      race: {
        state: 'menu', // menu | countdown | racing | paused | finish
        countdown: 0,
        lastCount: 4,
        raceTime: 0,
        lap: 1,
        lapStart: 0,
        lastLap: null,
        bestLap: savedBest,
        sessionBestLap: null,
        sectorFlags: [false, false, false],
        sectorDelta: null,
        sectorDeltaTimer: 0,
        nearestIdx: 0,
        // Drift scoring
        driftScore: 0,
        bestDrift: savedDrift,
        driftCurrent: 0,
        driftMulti: 1,
        driftDur: 0,
        driftIdle: 0,
        bestCombo: 0,
        driftTimeLeft: DRIFT_DURATION,
        // Traffic stats
        nearMisses: 0,
        // Banner message
        msgText: '',
        msgSub: '',
        msgTimer: 0,
      }
    };

    spawnTraffic(sim, true);
    return sim;
  }

  function spawnTraffic(sim, forMenu) {
    sim.traffic.length = 0;
    const count = forMenu ? 6 : (sim.modeId === 'traffic' ? 8 : (sim.modeId === 'cruise' ? 5 : 0));
    const rand = G.mulberry32(sim.track.def.seed + 313);
    const laneOff = sim.track.def.roadW * 0.24;

    for (let i = 0; i < count; i++) {
      const type = TRAFFIC_TYPES[i % TRAFFIC_TYPES.length];
      const color = type.colors[Math.floor(rand() * type.colors.length)];
      const lane = (i % 2 === 0) ? -1 : 1;
      const baseSpeed = (165 + rand() * 85) * type.speedMul;
      const t = ((i + 0.35) / Math.max(1, count) + rand() * 0.03) % 1;
      const p = sim.track.pointAt(t);
      const tan = sim.track.tangentAt(t);
      const nx = -tan.y, ny = tan.x;
      sim.traffic.push({
        t,
        lane,
        offset: lane * laneOff,
        targetOffset: lane * laneOff,
        baseSpeed,
        speed: baseSpeed,
        kind: type.kind,
        len: type.len,
        wid: type.wid,
        color,
        x: p.x + nx * lane * laneOff,
        y: p.y + ny * lane * laneOff,
        angle: tan.angle,
        nearMissCd: 0,
      });
    }
  }

  function placeCarAtStart(sim) {
    const c = sim.car;
    const tr = sim.track;
    c.x = tr.startPt.x;
    c.y = tr.startPt.y;
    c.angle = tr.startTan.angle;
    c.vx = 0; c.vy = 0; c.vf = 0; c.vl = 0;
    c.steer = 0; c.throttle = 0; c.brake = 0;
    c.boost = 60; c.boosting = false;
    c.gear = '1'; c.gearNum = 1; c.rpm = 0.18;
    c.onOffroad = false; c.onIce = false; c.drifting = false;
    c.prevRearL = null; c.prevRearR = null;

    sim.cam.x = c.x; sim.cam.y = c.y;
    sim.cam.vx = 0; sim.cam.vy = 0;
    sim.cam.shake = 0;
  }

  function initHighway(sim) {
    const startId = sim.track.def.id;
    const allIds = G.TRACK_DEFS.map(t => t.id);
    const startIdx = Math.max(0, allIds.indexOf(startId));
    const biomeOrder = [];
    for (let i = 0; i < allIds.length; i++) {
      biomeOrder.push(G.TRACK_DEFS[(startIdx + i) % allIds.length]);
    }

    const hw = {
      roadW: 198,
      laneYs: [-66, 0, 66],
      biomeOrder,
      biomeKm: 2.5,
      biomePos: 0,
      biome: biomeOrder[0],
      nextBiome: biomeOrder[1 % biomeOrder.length],
      blend: 0,
      distanceKm: 0,
      bestKm: sim.store.bestHighwayKm || 0,
      nextSaveKm: (sim.store.bestHighwayKm || 0) + 0.25,
      nextChunkX: -600,
      nextSignX: 2500,
      nextLampX: -400,
      props: [],
      patches: [],
      ponds: [],
      lamps: [],
      signs: [],
      rand: G.mulberry32(sim.track.def.seed + 555),
    };
    sim.highway = hw;

    // Pre-populate scenery ahead
    streamHighwayScenery(sim, 0);

    // Spawn 5 chill highway cruisers primarily in middle & right lanes so the fast lane stays invitingly open
    sim.traffic.length = 0;
    for (let i = 0; i < 5; i++) {
      const type = TRAFFIC_TYPES[i % TRAFFIC_TYPES.length];
      const color = type.colors[Math.floor(hw.rand() * type.colors.length)];
      const laneIdx = (i % 2 === 0) ? 2 : 1;
      const spd = (240 + hw.rand() * 140) * type.speedMul;
      sim.traffic.push({
        x: 680 + i * 680 + hw.rand() * 220,
        y: hw.laneYs[laneIdx],
        laneIdx,
        angle: 0,
        speed: spd,
        baseSpeed: spd,
        kind: type.kind,
        len: type.len,
        wid: type.wid,
        color,
        nearMissCd: 0,
      });
    }
  }

  function highwayBiomeAtX(hw, x) {
    const km = Math.max(0, x / 5000);
    const idx = Math.floor(km / hw.biomeKm) % hw.biomeOrder.length;
    return hw.biomeOrder[idx];
  }

  function streamHighwayScenery(sim, carX) {
    const hw = sim.highway;
    const rand = hw.rand;
    const halfW = hw.roadW / 2;

    // Stream ground patches & props ahead of car using the spatial biome at cx
    while (hw.nextChunkX < carX + 2100) {
      const cx = hw.nextChunkX;
      hw.nextChunkX += 160;
      const bDef = highwayBiomeAtX(hw, cx);
      const bId = bDef.id;
      const bTh = bDef.theme;

      // Ground patches on both sides
      for (let s = -1; s <= 1; s += 2) {
        if (rand() < 0.72) {
          hw.patches.push({
            x: cx + rand() * 150,
            y: s * (halfW + 120 + rand() * 480),
            rx: 65 + rand() * 140,
            ry: 38 + rand() * 85,
            a: rand() * Math.PI,
            color: rand() > 0.48 ? bTh.patchDark : bTh.patchLight,
          });
        }
      }

      // Occasional scenic pond in Emerald biome
      if (bId === 'emerald' && rand() < 0.08) {
        const side = rand() > 0.5 ? 1 : -1;
        hw.ponds.push({
          x: cx + 80,
          y: side * (halfW + 250 + rand() * 180),
          rx: 120 + rand() * 65,
          ry: 65 + rand() * 35,
          a: (rand() - 0.5) * 0.35,
        });
      }

      // Roadside scenery props on both sides of the highway
      const countPerSide = bId === 'neon' ? 2 : 3;
      for (let s = -1; s <= 1; s += 2) {
        for (let k = 0; k < countPerSide; k++) {
          const px = cx + rand() * 155;
          const minOff = bId === 'neon' ? halfW + 96 : halfW + 64;
          const py = s * (minOff + rand() * 470);

          if (bId === 'neon') {
            hw.props.push({
              type: 'building',
              x: px, y: py,
              w: 62 + rand() * 95,
              h: 58 + rand() * 90,
              hue: rand() > 0.5 ? '#06b6d4' : '#e879f9',
            });
          } else if (bId === 'canyon') {
            const roll = rand();
            if (roll < 0.24) hw.props.push({ type: 'mesa', x: px, y: py, r: 30 + rand() * 40 });
            else if (roll < 0.74) hw.props.push({ type: 'cactus', x: px, y: py, r: 8 + rand() * 7 });
            else hw.props.push({ type: 'rock', x: px, y: py, r: 7 + rand() * 11 });
          } else if (bId === 'alpine') {
            if (rand() < 0.82) hw.props.push({ type: 'pine', x: px, y: py, r: 15 + rand() * 16 });
            else hw.props.push({ type: 'rock', x: px, y: py, r: 8 + rand() * 12 });
          } else {
            if (rand() < 0.84) hw.props.push({ type: 'tree', x: px, y: py, r: 15 + rand() * 16, shade: rand() });
            else hw.props.push({ type: 'rock', x: px, y: py, r: 5 + rand() * 8 });
          }
        }
      }
    }

    // Streetlamps along night-biome stretches
    while (hw.nextLampX < carX + 2100) {
      const lx = hw.nextLampX;
      hw.nextLampX += 280;
      if (highwayBiomeAtX(hw, lx).theme.night) {
        hw.lamps.push({ x: lx, y: -(halfW + 24) });
        hw.lamps.push({ x: lx + 140, y: halfW + 24 });
      }
    }

    // Overhead scenic highway gantry signs every 0.5 km (2500 px)
    while (hw.nextSignX < carX + 2200) {
      const sx = hw.nextSignX;
      const km = (sx / 5000).toFixed(1);
      const signBiome = highwayBiomeAtX(hw, sx);
      hw.signs.push({ x: sx, label: signBiome.name.toUpperCase() + '  •  ' + km + ' KM' });
      hw.nextSignX += 2500;
    }

    // Prune anything far behind car
    const cutoff = carX - 1000;
    while (hw.props.length && hw.props[0].x < cutoff) hw.props.shift();
    while (hw.patches.length && hw.patches[0].x < cutoff) hw.patches.shift();
    while (hw.ponds.length && hw.ponds[0].x < cutoff) hw.ponds.shift();
    while (hw.lamps.length && hw.lamps[0].x < cutoff) hw.lamps.shift();
    while (hw.signs.length && hw.signs[0].x < cutoff) hw.signs.shift();
  }

  function stepHighway(sim, input, dt) {
    const r = sim.race;
    const c = sim.car;
    const hw = sim.highway;
    const phys = sim.carDef.phys;
    const halfW = hw.roadW / 2;

    r.raceTime += dt;

    // Smooth biome progression every 2.5 km with a 0.5 km crossfade zone
    hw.distanceKm = Math.max(0, c.x / 5000);
    const segFloat = hw.distanceKm / hw.biomeKm;
    const segIdx = Math.floor(segFloat);
    const segFrac = segFloat - segIdx;
    const targetBiomePos = segIdx % hw.biomeOrder.length;
    const nextBiomePos = (segIdx + 1) % hw.biomeOrder.length;

    if (targetBiomePos !== hw.biomePos) {
      hw.biomePos = targetBiomePos;
      hw.biome = hw.biomeOrder[hw.biomePos];
      showBanner(sim, hw.biome.name.toUpperCase(), hw.distanceKm.toFixed(1) + ' KM • SCENIC HIGHWAY', 2.0);
    }
    hw.nextBiome = hw.biomeOrder[nextBiomePos];

    // Crossfade smoothly over the final 22% (~0.55 km) of each biome stretch
    if (segFrac > 0.78) {
      const t = (segFrac - 0.78) / 0.22;
      hw.blend = t * t * (3 - 2 * t); // smoothstep
    } else {
      hw.blend = 0;
    }

    // Persist highway distance record
    if (hw.distanceKm > hw.bestKm) {
      hw.bestKm = hw.distanceKm;
      if (hw.distanceKm >= hw.nextSaveKm) {
        hw.nextSaveKm = hw.distanceKm + 0.25;
        sim.store.bestHighwayKm = Math.round(hw.bestKm * 100) / 100;
        G.saveStore(sim.store);
      }
    }

    const onOffroad = Math.abs(c.y) > halfW - 2;
    c.onOffroad = onOffroad;
    c.onIce = false;

    const speedAbs = Math.hypot(c.vx, c.vy);
    // Highway cruise has a slightly higher exhilarating top speed
    const hMax = phys.maxSpeed * 1.12;
    const maxSpd = hMax * (c.boosting ? 1.28 : 1.0);
    const speedT = Math.min(speedAbs / hMax, 1.2);

    // Boost logic (recharges generously on highway so you can enjoy bursts of speed)
    const wantsBoost = !!input.boost && c.boost > 2 && input.up;
    c.boosting = wantsBoost;
    if (c.boosting) {
      c.boost = Math.max(0, c.boost - 28 * dt);
      sim.cam.shake = Math.max(sim.cam.shake, 0.12);
    } else {
      c.boost = Math.min(100, c.boost + 6.5 * dt);
    }

    // Smooth throttle & brake
    const throttleTarget = input.up ? 1 : 0;
    const brakeTarget = input.down ? 1 : 0;
    c.throttle += (throttleTarget - c.throttle) * Math.min(1, (input.up ? 6.0 : 5.0) * dt);
    c.brake += (brakeTarget - c.brake) * Math.min(1, 10 * dt);

    // Relaxed, gentle lane-change steering
    const steerInput = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    const steerLimit = 0.42 - Math.min(speedT, 1) * 0.18;
    const targetSteer = steerInput * steerLimit;
    const steerRate = steerInput === 0 ? 12 : 7;
    c.steer += (targetSteer - c.steer) * Math.min(1, steerRate * dt);

    // Decompose onto old basis
    const fx = Math.cos(c.angle), fy = Math.sin(c.angle);
    const rx = -fy, ry = fx;
    let vf = c.vx * fx + c.vy * fy;
    let vl = c.vx * rx + c.vy * ry;

    const boostAccelMul = c.boosting ? 1.55 : 1.0;
    const throttleForce = phys.accel * boostAccelMul * (1 - 0.44 * Math.min(speedT, 1));
    vf += c.throttle * throttleForce * dt;

    if (c.brake > 0.02) {
      vf = Math.max(0, vf - phys.brake * c.brake * dt);
    }

    // Light aerodynamic drag (glides nicely when coasting!)
    vf -= vf * 0.16 * dt;
    if (onOffroad) vf -= vf * 0.85 * dt;
    vf = Math.max(0, Math.min(maxSpd, vf));

    // Steering yaw + gentle auto-straightening when hands off steering
    const yawSpeed = Math.min(520, vf);
    c.angle += c.steer * yawSpeed * 0.0052 * dt;
    if (steerInput === 0) {
      c.angle *= Math.exp(-4.5 * dt);
    }
    c.angle = Math.max(-0.62, Math.min(0.62, c.angle));

    // Recompose & apply smooth highway grip
    const tmpVx = fx * vf + rx * vl;
    const tmpVy = fy * vf + ry * vl;
    const nfx = Math.cos(c.angle), nfy = Math.sin(c.angle);
    const nrx = -nfy, nry = nfx;
    const nvf = tmpVx * nfx + tmpVy * nfy;
    let nvl = tmpVx * nrx + tmpVy * nry;
    nvl *= Math.exp(-12.0 * dt);

    c.vx = nfx * nvf + nrx * nvl;
    c.vy = nfy * nvf + nry * nvl;
    c.vf = nvf;
    c.vl = nvl;
    c.drifting = false;
    c.handbrake = !!input.handbrake;

    c.x += c.vx * dt;
    c.y += c.vy * dt;

    // Soft guardrails at highway shoulders (never get stuck off-road)
    const maxY = halfW + 20;
    if (c.y < -maxY) {
      c.y = -maxY;
      if (c.vy < 0) c.vy = -c.vy * 0.25;
      if (c.angle < 0) c.angle *= 0.6;
    } else if (c.y > maxY) {
      c.y = maxY;
      if (c.vy > 0) c.vy = -c.vy * 0.25;
      if (c.angle > 0) c.angle *= 0.6;
    }

    // 6-speed virtual transmission
    const newSpeed = Math.hypot(c.vx, c.vy);
    const normSpd = Math.min(newSpeed / hMax, 1.15);
    const g = Math.min(6, Math.max(1, Math.floor(normSpd * 5.6) + 1));
    c.gear = String(g);
    c.gearNum = g;
    const gearLow = (g - 1) / 5.6;
    const gearHigh = g / 5.6;
    const inGear = (normSpd - gearLow) / (gearHigh - gearLow);
    c.rpm = Math.max(0.16, Math.min(1.0, 0.24 + inGear * 0.74));

    // Boost flame particles
    if (c.boosting) {
      addParticle(sim, {
        x: c.x - nfx * 23 + (Math.random() - 0.5) * 5,
        y: c.y - nfy * 23 + (Math.random() - 0.5) * 5,
        vx: -nfx * 260 + (Math.random() - 0.5) * 40,
        vy: -nfy * 260 + (Math.random() - 0.5) * 40,
        life: 0.14 + Math.random() * 0.1,
        maxLife: 0.24,
        size: 4 + Math.random() * 4,
        color: Math.random() > 0.4 ? 'rgba(56,189,248,' : 'rgba(251,146,60,',
      });
    }

    // Update particles
    for (let i = sim.particles.length - 1; i >= 0; i--) {
      const p = sim.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      if (p.life <= 0) sim.particles.splice(i, 1);
    }

    // Update & recycle highway traffic
    for (let i = 0; i < sim.traffic.length; i++) {
      const t = sim.traffic[i];
      if (t.nearMissCd > 0) t.nearMissCd -= dt;
      t.x += t.speed * dt;

      // Recycle passed traffic well ahead of player
      if (t.x < c.x - 520) {
        let maxX = c.x + 1500;
        for (let j = 0; j < sim.traffic.length; j++) {
          if (sim.traffic[j].x > maxX) maxX = sim.traffic[j].x;
        }
        const rLane = hw.rand();
        const laneIdx = rLane < 0.15 ? 0 : (rLane < 0.58 ? 1 : 2);
        const type = TRAFFIC_TYPES[Math.floor(hw.rand() * TRAFFIC_TYPES.length)];
        t.x = maxX + 540 + hw.rand() * 380;
        t.y = hw.laneYs[laneIdx];
        t.laneIdx = laneIdx;
        t.kind = type.kind;
        t.len = type.len;
        t.wid = type.wid;
        t.color = type.colors[Math.floor(hw.rand() * type.colors.length)];
        t.speed = (240 + hw.rand() * 140) * type.speedMul;
        t.nearMissCd = 0;
      }

      // Collision & Near-Miss
      const dx = c.x - t.x, dy = c.y - t.y;
      const d = Math.hypot(dx, dy);
      const minD = c.radius + t.wid * 0.68;
      if (d < minD && d > 0.001) {
        const nx = dx / d, ny = dy / d;
        c.x = t.x + nx * minD;
        c.y = t.y + ny * minD;
        const rel = c.vx * nx + c.vy * ny;
        if (rel < 0) {
          c.vx -= nx * rel * 1.1;
          c.vy -= ny * rel * 1.1;
          c.vx *= 0.85;
          const impact = Math.min(1, Math.abs(rel) / 500);
          sim.cam.shake = Math.max(sim.cam.shake, 0.22 + impact * 0.35);
          if (G.Audio) G.Audio.playCollision(impact);
        }
        t.nearMissCd = 2.0;
      } else if (d < minD + 34 && newSpeed > 450 && t.nearMissCd <= 0) {
        t.nearMissCd = 2.5;
        r.nearMisses++;
        c.boost = Math.min(100, c.boost + 20);
        addPopup(sim, c.x, c.y - 26, 'NEAR MISS! +20 BOOST', '#38bdf8');
        if (G.Audio) G.Audio.playNearMiss();
      }
    }

    // Stream upcoming scenery
    streamHighwayScenery(sim, c.x);

    // Update Audio
    if (G.Audio) {
      G.Audio.updateEngine(
        true,
        Math.min(1, newSpeed / hMax),
        c.rpm,
        c.gearNum,
        c.throttle,
        0,
        onOffroad,
        c.boosting
      );
    }
  }

  function resetToTrack(sim) {
    if (sim.modeId === 'highway' && sim.highway) {
      const c = sim.car;
      c.y = 0;
      c.angle = 0;
      c.vy = 0;
      c.steer = 0;
      addPopup(sim, c.x, c.y - 24, 'CENTERED', '#93c5fd');
      return;
    }
    const tr = sim.track;
    const { idx } = tr.nearestIdx(sim.car.x, sim.car.y, sim.race.nearestIdx);
    const pt = tr.points[idx];
    const tan = tr.tangents[idx];
    const c = sim.car;
    c.x = pt.x;
    c.y = pt.y;
    c.angle = tan.angle;
    c.vx = 0; c.vy = 0; c.vf = 0; c.vl = 0;
    c.steer = 0;
    c.prevRearL = null; c.prevRearR = null;
    sim.race.driftCurrent = 0;
    sim.race.driftDur = 0;
    sim.race.driftMulti = 1;
    addPopup(sim, c.x, c.y - 24, 'TRACK RESET', '#93c5fd');
  }

  function startSession(sim) {
    placeCarAtStart(sim);
    spawnTraffic(sim, false);
    sim.skids.length = 0;
    sim.skidHead = 0;
    sim.particles.length = 0;
    sim.popups.length = 0;
    sim.ghostRec.length = 0;
    sim.ghostRecTimer = 0;
    sim.ghostPose = null;

    const r = sim.race;
    r.raceTime = 0;
    r.lap = 1;
    r.lapStart = 0;
    r.lastLap = null;
    r.sessionBestLap = null;
    r.sectorFlags = [false, false, false];
    r.sectorDelta = null;
    r.sectorDeltaTimer = 0;
    r.nearestIdx = 0;
    r.driftScore = 0;
    r.driftCurrent = 0;
    r.driftMulti = 1;
    r.driftDur = 0;
    r.driftIdle = 0;
    r.bestCombo = 0;
    r.driftTimeLeft = DRIFT_DURATION;
    r.nearMisses = 0;

    if (sim.modeId === 'highway') {
      initHighway(sim);
      const c = sim.car;
      c.x = 0; c.y = 0; c.angle = 0;
      c.vx = 0; c.vy = 0; c.vf = 0; c.vl = 0;
      c.boost = 80;
      sim.cam.x = 120; sim.cam.y = 0;
      sim.cam.vx = 0; sim.cam.vy = 0;
      r.state = 'racing';
      const hint = (G.Audio && !G.Audio.isRadioOn()) ? 'Hold Gas & Relax  •  Press N for Synth Radio' : 'Hold Gas & Enjoy the Scenic Drive';
      showBanner(sim, 'HIGHWAY CRUISE', hint, 2.4);
    } else if (sim.modeId === 'cruise') {
      sim.highway = null;
      r.state = 'racing';
      showBanner(sim, 'FREE CRUISE', 'Enjoy the drive', 1.4);
    } else {
      sim.highway = null;
      r.state = 'countdown';
      r.countdown = 3.0;
      r.lastCount = 4;
      r.msgText = '';
      r.msgSub = '';
      r.msgTimer = 0;
    }
  }

  function showBanner(sim, text, sub, dur) {
    sim.race.msgText = text;
    sim.race.msgSub = sub || '';
    sim.race.msgTimer = dur;
  }

  function addPopup(sim, x, y, text, color) {
    sim.popups.push({ x, y, text, color: color || '#ffd166', life: 1.15, maxLife: 1.15 });
    if (sim.popups.length > 16) sim.popups.shift();
  }

  function addSkid(sim, x1, y1, x2, y2, alpha, color) {
    const seg = { x1, y1, x2, y2, alpha, color };
    if (sim.skids.length < MAX_SKIDS) {
      sim.skids.push(seg);
    } else {
      sim.skids[sim.skidHead] = seg;
      sim.skidHead = (sim.skidHead + 1) % MAX_SKIDS;
    }
  }

  function addParticle(sim, p) {
    if (sim.particles.length >= MAX_PARTICLES) sim.particles.shift();
    sim.particles.push(p);
  }

  function updateTraffic(sim, dt) {
    const tr = sim.track;
    const laneOff = tr.def.roadW * 0.24;
    const list = sim.traffic;

    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      if (t.nearMissCd > 0) t.nearMissCd -= dt;

      // Simple spacing check against cars ahead in same lane
      let targetSpd = t.baseSpeed;
      for (let j = 0; j < list.length; j++) {
        if (i === j) continue;
        const o = list[j];
        if (o.lane !== t.lane) continue;
        let dtAhead = o.t - t.t;
        if (dtAhead < 0) dtAhead += 1;
        const distAhead = dtAhead * tr.trackLen;
        if (distAhead > 0 && distAhead < 145) {
          targetSpd = Math.min(targetSpd, o.speed * 0.92);
        }
      }
      t.speed += (targetSpd - t.speed) * Math.min(1, 3 * dt);
      t.offset += (t.targetOffset - t.offset) * Math.min(1, 3 * dt);
      t.t = (t.t + (t.speed * dt) / tr.trackLen) % 1;

      const p = tr.pointAt(t.t);
      const tan = tr.tangentAt(t.t);
      const nx = -tan.y, ny = tan.x;
      t.x = p.x + nx * t.offset;
      t.y = p.y + ny * t.offset;
      t.angle = tan.angle;
      t.targetOffset = t.lane * laneOff;
    }
  }

  function sampleGhost(ghostData, lapElapsed) {
    if (!ghostData || ghostData.length < 8) return null;
    const count = ghostData.length / 4;
    const lastT = ghostData[(count - 1) * 4];
    if (lapElapsed > lastT + 0.5) return null;

    // Binary search for time bracket
    let lo = 0, hi = count - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (ghostData[mid * 4] <= lapElapsed) lo = mid;
      else hi = mid;
    }
    const t0 = ghostData[lo * 4], t1 = ghostData[hi * 4];
    const u = (t1 > t0) ? Math.max(0, Math.min(1, (lapElapsed - t0) / (t1 - t0))) : 0;
    const x = ghostData[lo * 4 + 1] + (ghostData[hi * 4 + 1] - ghostData[lo * 4 + 1]) * u;
    const y = ghostData[lo * 4 + 2] + (ghostData[hi * 4 + 2] - ghostData[lo * 4 + 2]) * u;
    const a0 = ghostData[lo * 4 + 3], a1 = ghostData[hi * 4 + 3];
    let da = a1 - a0;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    return { x, y, angle: a0 + da * u };
  }

  function step(sim, input, dt) {
    const r = sim.race;
    const tr = sim.track;
    const c = sim.car;

    // Always animate circuit traffic except when paused, finished, or in highway mode
    if (r.state !== 'paused' && r.state !== 'finish' && !(sim.modeId === 'highway' && sim.highway)) {
      updateTraffic(sim, dt);
    }

    // Decay banner & sector delta timers
    if (r.msgTimer > 0 && r.state !== 'paused') {
      r.msgTimer = Math.max(0, r.msgTimer - dt);
    }
    if (r.sectorDeltaTimer > 0 && r.state !== 'paused') {
      r.sectorDeltaTimer = Math.max(0, r.sectorDeltaTimer - dt);
    }
    if (sim.cam.shake > 0) {
      sim.cam.shake = Math.max(0, sim.cam.shake - dt * 2.8);
    }

    // Update popups
    for (let i = sim.popups.length - 1; i >= 0; i--) {
      const p = sim.popups[i];
      p.life -= dt;
      p.y -= 28 * dt;
      if (p.life <= 0) sim.popups.splice(i, 1);
    }

    // Highway Cruise mode has its own streamlined endless physics
    if (sim.modeId === 'highway' && sim.highway && r.state === 'racing') {
      stepHighway(sim, input, dt);
      return;
    }

    // Countdown phase
    if (r.state === 'countdown') {
      r.countdown -= dt;
      const n = Math.ceil(r.countdown);
      if (n !== r.lastCount && n > 0) {
        r.lastCount = n;
        showBanner(sim, String(n), 'GET READY', 0.92);
        if (G.Audio) G.Audio.playBeep(false);
      }
      if (r.countdown <= 0) {
        r.state = 'racing';
        r.raceTime = 0;
        r.lapStart = 0;
        showBanner(sim, 'GO!', '', 0.85);
        if (G.Audio) G.Audio.playBeep(true);
      }
      return;
    }

    if (r.state !== 'racing') return;

    r.raceTime += dt;

    // Drift Attack countdown
    if (sim.modeId === 'drift') {
      r.driftTimeLeft -= dt;
      if (r.driftTimeLeft <= 0) {
        r.driftTimeLeft = 0;
        // Bank any remaining drift
        if (r.driftCurrent >= 25) {
          const pts = Math.round(r.driftCurrent * r.driftMulti);
          r.driftScore += pts;
          if (pts > r.bestCombo) r.bestCombo = pts;
          r.driftCurrent = 0;
        }
        if (r.driftScore > r.bestDrift) {
          r.bestDrift = r.driftScore;
          sim.store.bestDrift[tr.def.id] = r.bestDrift;
          G.saveStore(sim.store);
        }
        r.state = 'finish';
        if (G.Audio) G.Audio.playLap(true);
        return;
      }
    }

    // Track proximity & surface detection
    const near = tr.nearestIdx(c.x, c.y, r.nearestIdx);
    const idx = near.idx;
    const dist = near.dist;
    const onOffroad = dist > tr.def.roadW * 0.5 - 4;
    c.onOffroad = onOffroad;

    let onIce = false;
    if (!onOffroad && tr.icePatches.length > 0) {
      for (let i = 0; i < tr.icePatches.length; i++) {
        const ip = tr.icePatches[i];
        const dx = c.x - ip.x, dy = c.y - ip.y;
        if (dx * dx + dy * dy < ip.rx * ip.rx) {
          onIce = true;
          break;
        }
      }
    }
    c.onIce = onIce;

    const phys = sim.carDef.phys;
    const speedAbs = Math.hypot(c.vx, c.vy);
    const maxSpd = phys.maxSpeed * (c.boosting ? 1.28 : 1.0);
    const speedT = Math.min(speedAbs / phys.maxSpeed, 1.2);

    // Boost logic
    const wantsBoost = !!input.boost && c.boost > 2 && input.up;
    c.boosting = wantsBoost;
    if (c.boosting) {
      c.boost = Math.max(0, c.boost - 34 * dt);
      sim.cam.shake = Math.max(sim.cam.shake, 0.14);
    } else {
      c.boost = Math.min(100, c.boost + 3.2 * dt);
    }

    // Smoothed throttle & brake
    const throttleTarget = input.up ? 1 : 0;
    const brakeTarget = input.down ? 1 : 0;
    c.throttle += (throttleTarget - c.throttle) * Math.min(1, (input.up ? 6.5 : 8.5) * dt);
    c.brake += (brakeTarget - c.brake) * Math.min(1, 11 * dt);

    // Speed-sensitive steering
    const steerInput = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    const steerLimit = phys.steerMax - Math.min(speedT, 1) * 0.34;
    const targetSteer = steerInput * steerLimit;
    const steerRate = steerInput === 0 ? 10.5 : 7.5;
    c.steer += (targetSteer - c.steer) * Math.min(1, steerRate * dt);

    // ---- 1. Decompose velocity onto old basis ----
    const fx = Math.cos(c.angle), fy = Math.sin(c.angle);
    const rx = -fy, ry = fx;
    let vf = c.vx * fx + c.vy * fy;
    let vl = c.vx * rx + c.vy * ry;

    // ---- 2. Longitudinal forces ----
    const boostAccelMul = c.boosting ? 1.55 : 1.0;
    const throttleForce = phys.accel * boostAccelMul * (1 - 0.48 * Math.min(speedT, 1));
    vf += c.throttle * throttleForce * dt;

    if (c.brake > 0.02) {
      if (vf > 25) {
        vf -= phys.brake * c.brake * dt;
      } else {
        vf = Math.max(vf - phys.brake * 0.58 * c.brake * dt, -REVERSE_MAX);
      }
    }

    // Drag (aerodynamic + surface)
    vf -= vf * BASE_DRAG * dt;
    if (onOffroad) {
      vf -= vf * (phys.offroadDrag * tr.def.offroadMul) * dt;
    }
    if (input.handbrake && Math.abs(vf) > 40) {
      vf -= vf * 0.75 * dt;
    }
    vf = Math.max(-REVERSE_MAX, Math.min(maxSpd, vf));

    // ---- 3. Steering yaw ----
    const handbrake = !!input.handbrake;
    c.handbrake = handbrake;
    const isDrifting = (handbrake && speedAbs > 150) || (Math.abs(vl) > 105 && speedAbs > 190);
    c.drifting = isDrifting;

    const yawGain = handbrake ? phys.driftYawGain : phys.yawGain;
    // Clamp effective speed for yaw so reverse & low-speed feel crisp
    const yawSpeed = Math.max(-240, Math.min(540, vf));
    let yaw = c.steer * yawSpeed * yawGain;
    // Slight turn-in assist when nearly stopped
    if (Math.abs(vf) < 18 && steerInput !== 0) {
      yaw += c.steer * 1.1;
    }
    c.angle += yaw * dt;

    // ---- 4. Recompose on old basis, project onto new basis, apply tire grip ----
    const tmpVx = fx * vf + rx * vl;
    const tmpVy = fy * vf + ry * vl;

    const nfx = Math.cos(c.angle), nfy = Math.sin(c.angle);
    const nrx = -nfy, nry = nfx;
    let nvf = tmpVx * nfx + tmpVy * nfy;
    let nvl = tmpVx * nrx + tmpVy * nry;

    let grip = handbrake ? phys.driftGrip : (onOffroad ? phys.offroadGrip : phys.grip);
    grip *= tr.def.gripMul;
    if (onIce) grip *= 0.42;

    const prevNvl = nvl;
    nvl *= Math.exp(-grip * dt);
    // Recover a touch of cornering momentum so sweeping turns feel fast & responsive
    const bled = Math.abs(prevNvl - nvl);
    if (!handbrake && !onOffroad && nvf > 80) {
      nvf = Math.min(maxSpd, nvf + bled * 0.16);
    }

    c.vx = nfx * nvf + nrx * nvl;
    c.vy = nfy * nvf + nry * nvl;
    c.vf = nvf;
    c.vl = nvl;

    // ---- 5. Integrate position ----
    c.x += c.vx * dt;
    c.y += c.vy * dt;

    // World bounds bounce
    const margin = 34;
    if (c.x < margin) { c.x = margin; c.vx = Math.abs(c.vx) * 0.45; sim.cam.shake = Math.max(sim.cam.shake, 0.3); }
    if (c.x > tr.def.world.w - margin) { c.x = tr.def.world.w - margin; c.vx = -Math.abs(c.vx) * 0.45; sim.cam.shake = Math.max(sim.cam.shake, 0.3); }
    if (c.y < margin) { c.y = margin; c.vy = Math.abs(c.vy) * 0.45; sim.cam.shake = Math.max(sim.cam.shake, 0.3); }
    if (c.y > tr.def.world.h - margin) { c.y = tr.def.world.h - margin; c.vy = -Math.abs(c.vy) * 0.45; sim.cam.shake = Math.max(sim.cam.shake, 0.3); }

    // ---- 6. Virtual 6-speed gearbox & RPM ----
    const newSpeed = Math.hypot(c.vx, c.vy);
    const normSpd = Math.min(newSpeed / phys.maxSpeed, 1.15);
    if (nvf < -15) {
      c.gear = 'R';
      c.gearNum = 0;
      c.rpm = 0.22 + Math.min(1, Math.abs(nvf) / REVERSE_MAX) * 0.65;
    } else {
      const g = Math.min(6, Math.max(1, Math.floor(normSpd * 5.6) + 1));
      c.gear = String(g);
      c.gearNum = g;
      const gearLow = (g - 1) / 5.6;
      const gearHigh = g / 5.6;
      const inGear = (normSpd - gearLow) / (gearHigh - gearLow);
      c.rpm = Math.max(0.16, Math.min(1.0, 0.24 + inGear * 0.74));
    }

    // ---- 7. Tire skidmarks & particles ----
    const slipAbs = Math.abs(nvl);
    const rearX = c.x - nfx * 15;
    const rearY = c.y - nfy * 15;
    const rlX = rearX - nrx * 9, rlY = rearY - nry * 9;
    const rrX = rearX + nrx * 9, rrY = rearY + nry * 9;

    const leavingSkids = (slipAbs > 95 && newSpeed > 150) || (handbrake && newSpeed > 180) || (c.brake > 0.7 && nvf > 360);
    if (leavingSkids) {
      if (c.prevRearL && c.prevRearR) {
        const dSeg = Math.hypot(rlX - c.prevRearL.x, rlY - c.prevRearL.y);
        if (dSeg > 3 && dSeg < 45) {
          const alpha = Math.min(0.45, 0.14 + (slipAbs / 380) * 0.32);
          const col = onOffroad ? tr.def.theme.offroadParticle : tr.def.theme.skidColor;
          addSkid(sim, c.prevRearL.x, c.prevRearL.y, rlX, rlY, alpha, col);
          addSkid(sim, c.prevRearR.x, c.prevRearR.y, rrX, rrY, alpha, col);
          c.prevRearL = { x: rlX, y: rlY };
          c.prevRearR = { x: rrX, y: rrY };
        }
      } else {
        c.prevRearL = { x: rlX, y: rlY };
        c.prevRearR = { x: rrX, y: rrY };
      }
    } else {
      c.prevRearL = null;
      c.prevRearR = null;
    }

    // Smoke / dirt / boost flame particles
    if (leavingSkids && Math.random() < 0.75) {
      for (let k = 0; k < 2; k++) {
        const wx = k === 0 ? rlX : rrX;
        const wy = k === 0 ? rlY : rrY;
        addParticle(sim, {
          x: wx + (Math.random() - 0.5) * 4,
          y: wy + (Math.random() - 0.5) * 4,
          vx: -c.vx * 0.1 + (Math.random() - 0.5) * 35,
          vy: -c.vy * 0.1 + (Math.random() - 0.5) * 35,
          life: 0.38 + Math.random() * 0.32,
          maxLife: 0.7,
          size: 4 + Math.random() * 5,
          color: onOffroad ? tr.def.theme.offroadParticle : 'rgba(205,210,218,',
        });
      }
    } else if (onOffroad && newSpeed > 180 && Math.random() < 0.5) {
      addParticle(sim, {
        x: rearX + (Math.random() - 0.5) * 14,
        y: rearY + (Math.random() - 0.5) * 14,
        vx: -c.vx * 0.12 + (Math.random() - 0.5) * 40,
        vy: -c.vy * 0.12 + (Math.random() - 0.5) * 40,
        life: 0.32 + Math.random() * 0.25,
        maxLife: 0.57,
        size: 3 + Math.random() * 4,
        color: tr.def.theme.offroadParticle,
      });
    }

    if (c.boosting) {
      addParticle(sim, {
        x: c.x - nfx * 23 + (Math.random() - 0.5) * 5,
        y: c.y - nfy * 23 + (Math.random() - 0.5) * 5,
        vx: -nfx * 260 + (Math.random() - 0.5) * 40,
        vy: -nfy * 260 + (Math.random() - 0.5) * 40,
        life: 0.14 + Math.random() * 0.1,
        maxLife: 0.24,
        size: 4 + Math.random() * 4,
        color: Math.random() > 0.4 ? 'rgba(56,189,248,' : 'rgba(251,146,60,',
      });
    }

    // Update particles
    for (let i = sim.particles.length - 1; i >= 0; i--) {
      const p = sim.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      if (p.life <= 0) sim.particles.splice(i, 1);
    }

    // ---- 8. Drift scoring & boost recharge ----
    const scoringDrift = !onOffroad && slipAbs > 105 && newSpeed > 210;
    if (scoringDrift) {
      c.boost = Math.min(100, c.boost + 18 * dt);
      r.driftIdle = 0;
      r.driftDur += dt;
      r.driftMulti = Math.min(5, 1 + Math.floor(r.driftDur / 1.35));
      r.driftCurrent += (slipAbs * 0.42 + newSpeed * 0.14) * dt;
    } else if (r.driftCurrent > 0) {
      r.driftIdle += dt;
      if (onOffroad && r.driftIdle > 0.35) {
        // Off-road cancels unbanked drift in Drift Attack
        if (sim.modeId === 'drift' && r.driftCurrent > 60) {
          addPopup(sim, c.x, c.y - 24, 'OFF-ROAD! LOST', '#f87171');
        }
        r.driftCurrent = 0;
        r.driftDur = 0;
        r.driftMulti = 1;
      } else if (r.driftIdle > 0.65) {
        if (r.driftCurrent >= 35) {
          const pts = Math.round(r.driftCurrent * r.driftMulti);
          r.driftScore += pts;
          if (pts > r.bestCombo) r.bestCombo = pts;
          if (sim.modeId === 'drift' || pts >= 180) {
            addPopup(sim, c.x, c.y - 24, '+' + pts.toLocaleString() + ' DRIFT', '#fde047');
            if (G.Audio) G.Audio.playDriftBank(pts);
          }
        }
        r.driftCurrent = 0;
        r.driftDur = 0;
        r.driftMulti = 1;
      }
    }

    // ---- 9. Traffic collision & near-miss ----
    for (let i = 0; i < sim.traffic.length; i++) {
      const t = sim.traffic[i];
      const dx = c.x - t.x, dy = c.y - t.y;
      const d = Math.hypot(dx, dy);
      const minD = c.radius + t.wid * 0.68;
      if (d < minD && d > 0.001) {
        const nx = dx / d, ny = dy / d;
        c.x = t.x + nx * minD;
        c.y = t.y + ny * minD;
        const rel = c.vx * nx + c.vy * ny;
        if (rel < 0) {
          c.vx -= nx * rel * 1.55;
          c.vy -= ny * rel * 1.55;
          c.vx *= 0.8;
          c.vy *= 0.8;
          const impact = Math.min(1, Math.abs(rel) / 500);
          sim.cam.shake = Math.max(sim.cam.shake, 0.28 + impact * 0.55);
          if (G.Audio) G.Audio.playCollision(impact);
          // Sparks
          for (let s = 0; s < 8; s++) {
            addParticle(sim, {
              x: c.x - nx * c.radius,
              y: c.y - ny * c.radius,
              vx: (Math.random() - 0.5) * 260,
              vy: (Math.random() - 0.5) * 260,
              life: 0.2 + Math.random() * 0.18,
              maxLife: 0.38,
              size: 2.5 + Math.random() * 2,
              color: 'rgba(253,224,71,',
            });
          }
          // Cancel unbanked drift on hard hit
          if (impact > 0.25 && r.driftCurrent > 40) {
            r.driftCurrent = 0;
            r.driftDur = 0;
            r.driftMulti = 1;
          }
        }
        t.nearMissCd = 2.0;
      } else if (d < minD + 30 && newSpeed > 420 && t.nearMissCd <= 0) {
        t.nearMissCd = 2.5;
        r.nearMisses++;
        c.boost = Math.min(100, c.boost + 20);
        addPopup(sim, c.x, c.y - 26, 'NEAR MISS! +20 BOOST', '#38bdf8');
        if (G.Audio) G.Audio.playNearMiss();
      }
    }

    // ---- 10. Checkpoints, sector splits, lap detection & ghost ----
    const lapElapsed = r.raceTime - r.lapStart;

    // Record ghost at 15Hz in Time Trial
    if (sim.modeId === 'timetrial') {
      sim.ghostRecTimer += dt;
      if (sim.ghostRecTimer >= 1 / 15) {
        sim.ghostRecTimer -= 1 / 15;
        if (sim.ghostRec.length < 4 * 1800) { // cap at 2 min
          sim.ghostRec.push(
            Math.round(lapElapsed * 100) / 100,
            Math.round(c.x * 10) / 10,
            Math.round(c.y * 10) / 10,
            Math.round(c.angle * 1000) / 1000
          );
        }
      }
      sim.ghostPose = sampleGhost(sim.ghostData, lapElapsed);
    } else {
      sim.ghostPose = null;
    }

    // Checkpoints (25%, 50%, 75%)
    for (let k = 0; k < 3; k++) {
      if (!r.sectorFlags[k]) {
        const cp = tr.checkpoints[k];
        if (Math.abs(idx - cp) < 28) {
          r.sectorFlags[k] = true;
          if (r.bestLap != null) {
            const expected = r.bestLap * ((k + 1) * 0.25);
            r.sectorDelta = lapElapsed - expected;
            r.sectorDeltaTimer = 2.6;
          }
        }
      }
    }

    // Lap completion: wrap from tail to head with all 3 checkpoints cleared
    if (r.nearestIdx > tr.N * 0.82 && idx < tr.N * 0.18) {
      const allSectors = r.sectorFlags[0] && r.sectorFlags[1] && r.sectorFlags[2];
      if (allSectors && lapElapsed > 8) {
        r.lastLap = lapElapsed;
        let isNewBest = false;
        if (r.sessionBestLap == null || lapElapsed < r.sessionBestLap) {
          r.sessionBestLap = lapElapsed;
        }
        if (r.bestLap == null || lapElapsed < r.bestLap) {
          r.bestLap = lapElapsed;
          isNewBest = true;
          sim.store.bestLaps[tr.def.id] = { time: lapElapsed, carId: sim.carDef.id };
          if (sim.modeId === 'timetrial' && sim.ghostRec.length >= 12) {
            sim.ghostData = sim.ghostRec.slice();
            sim.store.ghosts[tr.def.id] = sim.ghostData;
          }
          G.saveStore(sim.store);
        }

        const medal = G.getMedal(tr.def, lapElapsed);
        r.lap++;
        r.lapStart = r.raceTime;
        r.sectorFlags = [false, false, false];
        sim.ghostRec.length = 0;
        sim.ghostRecTimer = 0;

        if (isNewBest) {
          const mTxt = medal ? (' • ' + medal.toUpperCase() + ' MEDAL!') : '';
          showBanner(sim, 'NEW BEST!', G.fmtTime(lapElapsed) + mTxt, 1.8);
        } else {
          showBanner(sim, 'LAP ' + r.lap, 'Last ' + G.fmtTime(lapElapsed), 1.3);
        }
        if (G.Audio) G.Audio.playLap(isNewBest);
      }
    }
    r.nearestIdx = idx;

    // ---- 11. Update Audio ----
    if (G.Audio) {
      const slipNorm = Math.min(1, slipAbs / 280);
      G.Audio.updateEngine(
        true,
        Math.min(1, newSpeed / phys.maxSpeed),
        c.rpm,
        c.gearNum,
        c.throttle,
        slipNorm,
        onOffroad,
        c.boosting
      );
    }
  }

  G.PHYS_DT = PHYS_DT;
  G.Physics = {
    createSim,
    placeCarAtStart,
    resetToTrack,
    startSession,
    spawnTraffic,
    showBanner,
    step,
  };
})(window.DriveSim = window.DriveSim || {});
