(() => {
  "use strict";

  const SAVE_KEY = "icarus";
  const FORWARD = 120;
  // Height is squared and capped at the top of the sky. The square still
  // favors altitude, but a regular pair can earn in the band it can hold.
  const SCORE_RATE = 0.32;

  const WINGS = [
    {
      id: "basic",
      name: "Basic wax",
      price: 0,
      blurb: "A first pair. Enough to leave the cliff.",
      feather: "#f4e4c4",
      lift: 820,
      gravity: 250,
      maxRise: 280,
      maxFall: 150,
      ceiling: 0.5,
      endurance: 1.1,
      drift: 0.085,
      span: 1,
    },
    {
      id: "gull",
      name: "Gull",
      price: 200,
      blurb: "Climbs easily, and a little more sky feels welcome.",
      feather: "#d7e0e8",
      lift: 1180,
      gravity: 220,
      maxRise: 380,
      maxFall: 135,
      ceiling: 0.66,
      endurance: 1.45,
      drift: 0.08,
      span: 1.14,
    },
    {
      id: "reinforced",
      name: "Reinforced wax",
      price: 560,
      blurb: "Heavier on the climb. The wax holds longer.",
      feather: "#e2b15c",
      lift: 1100,
      gravity: 280,
      maxRise: 210,
      maxFall: 165,
      ceiling: 0.58,
      endurance: 3.15,
      drift: 0.065,
      span: 0.92,
    },
    {
      id: "daedalus",
      name: "Daedalus's spare",
      price: 1400,
      blurb: "Strong climb, and the most time near the sun.",
      feather: "#f7f3e4",
      lift: 1360,
      gravity: 240,
      maxRise: 420,
      maxFall: 145,
      ceiling: 0.8,
      endurance: 3.4,
      drift: 0.05,
      span: 1.26,
    },
  ];

  const canvas = document.getElementById("view");
  const ctx = canvas.getContext("2d");
  const hangarEl = document.getElementById("hangar");
  const tallyEl = document.getElementById("tally");
  const hudEl = document.getElementById("hud");
  const hintEl = document.getElementById("hud-hint");
  const wingsEl = document.getElementById("wings");
  const purseEl = document.getElementById("purse");
  const bestEl = document.getElementById("best");
  const hudScoreEl = document.getElementById("hud-score");
  const hudPurseEl = document.getElementById("hud-purse");

  const state = {
    mode: "hangar",
    purse: 0,
    best: 0,
    equippedId: "basic",
    seenTutorial: false,
    run: 0,
    y: 0,
    vy: 0,
    heat: 0,
    melted: false,
    crashed: false,
    resolve: 0,
    climbing: false,
    flap: 0,
    spin: 0,
    shake: 0,
    hint: 1,
    worldX: 0,
    logicalW: 1,
    logicalH: 1,
    paidWing: false,
    newBest: false,
  };

  const particles = [];
  let clock = 0;
  let last = 0;
  let hudShown = -1;
  let climbingLast = false;
  let audioCtx = null;

  function wingById(id) {
    return WINGS.find((wing) => wing.id === id) || WINGS[0];
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function formatScore(value) {
    return Math.floor(value).toLocaleString("en-US");
  }

  function hexChannels(color) {
    const value = color.slice(1);
    return [
      parseInt(value.slice(0, 2), 16),
      parseInt(value.slice(2, 4), 16),
      parseInt(value.slice(4, 6), 16),
    ];
  }

  function mix(from, to, amount) {
    const t = clamp(amount, 0, 1);
    const a = hexChannels(from);
    const b = hexChannels(to);
    const channels = a.map((channel, index) => Math.round(channel + (b[index] - channel) * t));
    return `rgb(${channels[0]}, ${channels[1]}, ${channels[2]})`;
  }

  function seaLevel() {
    return state.logicalH * 0.78;
  }

  function playerX() {
    return state.logicalW * 0.3;
  }

  function sunDrift(time) {
    return Math.sin(time * 0.31) * 0.62 + Math.sin(time * 0.13 + 2.1) * 0.38;
  }

  function warningLook(heat) {
    if (heat < 0.4) return heat * 0.12;
    if (heat < 0.72) return 0.05 + (heat - 0.4) * 0.45;
    return Math.min(1, 0.2 + (heat - 0.72) * 2.6);
  }

  function save() {
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({
          purse: state.purse,
          best: state.best,
          equippedId: state.equippedId,
          seenTutorial: state.seenTutorial,
        })
      );
    } catch (error) {
      /* Saving is optional if storage is blocked. */
    }
  }

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
      state.purse = Math.max(0, Number(data.purse) || 0);
      state.best = Math.max(0, Number(data.best) || 0);
      state.equippedId = WINGS.some((wing) => wing.id === data.equippedId)
        ? data.equippedId
        : "basic";
      state.seenTutorial = Boolean(data.seenTutorial);
    } catch (error) {
      state.purse = 0;
      state.best = 0;
      state.equippedId = "basic";
      state.seenTutorial = false;
    }
  }

  const LESSONS = [
    {
      title: "Hold to climb",
      body: "Hold Space, or press and hold on the sky. Let go and he falls. The world moves forward on its own.",
    },
    {
      title: "The sea ends it",
      body: "Touch the water and the flight is over. If you never climb, that is where he goes.",
    },
    {
      title: "Height fills the purse",
      body: "The score grows as he travels. Near the waves it crawls. Higher up it grows much faster. When the flight ends, that score is added to your purse.",
    },
    {
      title: "The wings fail suddenly",
      body: "Stay high and the sky warms. The wax shines. Then the wings are gone, all at once, and he falls. Nothing tells you the height a pair can bear, and the sun does not stay still.",
    },
    {
      title: "A bought pair lasts one flight",
      body: "You begin with basic wax. Spend the purse in the hangar before you fly. The sea or the sun destroys the pair you bought. Unspent money remains, and the basic wings are always there.",
    },
  ];

  const tutorialEl = document.getElementById("tutorial");
  let lessonIndex = 0;

  function renderLesson() {
    const lesson = LESSONS[lessonIndex];
    document.getElementById("lesson-step").textContent = `Lesson ${lessonIndex + 1} of ${LESSONS.length}`;
    document.getElementById("lesson-title").textContent = lesson.title;
    document.getElementById("lesson-body").textContent = lesson.body;
    const dots = document.getElementById("lesson-dots");
    dots.replaceChildren();
    LESSONS.forEach((_, index) => {
      const dot = document.createElement("span");
      if (index === lessonIndex) dot.className = "is-on";
      dots.append(dot);
    });
    const back = document.getElementById("lesson-back");
    const next = document.getElementById("lesson-next");
    const skip = document.getElementById("lesson-skip");
    back.disabled = lessonIndex === 0;
    const last = lessonIndex === LESSONS.length - 1;
    next.textContent = last ? "Done" : "Next";
    skip.hidden = last;
  }

  function openTutorial() {
    if (state.mode === "flight") return;
    if (state.mode !== "hangar") showHangar();
    lessonIndex = 0;
    tutorialEl.hidden = false;
    renderLesson();
  }

  function closeTutorial() {
    state.seenTutorial = true;
    save();
    tutorialEl.hidden = true;
  }

  function stepLesson(direction) {
    const next = lessonIndex + direction;
    if (next < 0) return;
    if (next >= LESSONS.length) {
      closeTutorial();
      return;
    }
    lessonIndex = next;
    renderLesson();
  }

  function renderHangar() {
    purseEl.textContent = formatScore(state.purse);
    bestEl.textContent = formatScore(state.best);
    wingsEl.replaceChildren();
    const current = wingById(state.equippedId);

    WINGS.forEach((wing) => {
      const affordable = state.purse + current.price - wing.price >= 0;
      const equipped = wing.id === current.id;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "wing";
      if (equipped) button.classList.add("is-equipped");
      button.disabled = !equipped && !affordable;

      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.background = wing.feather;

      const name = document.createElement("span");
      name.className = "wing-name";
      name.textContent = wing.name;

      const price = document.createElement("span");
      price.className = "wing-price";
      price.textContent = wing.price === 0 ? "Free" : formatScore(wing.price);

      const blurb = document.createElement("span");
      blurb.className = "wing-blurb";
      blurb.textContent = wing.blurb;

      const tag = document.createElement("span");
      tag.className = "wing-tag";
      if (equipped) tag.textContent = "Equipped";
      else if (!affordable) tag.textContent = "Too dear";
      else tag.textContent = wing.price === 0 ? "Use" : "Buy";

      button.append(swatch, name, price, blurb, tag);
      button.addEventListener("click", () => selectWing(wing.id));
      wingsEl.append(button);
    });
  }

  function selectWing(id) {
    if (state.mode !== "hangar") return;
    const next = wingById(id);
    const current = wingById(state.equippedId);
    if (next.id === current.id) return;
    const purseAfter = state.purse + current.price - next.price;
    if (purseAfter < 0) return;
    state.purse = purseAfter;
    state.equippedId = next.id;
    save();
    renderHangar();
  }

  function showHangar() {
    state.mode = "hangar";
    state.melted = false;
    state.crashed = false;
    state.shake = 0;
    state.worldX = 0;
    particles.length = 0;
    tallyEl.hidden = true;
    hudEl.hidden = true;
    hintEl.hidden = true;
    hangarEl.hidden = false;
    tutorialEl.hidden = state.seenTutorial;
    if (!state.seenTutorial) {
      lessonIndex = 0;
      renderLesson();
    }
    renderHangar();
  }

  function startFlight() {
    if (state.mode === "flight") return;
    const wing = wingById(state.equippedId);
    state.mode = "flight";
    state.run = 0;
    state.heat = 0;
    state.melted = false;
    state.crashed = false;
    state.resolve = 0;
    state.vy = 0;
    state.flap = 0;
    state.spin = 0;
    state.shake = 0;
    state.hint = 1;
    state.worldX = 0;
    state.y = seaLevel() * (1 - 0.4);
    state.paidWing = wing.price > 0;
    climbingLast = false;
    particles.length = 0;
    hudShown = -1;
    hangarEl.hidden = true;
    tutorialEl.hidden = true;
    tallyEl.hidden = true;
    hudEl.hidden = false;
    hintEl.hidden = false;
    updateHud();
  }

  function updateHud() {
    const shown = Math.floor(state.run);
    if (shown !== hudShown) {
      hudShown = shown;
      hudScoreEl.textContent = formatScore(shown);
    }
    hudPurseEl.textContent = `Purse ${formatScore(state.purse)}`;
    hintEl.hidden = state.hint <= 0;
  }

  function openTally() {
    if (state.mode !== "flight") return;
    const earned = Math.floor(state.run);
    state.newBest = earned > state.best;
    if (state.newBest) state.best = earned;
    state.purse += earned;
    const paidWing = state.paidWing;
    const melted = state.melted;
    state.equippedId = "basic";
    state.paidWing = false;
    state.mode = "tally";
    save();

    document.getElementById("tally-cause").textContent = melted
      ? "The wax held, and then it didn't."
      : "Too low, and the water took the rest.";
    document.getElementById("tally-title").textContent = melted
      ? "The wings gave out"
      : "The sea closed over him";
    const bestLine = state.newBest ? " A new best flight." : "";
    document.getElementById("tally-score").textContent =
      `This flight added ${formatScore(earned)} to your purse.${bestLine}`;
    document.getElementById("tally-wings").textContent = paidWing
      ? "The wings you bought did not survive."
      : "The basic pair is still in the hangar.";

    hudEl.hidden = true;
    hintEl.hidden = true;
    hangarEl.hidden = true;
    tallyEl.hidden = false;
    if (document.activeElement) document.activeElement.blur();
  }

  function tone(freq, duration, type, gainValue, slide) {
    try {
      if (!audioCtx) audioCtx = new AudioContext();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const start = audioCtx.currentTime;
      const oscillator = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(freq, start);
      if (slide) {
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, slide), start + duration);
      }
      gain.gain.setValueAtTime(gainValue, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      oscillator.connect(gain);
      gain.connect(audioCtx.destination);
      oscillator.start(start);
      oscillator.stop(start + duration);
    } catch (error) {
      audioCtx = null;
    }
  }

  function pushParticle(particle) {
    particles.push(particle);
    if (particles.length > 90) particles.shift();
  }

  function meltWings() {
    if (state.melted) return;
    state.melted = true;
    state.shake = 1;
    state.vy = Math.max(state.vy, 90);
    const wing = wingById(state.equippedId);
    for (let index = 0; index < 18; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 180;
      pushParticle({
        x: playerX() + Math.cos(angle) * 24,
        y: state.y + Math.sin(angle) * 12,
        vx: Math.cos(angle) * speed - 40,
        vy: Math.sin(angle) * speed - 50,
        life: 1.3,
        max: 1.3,
        kind: "feather",
        rot: Math.random() * 6,
        spin: Math.random() * 6 - 3,
        color: wing.feather,
      });
    }
    tone(520, 0.45, "sawtooth", 0.045, 70);
  }

  function crash() {
    if (state.crashed) return;
    state.crashed = true;
    state.resolve = 1.05;
    state.shake = Math.max(state.shake, 0.45);
    const surface = waveAt(playerX(), state.worldX, clock, seaLevel());
    for (let index = 0; index < 24; index += 1) {
      pushParticle({
        x: playerX() + (Math.random() * 36 - 18),
        y: surface,
        vx: (Math.random() * 2 - 1) * 160,
        vy: -70 - Math.random() * 180,
        life: 0.95,
        max: 0.95,
        kind: "foam",
        r: 2 + Math.random() * 3,
      });
    }
    tone(110, 0.32, "sine", 0.07, 50);
  }

  function spawnDrip() {
    pushParticle({
      x: playerX() + (Math.random() * 50 - 25),
      y: state.y + 6,
      vx: -30 - Math.random() * 20,
      vy: 30 + Math.random() * 40,
      life: 0.7,
      max: 0.7,
      kind: "drip",
      r: 1.5 + Math.random() * 1.5,
    });
  }

  function updateFlight(dt) {
    const wing = wingById(state.equippedId);
    const sea = seaLevel();

    if (!state.crashed) {
      state.worldX += FORWARD * dt;
      const heightAboveSea = Math.max(0, sea - state.y);
      const playfieldHeight = sea;
      const heightPay = Math.min(1, heightAboveSea / playfieldHeight);
      const distanceThisFrame = FORWARD * dt;
      state.run += distanceThisFrame * heightPay ** 2 * SCORE_RATE;

      if (!state.melted) {
        const ceiling = wing.ceiling + sunDrift(clock) * wing.drift;
        const ratio = heightAboveSea / playfieldHeight;
        if (ratio > ceiling) {
          const over = (ratio - ceiling) / Math.max(0.12, 1 - wing.ceiling);
          state.heat += (dt * (0.55 + over * 1.85)) / wing.endurance;
        } else {
          state.heat -= dt * (0.32 + (ceiling - ratio) * 0.9);
        }
        state.heat = clamp(state.heat, 0, 1);
        if (state.heat >= 1) meltWings();
      }

      if (!state.melted) {
        state.vy += (wing.gravity - (state.climbing ? wing.lift : 0)) * dt;
        state.vy = clamp(state.vy, -wing.maxRise, wing.maxFall);
        state.flap += dt * (state.climbing ? 14 : 2.2);
        if (state.climbing && !climbingLast) tone(240, 0.07, "sine", 0.025, 360);
      } else {
        state.vy += wing.gravity * 1.35 * dt;
        state.vy = Math.min(state.vy, wing.maxFall * 1.45);
        state.spin += dt * 2.6;
        state.flap += dt * 2;
      }

      state.y += state.vy * dt;
      const minY = -state.logicalH * 0.08;
      if (state.y < minY) {
        state.y = minY;
        state.vy = Math.max(0, state.vy);
      }

      const surface = waveAt(playerX(), state.worldX, clock, sea);
      if (state.y + 32 >= surface) {
        state.y = surface - 32;
        crash();
      }

      if (!state.melted && state.heat > 0.62 && Math.random() < dt * 10 * state.heat) {
        spawnDrip();
      }
      if (state.climbing) state.hint = 0;
      else state.hint = Math.max(0, state.hint - dt * 0.12);
      climbingLast = state.climbing && !state.melted;
    } else {
      state.resolve -= dt;
      state.y += 16 * dt;
      state.spin += dt;
      if (state.resolve <= 0) openTally();
    }

    state.shake *= Math.exp(-3.2 * dt);
  }

  function updateParticles(dt) {
    particles.forEach((particle) => {
      particle.life -= dt;
      particle.vy += 320 * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.rot += (particle.spin || 0) * dt;
    });
    for (let index = particles.length - 1; index >= 0; index -= 1) {
      if (particles[index].life <= 0) particles.splice(index, 1);
    }
  }

  function waveAt(x, scroll, time, sea) {
    return (
      sea +
      Math.sin((x + scroll) * 0.018 + time * 1.4) * 5 +
      Math.sin((x + scroll * 0.7) * 0.009 - time) * 3
    );
  }

  function drawSky(look) {
    const { logicalW: w, logicalH: h } = state;
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, mix("#1c3f73", "#7a2a12", look * 0.85));
    gradient.addColorStop(0.45, mix("#5aa0d4", "#e8844a", look * 0.55));
    gradient.addColorStop(0.78, mix("#f0c98a", "#ffb088", look * 0.4));
    gradient.addColorStop(1, mix("#14596c", "#c45a3a", look * 0.25));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }

  function drawSun(look) {
    const drift = sunDrift(clock);
    const x = state.logicalW * 0.8;
    const y = state.logicalH * 0.14 + drift * 10;
    const radius = 34 + look * 26;
    const glow = ctx.createRadialGradient(x, y, 8, x, y, radius * 4.2);
    glow.addColorStop(0, "rgba(255, 246, 214, 0.95)");
    glow.addColorStop(0.18, `rgba(255, 196, 92, ${0.5 + look * 0.35})`);
    glow.addColorStop(1, "rgba(255, 160, 60, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius * 4.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(clock * 0.12);
    ctx.strokeStyle = `rgba(255, 226, 170, ${0.22 + look * 0.5})`;
    ctx.lineWidth = 2;
    for (let index = 0; index < 12; index += 1) {
      ctx.rotate(Math.PI / 6);
      ctx.beginPath();
      ctx.moveTo(radius + 6, 0);
      ctx.lineTo(radius + 26 + look * 46, 0);
      ctx.stroke();
    }
    ctx.restore();

    const core = ctx.createRadialGradient(x - 8, y - 8, 4, x, y, radius);
    core.addColorStop(0, "#fffaf0");
    core.addColorStop(0.55, "#ffd36a");
    core.addColorStop(1, look > 0.45 ? "#ff8a3d" : "#f0b44a");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawClouds(scroll) {
    ctx.fillStyle = "rgba(255, 250, 245, 0.72)";
    for (let index = 0; index < 8; index += 1) {
      const width = state.logicalW + 260;
      const x = ((index * 240 - scroll * 0.22) % width + width) % width - 80;
      const y = 46 + ((index * 67) % 150);
      const scale = 0.75 + (index % 4) * 0.18;
      ctx.beginPath();
      ctx.ellipse(x, y, 46 * scale, 16 * scale, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 28 * scale, y + 4, 32 * scale, 14 * scale, 0, 0, Math.PI * 2);
      ctx.ellipse(x - 26 * scale, y + 6, 28 * scale, 12 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMountains(sea, scroll) {
    ctx.beginPath();
    ctx.moveTo(0, sea);
    for (let x = 0; x <= state.logicalW; x += 16) {
      const ridge =
        Math.sin((x + scroll * 0.15) * 0.012) * 26 +
        Math.sin((x + scroll * 0.15) * 0.004 + 1) * 48;
      ctx.lineTo(x, sea - 78 - ridge);
    }
    ctx.lineTo(state.logicalW, sea);
    ctx.closePath();
    ctx.fillStyle = "rgba(86, 104, 128, 0.38)";
    ctx.fill();
  }

  function drawBirds(scroll) {
    ctx.strokeStyle = "rgba(48, 36, 30, 0.4)";
    ctx.lineWidth = 1.4;
    for (let index = 0; index < 6; index += 1) {
      const span = state.logicalW + 160;
      const x = ((index * 260 - scroll * 0.35 + clock * 16) % span + span) % span - 40;
      const y = 70 + ((index * 47) % 120) + Math.sin(clock * 2 + index) * 4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 7, y - 5, x + 13, y);
      ctx.quadraticCurveTo(x + 19, y - 5, x + 26, y);
      ctx.stroke();
    }
  }

  function drawSea(sea, scroll) {
    const { logicalW: w, logicalH: h } = state;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, waveAt(0, scroll, clock, sea));
    for (let x = 0; x <= w + 8; x += 8) {
      ctx.lineTo(x, waveAt(x, scroll, clock, sea));
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, sea - 10, 0, h);
    gradient.addColorStop(0, "#1c86a0");
    gradient.addColorStop(0.35, "#0d5168");
    gradient.addColorStop(1, "#041820");
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    for (let x = 0; x <= w; x += 8) {
      const y = waveAt(x, scroll, clock, sea);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(230, 247, 244, 0.8)";
    ctx.lineWidth = 1.6;
    ctx.stroke();

    const sunX = w * 0.8;
    const gleam = ctx.createLinearGradient(sunX, sea, sunX, sea + 88);
    gleam.addColorStop(0, "rgba(255, 214, 140, 0.28)");
    gleam.addColorStop(1, "rgba(255, 214, 140, 0)");
    ctx.fillStyle = gleam;
    ctx.beginPath();
    ctx.moveTo(sunX - 16, waveAt(sunX - 16, scroll, clock, sea));
    ctx.lineTo(sunX + 16, waveAt(sunX + 16, scroll, clock, sea));
    ctx.lineTo(sunX + 6, sea + 86);
    ctx.lineTo(sunX - 6, sea + 86);
    ctx.closePath();
    ctx.fill();
  }

  function drawCliff(sea, scroll) {
    const nose = playerX() - 180 - scroll * 1.15;
    if (nose < -260) return null;
    const top = sea - 196;
    ctx.fillStyle = "#6d5642";
    ctx.beginPath();
    ctx.moveTo(nose - 230, sea + 8);
    ctx.lineTo(nose - 70, top + 46);
    ctx.lineTo(nose - 20, top);
    ctx.lineTo(nose + 54, top + 16);
    ctx.lineTo(nose + 34, sea + 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#7d8f5c";
    ctx.fillRect(nose - 28, top - 6, 78, 10);
    ctx.fillStyle = "#d8c3a2";
    ctx.fillRect(nose - 4, top - 48, 28, 44);
    ctx.fillStyle = "#8c2f1b";
    ctx.beginPath();
    ctx.moveTo(nose - 10, top - 46);
    ctx.lineTo(nose + 10, top - 68);
    ctx.lineTo(nose + 30, top - 46);
    ctx.fill();
    return { x: nose + 48, y: top - 28 };
  }

  function drawWing(side, wing, look, folded) {
    const beat = folded ? 0.15 : Math.sin(state.flap);
    ctx.save();
    ctx.translate(0, -4);
    ctx.scale(side, 1);
    ctx.rotate((folded ? 0.85 : -0.25) + beat * 0.28);
    const wax = mix(wing.feather, "#fff6df", look);
    const thick = wing.id === "reinforced" ? 7.2 : 5.2;
    for (let index = 0; index < 7; index += 1) {
      ctx.save();
      ctx.rotate(-0.12 - index * 0.1);
      ctx.fillStyle = index === 0 ? mix("#e7c27a", "#ffb15a", look) : wax;
      ctx.beginPath();
      ctx.ellipse(18 * wing.span, 0, (18 + index * 3.1) * wing.span, thick - index * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (look > 0.18) {
      ctx.globalAlpha = Math.min(0.85, look);
      ctx.fillStyle = "#fffaf0";
      ctx.beginPath();
      ctx.ellipse(30 * wing.span, -1, 16 * wing.span, 2.4, -0.15, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawIcarus(x, y, look, folded) {
    const wing = wingById(state.equippedId);
    const lean = folded ? 0 : state.melted ? state.spin : clamp(state.vy / 480, -0.35, 0.55);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1.35, 1.35);
    ctx.rotate(lean);
    if (!state.melted || state.mode !== "flight") {
      drawWing(-1, wing, look, folded);
      drawWing(1, wing, look, folded);
    }
    ctx.fillStyle = "#f4efe4";
    ctx.beginPath();
    ctx.moveTo(-11, 4);
    ctx.quadraticCurveTo(0, 16, 11, 4);
    ctx.lineTo(13, 28);
    ctx.quadraticCurveTo(0, 36, -13, 28);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#d08a66";
    ctx.beginPath();
    ctx.ellipse(0, 2, 8, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e7b08d";
    ctx.beginPath();
    ctx.arc(3, -16, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3b2618";
    ctx.beginPath();
    ctx.arc(2, -19, 8.2, Math.PI * 0.95, Math.PI * 2.15);
    ctx.fill();
    ctx.restore();
  }

  function drawParticles() {
    particles.forEach((particle) => {
      const alpha = clamp(particle.life / particle.max, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(particle.x, particle.y);
      if (particle.kind === "feather") {
        ctx.rotate(particle.rot || 0);
        ctx.fillStyle = particle.color || "#f4e4c4";
        ctx.beginPath();
        ctx.ellipse(0, 0, 8, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (particle.kind === "drip") {
        ctx.fillStyle = "#f2d48a";
        ctx.beginPath();
        ctx.arc(0, 0, particle.r || 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = "rgba(236, 248, 246, 0.9)";
        ctx.beginPath();
        ctx.arc(0, 0, particle.r || 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  }

  function drawVignette() {
    const { logicalW: w, logicalH: h } = state;
    const gradient = ctx.createRadialGradient(w * 0.5, h * 0.45, h * 0.2, w * 0.5, h * 0.5, h * 0.75);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.28)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }

  function draw() {
    const w = state.logicalW;
    const h = state.logicalH;
    if (w < 2 || h < 2) return;
    const look = state.mode === "flight" ? warningLook(state.heat) : 0;
    const scroll = state.mode === "hangar" ? 0 : state.worldX;
    const sea = seaLevel();
    const mag = state.shake * 7;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    drawSky(look);
    drawSun(look);
    drawMountains(sea, scroll);
    drawClouds(scroll);
    drawBirds(scroll);
    const cliff = drawCliff(sea, scroll);
    drawSea(sea, scroll);

    if (state.mode === "flight") {
      const surface = waveAt(playerX(), scroll, clock, sea);
      if (!state.crashed) {
        const closeness = clamp(1 - (sea - state.y) / sea, 0, 1);
        ctx.fillStyle = `rgba(4, 24, 32, ${0.16 + closeness * 0.22})`;
        ctx.beginPath();
        ctx.ellipse(playerX(), surface + 2, 16 + closeness * 12, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!state.crashed || state.resolve > 0.15) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, w, surface + 4);
        ctx.clip();
        drawIcarus(playerX(), state.y, look, false);
        ctx.restore();
      }
    } else if (state.mode === "hangar" && cliff) {
      drawIcarus(cliff.x, cliff.y, 0, true);
    }

    drawParticles();
    drawVignette();
    ctx.restore();
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width < 2 || height < 2) return;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (state.mode === "flight" && state.logicalH > 1) {
      const scale = height / state.logicalH;
      state.y *= scale;
      state.vy *= scale;
    }
    state.logicalW = width;
    state.logicalH = height;
  }

  function loop(now) {
    if (!last) last = now;
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    clock += dt;
    if (state.mode === "flight") {
      updateFlight(dt);
      if (state.mode === "flight") updateHud();
    }
    updateParticles(dt);
    draw();
    requestAnimationFrame(loop);
  }

  window.addEventListener("keydown", (event) => {
    if (event.code === "ArrowRight" && state.mode === "hangar" && !tutorialEl.hidden) {
      event.preventDefault();
      stepLesson(1);
      return;
    }
    if (event.code === "ArrowLeft" && state.mode === "hangar" && !tutorialEl.hidden) {
      event.preventDefault();
      stepLesson(-1);
      return;
    }
    if (event.code !== "Space") return;
    event.preventDefault();
    if (state.mode === "flight") state.climbing = true;
  });

  window.addEventListener("keyup", (event) => {
    if (event.code === "Space") state.climbing = false;
  });

  window.addEventListener("blur", () => {
    state.climbing = false;
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (state.mode !== "flight") return;
    state.climbing = true;
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointerup", () => {
    state.climbing = false;
  });

  canvas.addEventListener("pointercancel", () => {
    state.climbing = false;
  });

  document.getElementById("fly").addEventListener("click", () => {
    tone(180, 0.05, "sine", 0.02);
    startFlight();
  });
  document.getElementById("again").addEventListener("click", showHangar);
  document.getElementById("help").addEventListener("click", openTutorial);
  document.getElementById("lesson-back").addEventListener("click", () => stepLesson(-1));
  document.getElementById("lesson-next").addEventListener("click", () => stepLesson(1));
  document.getElementById("lesson-skip").addEventListener("click", closeTutorial);
  window.addEventListener("resize", resize);

  load();
  resize();
  showHangar();
  requestAnimationFrame(loop);
})();
