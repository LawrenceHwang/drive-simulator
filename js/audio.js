(function (G) {
  "use strict";

  let ctx = null;
  let masterGain = null;
  let sfxGain = null;

  // Engine nodes
  let osc1 = null, osc2 = null, engFilter = null, engGain = null;
  let turboOsc = null, turboGain = null;

  // Tire screech & offroad rumble
  let screechSrc = null, screechFilter = null, screechGain = null;
  let rumbleSrc = null, rumbleFilter = null, rumbleGain = null;

  // Radio synth state
  let radioGain = null;
  let radioTimer = null;
  let radioStep = 0;

  let muted = false;
  let radioOn = false;
  let lastGear = 1;

  function createNoiseBuffer(audioCtx, seconds) {
    const len = Math.floor(audioCtx.sampleRate * seconds);
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();

      masterGain = ctx.createGain();
      masterGain.gain.value = muted ? 0 : 0.85;
      masterGain.connect(ctx.destination);

      sfxGain = ctx.createGain();
      sfxGain.gain.value = 1.0;
      sfxGain.connect(masterGain);

      // Engine: dual detuned oscillators + lowpass
      engFilter = ctx.createBiquadFilter();
      engFilter.type = 'lowpass';
      engFilter.frequency.value = 500;
      engFilter.Q.value = 2.2;

      engGain = ctx.createGain();
      engGain.gain.value = 0;

      osc1 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.value = 55;

      osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.value = 27.5;

      osc1.connect(engFilter);
      osc2.connect(engFilter);
      engFilter.connect(engGain);
      engGain.connect(sfxGain);
      osc1.start();
      osc2.start();

      // Turbo whine
      turboOsc = ctx.createOscillator();
      turboOsc.type = 'sine';
      turboOsc.frequency.value = 420;
      turboGain = ctx.createGain();
      turboGain.gain.value = 0;
      turboOsc.connect(turboGain).connect(sfxGain);
      turboOsc.start();

      // Shared noise buffer
      const noiseBuf = createNoiseBuffer(ctx, 2.0);

      // Tire screech
      screechSrc = ctx.createBufferSource();
      screechSrc.buffer = noiseBuf;
      screechSrc.loop = true;
      screechFilter = ctx.createBiquadFilter();
      screechFilter.type = 'bandpass';
      screechFilter.frequency.value = 1350;
      screechFilter.Q.value = 5.5;
      screechGain = ctx.createGain();
      screechGain.gain.value = 0;
      screechSrc.connect(screechFilter).connect(screechGain).connect(sfxGain);
      screechSrc.start();

      // Offroad gravel/grass rumble
      rumbleSrc = ctx.createBufferSource();
      rumbleSrc.buffer = noiseBuf;
      rumbleSrc.loop = true;
      rumbleFilter = ctx.createBiquadFilter();
      rumbleFilter.type = 'lowpass';
      rumbleFilter.frequency.value = 260;
      rumbleGain = ctx.createGain();
      rumbleGain.gain.value = 0;
      rumbleSrc.connect(rumbleFilter).connect(rumbleGain).connect(sfxGain);
      rumbleSrc.start();

      // Radio bus
      radioGain = ctx.createGain();
      radioGain.gain.value = radioOn ? 0.24 : 0;
      radioGain.connect(masterGain);

      if (radioOn) startRadioLoop();
      return true;
    } catch (e) {
      ctx = null;
      return false;
    }
  }

  function setMuted(m) {
    muted = !!m;
    if (masterGain && ctx) {
      masterGain.gain.setTargetAtTime(muted ? 0 : 0.85, ctx.currentTime, 0.04);
    }
  }

  function setRadio(on) {
    radioOn = !!on;
    if (radioOn) ensure();
    if (radioGain && ctx) {
      radioGain.gain.setTargetAtTime(radioOn ? 0.24 : 0, ctx.currentTime, 0.15);
    }
    if (radioOn) startRadioLoop();
    else stopRadioLoop();
  }

  function updateEngine(active, speedNorm, rpm, gear, throttle, slipNorm, onOffroad, boosting) {
    if (!ctx || !osc1) return;
    const now = ctx.currentTime;
    if (!active || muted) {
      engGain.gain.setTargetAtTime(0, now, 0.08);
      screechGain.gain.setTargetAtTime(0, now, 0.06);
      rumbleGain.gain.setTargetAtTime(0, now, 0.06);
      turboGain.gain.setTargetAtTime(0, now, 0.08);
      return;
    }

    // Subtle shift pop when upshifting
    if (gear > lastGear && speedNorm > 0.12) {
      playShiftPop();
    }
    lastGear = gear;

    const baseFreq = 46 + rpm * 155 + (boosting ? 28 : 0);
    osc1.frequency.setTargetAtTime(baseFreq, now, 0.035);
    osc2.frequency.setTargetAtTime(baseFreq * 0.502, now, 0.035);
    engFilter.frequency.setTargetAtTime(320 + rpm * 1450 + throttle * 420 + (boosting ? 600 : 0), now, 0.04);
    engGain.gain.setTargetAtTime(0.045 + throttle * 0.035 + rpm * 0.025 + (boosting ? 0.025 : 0), now, 0.06);

    // Turbo whine
    turboOsc.frequency.setTargetAtTime(520 + speedNorm * 680 + (boosting ? 340 : 0), now, 0.05);
    turboGain.gain.setTargetAtTime(boosting ? 0.032 : 0, now, 0.06);

    // Tire screech on asphalt
    const screechAmt = (!onOffroad && slipNorm > 0.18) ? Math.min(1, (slipNorm - 0.18) * 1.4) : 0;
    screechFilter.frequency.setTargetAtTime(1150 + speedNorm * 550, now, 0.05);
    screechGain.gain.setTargetAtTime(screechAmt * 0.065, now, 0.04);

    // Off-road rumble
    const rumbleAmt = onOffroad ? Math.min(1, speedNorm * 1.6) : 0;
    rumbleGain.gain.setTargetAtTime(rumbleAmt * 0.09, now, 0.05);
  }

  function playShiftPop() {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(130, now);
    o.frequency.exponentialRampToValueAtTime(48, now + 0.07);
    g.gain.setValueAtTime(0.06, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    o.connect(g).connect(sfxGain);
    o.start(now);
    o.stop(now + 0.09);
  }

  function playBeep(isGo) {
    if (!ensure() || muted) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = isGo ? 'triangle' : 'sine';
    o.frequency.setValueAtTime(isGo ? 880 : 440, now);
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + (isGo ? 0.38 : 0.18));
    o.connect(g).connect(sfxGain);
    o.start(now);
    o.stop(now + (isGo ? 0.4 : 0.2));
  }

  function playLap(isBest) {
    if (!ensure() || muted) return;
    const now = ctx.currentTime;
    const notes = isBest ? [523.25, 659.25, 783.99, 1046.5] : [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.075;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.11, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      o.connect(g).connect(sfxGain);
      o.start(t);
      o.stop(t + 0.3);
    });
  }

  function playCollision(intensity) {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const k = Math.min(1, Math.max(0.2, intensity));
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(110 * k + 50, now);
    o.frequency.exponentialRampToValueAtTime(32, now + 0.16);
    g.gain.setValueAtTime(0.16 * k, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    o.connect(g).connect(sfxGain);
    o.start(now);
    o.stop(now + 0.19);
  }

  function playDriftBank(points) {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const base = Math.min(880, 420 + points * 0.18);
    [base, base * 1.25].forEach((freq, i) => {
      const t = now + i * 0.06;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.09, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      o.connect(g).connect(sfxGain);
      o.start(t);
      o.stop(t + 0.24);
    });
  }

  function playNearMiss() {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(640, now);
    o.frequency.exponentialRampToValueAtTime(1180, now + 0.12);
    g.gain.setValueAtTime(0.08, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    o.connect(g).connect(sfxGain);
    o.start(now);
    o.stop(now + 0.16);
  }

  function playClick() {
    if (!ensure() || muted) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(680, now);
    g.gain.setValueAtTime(0.05, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    o.connect(g).connect(sfxGain);
    o.start(now);
    o.stop(now + 0.05);
  }

  // ---------- Procedural Chill Synthwave Bus Radio ----------
  // 104 BPM, 16th-note step = ~144ms
  const CHORDS = [
    [220.00, 261.63, 329.63, 392.00], // Am7
    [174.61, 220.00, 261.63, 329.63], // Fmaj7
    [261.63, 329.63, 392.00, 493.88], // Cmaj7
    [196.00, 246.94, 293.66, 392.00], // G6
  ];
  const BASS = [110.00, 87.31, 130.81, 98.00];
  const ARP = [440, 523.25, 659.25, 783.99, 659.25, 523.25, 587.33, 493.88];

  function startRadioLoop() {
    if (radioTimer || !ctx) return;
    radioStep = 0;
    radioTimer = setInterval(() => {
      if (!ctx || !radioOn || muted || ctx.state !== 'running') return;
      const now = ctx.currentTime;
      const bar = Math.floor(radioStep / 16) % CHORDS.length;
      const beat = radioStep % 16;

      // Soft warm pad chord on beat 0
      if (beat === 0) {
        CHORDS[bar].forEach((freq) => {
          const o = ctx.createOscillator();
          const f = ctx.createBiquadFilter();
          const g = ctx.createGain();
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(freq, now);
          f.type = 'lowpass';
          f.frequency.setValueAtTime(720, now);
          g.gain.setValueAtTime(0.001, now);
          g.gain.linearRampToValueAtTime(0.055, now + 0.25);
          g.gain.exponentialRampToValueAtTime(0.001, now + 2.2);
          o.connect(f).connect(g).connect(radioGain);
          o.start(now);
          o.stop(now + 2.25);
        });
      }

      // Driving synth bass on 8th notes
      if (beat % 2 === 0) {
        const o = ctx.createOscillator();
        const f = ctx.createBiquadFilter();
        const g = ctx.createGain();
        o.type = 'sawtooth';
        const oct = (beat % 4 === 2) ? 2 : 1;
        o.frequency.setValueAtTime(BASS[bar] * oct, now);
        f.type = 'lowpass';
        f.frequency.setValueAtTime(420, now);
        g.gain.setValueAtTime(0.11, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        o.connect(f).connect(g).connect(radioGain);
        o.start(now);
        o.stop(now + 0.24);
      }

      // Soft kick on 0, 4, 8, 12
      if (beat % 4 === 0) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(125, now);
        o.frequency.exponentialRampToValueAtTime(42, now + 0.11);
        g.gain.setValueAtTime(0.24, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        o.connect(g).connect(radioGain);
        o.start(now);
        o.stop(now + 0.17);
      }

      // Chill shimmer arp on select steps
      if (beat % 4 === 2 || beat === 15) {
        const note = ARP[(radioStep + bar * 2) % ARP.length];
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(note, now);
        g.gain.setValueAtTime(0.055, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
        o.connect(g).connect(radioGain);
        o.start(now);
        o.stop(now + 0.28);
      }

      radioStep++;
    }, 145);
  }

  function stopRadioLoop() {
    if (radioTimer) {
      clearInterval(radioTimer);
      radioTimer = null;
    }
  }

  G.Audio = {
    ensure,
    setMuted,
    setRadio,
    updateEngine,
    playBeep,
    playLap,
    playCollision,
    playDriftBank,
    playNearMiss,
    playClick,
    isMuted: () => muted,
    isRadioOn: () => radioOn,
  };
})(window.DriveSim = window.DriveSim || {});
