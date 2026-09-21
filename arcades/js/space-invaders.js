/**
 * Space Invaders — InsertCoin
 * Classic arcade shooter with synthesized sound, 2-frame pixel aliens, destructible bunkers, and wave progression.
 */

(function () {
  'use strict';

  // ===== Audio Synth (Web Audio API) =====
  let audioCtx = null;
  let soundEnabled = true;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playTone(freq, type, duration, endFreq = null, gainVal = 0.1) {
    if (!soundEnabled || !audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      if (endFreq !== null) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), audioCtx.currentTime + duration);
      }
      gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      // Audio error safely ignored
    }
  }

  function playNoise(duration, gainVal = 0.1) {
    if (!soundEnabled || !audioCtx) return;
    try {
      const bufferSize = audioCtx.sampleRate * duration;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      noise.connect(gain);
      gain.connect(audioCtx.destination);
      noise.start();
    } catch (e) {}
  }

  const sfx = {
    shoot() {
      playTone(880, 'square', 0.1, 220, 0.08);
    },
    invaderHit() {
      playNoise(0.15, 0.12);
      playTone(200, 'sawtooth', 0.1, 60, 0.09);
    },
    playerHit() {
      playNoise(0.4, 0.2);
      playTone(180, 'sawtooth', 0.3, 40, 0.15);
    },
    step(pitchIndex) {
      const pitches = [130, 115, 100, 85];
      const freq = pitches[pitchIndex % pitches.length];
      playTone(freq, 'triangle', 0.06, freq * 0.8, 0.05);
    },
    waveClear() {
      [330, 440, 550, 660, 880].forEach((f, idx) => {
        setTimeout(() => playTone(f, 'sine', 0.15, f, 0.08), idx * 70);
      });
    },
    gameOver() {
      [300, 260, 220, 180, 120].forEach((f, idx) => {
        setTimeout(() => playTone(f, 'sawtooth', 0.2, f * 0.8, 0.1), idx * 100);
      });
    },
    ufo() {
      playTone(400, 'sine', 0.2, 500, 0.04);
    }
  };

  // ===== Pixel Art Matrices (8x8 and 11x8) =====
  // 0: empty, 1: solid pixel
  const SPRITES = {
    // Top Row: Squid (8x8)
    squid: [
      // Frame 1
      [
        [0,0,0,1,1,0,0,0],
        [0,0,1,1,1,1,0,0],
        [0,1,1,1,1,1,1,0],
        [1,1,0,1,1,0,1,1],
        [1,1,1,1,1,1,1,1],
        [0,0,1,0,0,1,0,0],
        [0,1,0,1,1,0,1,0],
        [1,0,1,0,0,1,0,1]
      ],
      // Frame 2
      [
        [0,0,0,1,1,0,0,0],
        [0,0,1,1,1,1,0,0],
        [0,1,1,1,1,1,1,0],
        [1,1,0,1,1,0,1,1],
        [1,1,1,1,1,1,1,1],
        [0,1,0,1,1,0,1,0],
        [1,0,0,0,0,0,0,1],
        [0,1,0,0,0,0,1,0]
      ]
    ],
    // Mid Rows: Crab (11x8)
    crab: [
      // Frame 1
      [
        [0,0,1,0,0,0,0,0,1,0,0],
        [0,0,0,1,0,0,0,1,0,0,0],
        [0,0,1,1,1,1,1,1,1,0,0],
        [0,1,1,0,1,1,1,0,1,1,0],
        [1,1,1,1,1,1,1,1,1,1,1],
        [1,0,1,1,1,1,1,1,1,0,1],
        [1,0,1,0,0,0,0,0,1,0,1],
        [0,0,0,1,1,0,1,1,0,0,0]
      ],
      // Frame 2
      [
        [0,0,1,0,0,0,0,0,1,0,0],
        [1,0,0,1,0,0,0,1,0,0,1],
        [1,0,1,1,1,1,1,1,1,0,1],
        [1,1,1,0,1,1,1,0,1,1,1],
        [1,1,1,1,1,1,1,1,1,1,1],
        [0,0,1,1,1,1,1,1,1,0,0],
        [0,0,1,0,0,0,0,0,1,0,0],
        [0,1,0,0,0,0,0,0,0,1,0]
      ]
    ],
    // Bottom Rows: Octopus (12x8)
    octopus: [
      // Frame 1
      [
        [0,0,0,0,1,1,1,1,0,0,0,0],
        [0,1,1,1,1,1,1,1,1,1,1,0],
        [1,1,1,1,1,1,1,1,1,1,1,1],
        [1,1,1,0,0,1,1,0,0,1,1,1],
        [1,1,1,1,1,1,1,1,1,1,1,1],
        [0,0,0,1,1,0,0,1,1,0,0,0],
        [0,0,1,1,0,1,1,0,1,1,0,0],
        [1,1,0,0,0,0,0,0,0,0,1,1]
      ],
      // Frame 2
      [
        [0,0,0,0,1,1,1,1,0,0,0,0],
        [0,1,1,1,1,1,1,1,1,1,1,0],
        [1,1,1,1,1,1,1,1,1,1,1,1],
        [1,1,1,0,0,1,1,0,0,1,1,1],
        [1,1,1,1,1,1,1,1,1,1,1,1],
        [0,0,1,1,0,0,0,0,1,1,0,0],
        [0,1,1,0,0,1,1,0,0,1,1,0],
        [0,0,1,1,0,0,0,0,1,1,0,0]
      ]
    ],
    // Player Cannon (13x8)
    player: [
      [0,0,0,0,0,0,1,0,0,0,0,0,0],
      [0,0,0,0,0,1,1,1,0,0,0,0,0],
      [0,0,0,0,0,1,1,1,0,0,0,0,0],
      [0,1,1,1,1,1,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1]
    ],
    // UFO Mystery Ship (16x7)
    ufo: [
      [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
      [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
      [0,1,1,0,1,1,0,1,1,0,1,1,0,1,1,0],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [0,0,1,1,1,0,0,1,1,0,0,1,1,1,0,0],
      [0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0]
    ]
  };

  // Helper to draw a matrix sprite onto 2D canvas context
  function drawSprite(ctx, matrix, x, y, pixelSize, color) {
    ctx.fillStyle = color;
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] === 1) {
          ctx.fillRect(
            Math.round(x + c * pixelSize),
            Math.round(y + r * pixelSize),
            pixelSize,
            pixelSize
          );
        }
      }
    }
  }

  // ===== Game Constants & State =====
  const CANVAS_WIDTH = 400;
  const CANVAS_HEIGHT = 500;
  const GAME_ID = 'invaders';

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  // UI Elements
  const scoreValEl = document.getElementById('score-value');
  const livesValEl = document.getElementById('lives-value');
  const waveValEl = document.getElementById('wave-value');
  const startOverlay = document.getElementById('start-overlay');
  const winOverlay = document.getElementById('win-overlay');
  const gameoverOverlay = document.getElementById('gameover-overlay');
  const gameoverSummary = document.getElementById('gameover-summary');
  const startBtn = document.getElementById('start-btn');
  const nextWaveBtn = document.getElementById('next-wave-btn');
  const gameoverRestartBtn = document.getElementById('gameover-restart-btn');
  const restartLinkBtn = document.getElementById('restart-link-btn');
  const soundToggleBtn = document.getElementById('sound-toggle-btn');
  const soundIcon = document.getElementById('sound-icon');

  // Mobile Buttons
  const btnLeft = document.getElementById('btn-left');
  const btnRight = document.getElementById('btn-right');
  const btnFire = document.getElementById('btn-fire');

  let state = {
    running: false,
    score: 0,
    lives: 3,
    wave: 1,
    player: null,
    bullets: [],
    enemyBullets: [],
    invaders: [],
    invaderDirection: 1,
    invaderStepTimer: 0,
    invaderStepInterval: 700,
    invaderPitchIdx: 0,
    invaderAnimFrame: 0,
    ufo: null,
    ufoTimer: 0,
    bunkers: [],
    particles: [],
    stars: [],
    keys: {
      left: false,
      right: false,
      fire: false
    },
    lastFireTime: 0,
    playerRespawnTimer: 0
  };

  // ===== Starfield Background =====
  function initStars() {
    state.stars = [];
    for (let i = 0; i < 45; i++) {
      state.stars.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        speed: 0.2 + Math.random() * 0.4,
        size: Math.random() > 0.8 ? 1.5 : 1,
        alpha: 0.3 + Math.random() * 0.7
      });
    }
  }

  function updateStars() {
    for (let s of state.stars) {
      s.y += s.speed;
      if (s.y > CANVAS_HEIGHT) {
        s.y = 0;
        s.x = Math.random() * CANVAS_WIDTH;
      }
    }
  }

  function drawStars() {
    for (let s of state.stars) {
      ctx.fillStyle = `rgba(244, 238, 255, ${s.alpha})`;
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
  }

  // ===== Bunker Generator =====
  function createBunkers() {
    const bunkers = [];
    const count = 3;
    const bunkerWidth = 44;
    const bunkerHeight = 28;
    const spacing = (CANVAS_WIDTH - count * bunkerWidth) / (count + 1);
    const bunkerY = 380;

    for (let i = 0; i < count; i++) {
      const bx = spacing + i * (bunkerWidth + spacing);
      const grid = [];
      const cols = 11;
      const rows = 7;
      const blockSize = 4;

      for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
          // Classic arch cutout at bottom center and top corners
          let active = true;
          if (r === 0 && (c === 0 || c === cols - 1)) active = false;
          if (r >= 4 && c >= 3 && c <= 7) active = false;
          row.push(active ? 1 : 0);
        }
        grid.push(row);
      }

      bunkers.push({
        x: bx,
        y: bunkerY,
        cols,
        rows,
        blockSize,
        grid
      });
    }
    return bunkers;
  }

  function drawBunkers() {
    for (let b of state.bunkers) {
      for (let r = 0; r < b.rows; r++) {
        for (let c = 0; c < b.cols; c++) {
          if (b.grid[r][c] === 1) {
            ctx.fillStyle = '#5eead4'; // Arcade teal
            ctx.fillRect(b.x + c * b.blockSize, b.y + r * b.blockSize, b.blockSize, b.blockSize);
          }
        }
      }
    }
  }

  function damageBunker(bunker, hitX, hitY, radius = 6) {
    let hitSomething = false;
    for (let r = 0; r < bunker.rows; r++) {
      for (let c = 0; c < bunker.cols; c++) {
        if (bunker.grid[r][c] === 1) {
          const bx = bunker.x + c * bunker.blockSize + bunker.blockSize / 2;
          const by = bunker.y + r * bunker.blockSize + bunker.blockSize / 2;
          const dist = Math.hypot(bx - hitX, by - hitY);
          if (dist <= radius) {
            bunker.grid[r][c] = 0;
            hitSomething = true;
            createExplosion(bx, by, '#5eead4', 2, 1.5);
          }
        }
      }
    }
    return hitSomething;
  }

  // ===== Invaders Setup =====
  function createInvaders(wave) {
    const invaders = [];
    const rows = 4;
    const cols = 8;
    const invaderSpacingX = 36;
    const invaderSpacingY = 30;
    const startX = (CANVAS_WIDTH - cols * invaderSpacingX) / 2 + 10;
    const startY = Math.min(120, 60 + (wave - 1) * 8);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let type, pts, color, pixelSize, width, height;
        if (r === 0) {
          type = 'squid';
          pts = 30;
          color = '#ff6f9c'; // Pink
          pixelSize = 2.5;
          width = 8 * pixelSize;
          height = 8 * pixelSize;
        } else if (r === 1 || r === 2) {
          type = 'crab';
          pts = 20;
          color = '#ffb84d'; // Gold
          pixelSize = 2.2;
          width = 11 * pixelSize;
          height = 8 * pixelSize;
        } else {
          type = 'octopus';
          pts = 10;
          color = '#a78bfa'; // Violet
          pixelSize = 2.2;
          width = 12 * pixelSize;
          height = 8 * pixelSize;
        }

        invaders.push({
          type,
          pts,
          color,
          pixelSize,
          width,
          height,
          x: startX + c * invaderSpacingX,
          y: startY + r * invaderSpacingY,
          alive: true
        });
      }
    }
    return invaders;
  }

  // ===== Particles & Explosions =====
  function createExplosion(x, y, color, count = 8, maxSpeed = 3) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * maxSpeed + 0.5;
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() > 0.5 ? 2.5 : 1.5,
        color,
        life: 1.0,
        decay: 0.03 + Math.random() * 0.04
      });
    }
  }

  function updateAndDrawParticles() {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;

      if (p.life <= 0) {
        state.particles.splice(i, 1);
        continue;
      }

      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1.0;
  }

  // ===== Player Cannon =====
  function initPlayer() {
    return {
      x: CANVAS_WIDTH / 2 - 14,
      y: 446,
      width: 13 * 2.2,
      height: 8 * 2.2,
      pixelSize: 2.2,
      speed: 4.2,
      hit: false
    };
  }

  function drawPlayer() {
    if (!state.player) return;
    if (state.playerRespawnTimer > 0 && Math.floor(Date.now() / 100) % 2 === 0) {
      // Flash while invulnerable
      return;
    }
    drawSprite(
      ctx,
      SPRITES.player,
      state.player.x,
      state.player.y,
      state.player.pixelSize,
      '#5eead4'
    );
  }

  // ===== UFO Mystery Ship =====
  function updateUfo(delta) {
    state.ufoTimer += delta;
    if (!state.ufo && state.ufoTimer > 18000 + Math.random() * 12000) {
      state.ufoTimer = 0;
      const fromLeft = Math.random() > 0.5;
      state.ufo = {
        x: fromLeft ? -40 : CANVAS_WIDTH + 10,
        y: 35,
        vx: fromLeft ? 1.8 : -1.8,
        pixelSize: 2.2,
        width: 16 * 2.2,
        height: 7 * 2.2,
        pts: [100, 150, 200, 300][Math.floor(Math.random() * 4)]
      };
      sfx.ufo();
    }

    if (state.ufo) {
      state.ufo.x += state.ufo.vx;
      if (state.ufo.x < -60 || state.ufo.x > CANVAS_WIDTH + 60) {
        state.ufo = null;
      }
    }
  }

  function drawUfo() {
    if (!state.ufo) return;
    drawSprite(
      ctx,
      SPRITES.ufo,
      state.ufo.x,
      state.ufo.y,
      state.ufo.pixelSize,
      '#ff6f9c'
    );
  }

  // ===== Bullets & Shooting =====
  function shootPlayerBullet() {
    if (!state.running || state.playerRespawnTimer > 0) return;
    const now = Date.now();
    if (now - state.lastFireTime < 240) return;
    if (state.bullets.length >= 2) return; // Max 2 active player laser beams

    initAudio();
    state.lastFireTime = now;
    state.bullets.push({
      x: state.player.x + state.player.width / 2 - 1.5,
      y: state.player.y - 6,
      width: 3,
      height: 9,
      speed: 7
    });
    sfx.shoot();
  }

  function shootEnemyBullet(invader) {
    state.enemyBullets.push({
      x: invader.x + invader.width / 2 - 1.5,
      y: invader.y + invader.height,
      width: 3,
      height: 8,
      speed: 3.2 + Math.min(2.5, state.wave * 0.4),
      zig: Math.random() * Math.PI
    });
  }

  // ===== Game Lifecycle =====
  function resetGame() {
    state.score = 0;
    state.lives = 3;
    state.wave = 1;
    state.particles = [];
    state.bullets = [];
    state.enemyBullets = [];
    state.ufo = null;
    state.ufoTimer = 0;
    state.invaderDirection = 1;
    state.invaderStepInterval = 700;
    state.playerRespawnTimer = 0;

    state.player = initPlayer();
    state.bunkers = createBunkers();
    state.invaders = createInvaders(state.wave);

    updateUI();
  }

  function startNextWave() {
    state.wave++;
    state.bullets = [];
    state.enemyBullets = [];
    state.ufo = null;
    state.ufoTimer = 0;
    state.invaderDirection = 1;
    state.invaderStepInterval = Math.max(200, 700 - (state.wave - 1) * 80);
    state.playerRespawnTimer = 0;

    state.invaders = createInvaders(state.wave);
    // Partially replenish bunkers
    state.bunkers = createBunkers();

    updateUI();
    winOverlay.classList.add('hidden');
    state.running = true;
    sfx.waveClear();
  }

  function updateUI() {
    scoreValEl.textContent = state.score;
    livesValEl.textContent = state.lives;
    waveValEl.textContent = state.wave;
  }

  function handleGameOver(reason = 'Kalah') {
    state.running = false;
    sfx.gameOver();

    const isNewHi = GameHub.saveHighScoreIfBetter(GAME_ID, state.score);
    if (typeof refreshScoreBadge === 'function') {
      refreshScoreBadge(GAME_ID);
    }

    gameoverSummary.textContent = `${reason}. Skor akhir kamu ${state.score} di Gelombang ${state.wave}.${isNewHi ? ' 🔥 Rekor baru!' : ''}`;
    gameoverOverlay.classList.remove('hidden');
  }

  // ===== Game Loop Updates =====
  let lastFrameTime = performance.now();

  function update(delta) {
    updateStars();
    updateUfo(delta);

    if (state.playerRespawnTimer > 0) {
      state.playerRespawnTimer -= delta;
    }

    // Move Player
    if (state.keys.left) {
      state.player.x = Math.max(8, state.player.x - state.player.speed);
    }
    if (state.keys.right) {
      state.player.x = Math.min(CANVAS_WIDTH - state.player.width - 8, state.player.x + state.player.speed);
    }

    // Auto / continuous fire if key held
    if (state.keys.fire) {
      shootPlayerBullet();
    }

    // Move Player Bullets
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      b.y -= b.speed;

      // Offscreen
      if (b.y < -10) {
        state.bullets.splice(i, 1);
        continue;
      }

      // Check hit UFO
      if (state.ufo) {
        if (
          b.x + b.width >= state.ufo.x &&
          b.x <= state.ufo.x + state.ufo.width &&
          b.y + b.height >= state.ufo.y &&
          b.y <= state.ufo.y + state.ufo.height
        ) {
          state.score += state.ufo.pts;
          createExplosion(state.ufo.x + state.ufo.width / 2, state.ufo.y + state.ufo.height / 2, '#ff6f9c', 16, 4);
          sfx.invaderHit();
          state.ufo = null;
          state.bullets.splice(i, 1);
          updateUI();
          continue;
        }
      }

      // Check hit Bunkers
      let bulletAbsorbed = false;
      for (let bunker of state.bunkers) {
        if (
          b.x >= bunker.x &&
          b.x <= bunker.x + bunker.cols * bunker.blockSize &&
          b.y >= bunker.y &&
          b.y <= bunker.y + bunker.rows * bunker.blockSize
        ) {
          if (damageBunker(bunker, b.x, b.y, 6)) {
            state.bullets.splice(i, 1);
            bulletAbsorbed = true;
            break;
          }
        }
      }
      if (bulletAbsorbed) continue;

      // Check hit Invaders
      for (let inv of state.invaders) {
        if (
          inv.alive &&
          b.x + b.width >= inv.x &&
          b.x <= inv.x + inv.width &&
          b.y + b.height >= inv.y &&
          b.y <= inv.y + inv.height
        ) {
          inv.alive = false;
          state.score += inv.pts;
          createExplosion(inv.x + inv.width / 2, inv.y + inv.height / 2, inv.color, 12, 3);
          sfx.invaderHit();
          state.bullets.splice(i, 1);
          updateUI();
          break;
        }
      }
    }

    // Alive Invaders Count & Wave Clear Check
    const aliveInvaders = state.invaders.filter((inv) => inv.alive);
    if (aliveInvaders.length === 0) {
      state.running = false;
      winOverlay.classList.remove('hidden');
      return;
    }

    // Invader Movement Step
    // Speed increases progressively as fewer invaders remain!
    const speedMultiplier = aliveInvaders.length / state.invaders.length;
    const currentInterval = Math.max(70, state.invaderStepInterval * speedMultiplier);

    state.invaderStepTimer += delta;
    if (state.invaderStepTimer >= currentInterval) {
      state.invaderStepTimer = 0;
      state.invaderAnimFrame = 1 - state.invaderAnimFrame;
      sfx.step(state.invaderPitchIdx++);

      let hitEdge = false;
      const stepDist = 8;

      for (let inv of aliveInvaders) {
        if (
          (state.invaderDirection === 1 && inv.x + inv.width + stepDist >= CANVAS_WIDTH - 10) ||
          (state.invaderDirection === -1 && inv.x - stepDist <= 10)
        ) {
          hitEdge = true;
          break;
        }
      }

      if (hitEdge) {
        state.invaderDirection *= -1;
        for (let inv of aliveInvaders) {
          inv.y += 12;
          // Check if invaders reached bunker or player line
          if (inv.y + inv.height >= state.player.y - 10) {
            handleGameOver('Alien berhasil mendarat!');
            return;
          }
        }
      } else {
        for (let inv of aliveInvaders) {
          inv.x += state.invaderDirection * stepDist;
        }
      }

      // Random alien shooting
      if (Math.random() < 0.45 + state.wave * 0.05 && state.enemyBullets.length < 3 + Math.min(3, state.wave)) {
        const shooters = [];
        // Find the lowest invader in each column
        const colsMap = {};
        for (let inv of aliveInvaders) {
          const colKey = Math.round(inv.x / 20);
          if (!colsMap[colKey] || inv.y > colsMap[colKey].y) {
            colsMap[colKey] = inv;
          }
        }
        for (let key in colsMap) {
          shooters.push(colsMap[key]);
        }

        if (shooters.length > 0) {
          const shooter = shooters[Math.floor(Math.random() * shooters.length)];
          shootEnemyBullet(shooter);
        }
      }
    }

    // Move Enemy Bullets
    for (let i = state.enemyBullets.length - 1; i >= 0; i--) {
      const eb = state.enemyBullets[i];
      eb.y += eb.speed;
      eb.zig += 0.15;
      eb.x += Math.sin(eb.zig) * 0.8;

      // Offscreen
      if (eb.y > CANVAS_HEIGHT + 10) {
        state.enemyBullets.splice(i, 1);
        continue;
      }

      // Bunker hit
      let bulletAbsorbed = false;
      for (let bunker of state.bunkers) {
        if (
          eb.x >= bunker.x &&
          eb.x <= bunker.x + bunker.cols * bunker.blockSize &&
          eb.y >= bunker.y &&
          eb.y <= bunker.y + bunker.rows * bunker.blockSize
        ) {
          if (damageBunker(bunker, eb.x, eb.y, 6)) {
            state.enemyBullets.splice(i, 1);
            bulletAbsorbed = true;
            break;
          }
        }
      }
      if (bulletAbsorbed) continue;

      // Player hit
      if (
        state.playerRespawnTimer <= 0 &&
        eb.x + eb.width >= state.player.x &&
        eb.x <= state.player.x + state.player.width &&
        eb.y + eb.height >= state.player.y &&
        eb.y <= state.player.y + state.player.height
      ) {
        state.enemyBullets.splice(i, 1);
        state.lives--;
        createExplosion(state.player.x + state.player.width / 2, state.player.y + state.player.height / 2, '#5eead4', 20, 5);
        sfx.playerHit();
        updateUI();

        if (state.lives <= 0) {
          handleGameOver('Pesawatmu hancur!');
          return;
        } else {
          // Respawn temporary shield/invulnerability
          state.playerRespawnTimer = 1800;
        }
      }
    }
  }

  // ===== Render Loop =====
  function draw() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    drawStars();
    drawBunkers();
    drawUfo();

    // Draw Invaders
    for (let inv of state.invaders) {
      if (inv.alive) {
        const spriteData = SPRITES[inv.type][state.invaderAnimFrame];
        drawSprite(ctx, spriteData, inv.x, inv.y, inv.pixelSize, inv.color);
      }
    }

    // Draw Player
    drawPlayer();

    // Draw Player Bullets
    ctx.fillStyle = '#ffb84d';
    for (let b of state.bullets) {
      ctx.fillRect(Math.round(b.x), Math.round(b.y), b.width, b.height);
    }

    // Draw Enemy Bullets
    ctx.fillStyle = '#ff6f9c';
    for (let eb of state.enemyBullets) {
      ctx.fillRect(Math.round(eb.x), Math.round(eb.y), eb.width, eb.height);
    }

    // Draw Particles
    updateAndDrawParticles();

    // Draw Floor Line
    ctx.strokeStyle = '#251b35';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 475);
    ctx.lineTo(CANVAS_WIDTH, 475);
    ctx.stroke();
  }

  function gameLoop(now) {
    const delta = Math.min(100, now - lastFrameTime);
    lastFrameTime = now;

    if (state.running) {
      update(delta);
    }
    draw();

    requestAnimationFrame(gameLoop);
  }

  // ===== Event Listeners =====
  function setupControls() {
    window.addEventListener('keydown', (e) => {
      initAudio();
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        state.keys.left = true;
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        state.keys.right = true;
      }
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        state.keys.fire = true;
        shootPlayerBullet();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        state.keys.left = false;
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        state.keys.right = false;
      }
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        state.keys.fire = false;
      }
    });

    // Touch & Mobile Buttons
    if (btnLeft) {
      const setLeft = (val) => { initAudio(); state.keys.left = val; };
      btnLeft.addEventListener('pointerdown', (e) => { e.preventDefault(); setLeft(true); });
      btnLeft.addEventListener('pointerup', () => setLeft(false));
      btnLeft.addEventListener('pointerleave', () => setLeft(false));
      btnLeft.addEventListener('pointercancel', () => setLeft(false));
    }

    if (btnRight) {
      const setRight = (val) => { initAudio(); state.keys.right = val; };
      btnRight.addEventListener('pointerdown', (e) => { e.preventDefault(); setRight(true); });
      btnRight.addEventListener('pointerup', () => setRight(false));
      btnRight.addEventListener('pointerleave', () => setRight(false));
      btnRight.addEventListener('pointercancel', () => setRight(false));
    }

    if (btnFire) {
      btnFire.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        initAudio();
        state.keys.fire = true;
        shootPlayerBullet();
      });
      btnFire.addEventListener('pointerup', () => { state.keys.fire = false; });
      btnFire.addEventListener('pointercancel', () => { state.keys.fire = false; });
    }

    // Canvas click / touch to fire
    canvas.addEventListener('pointerdown', () => {
      initAudio();
      if (state.running) {
        shootPlayerBullet();
      }
    });

    // Start / Restart / Next buttons
    startBtn.addEventListener('click', () => {
      initAudio();
      startOverlay.classList.add('hidden');
      resetGame();
      state.running = true;
    });

    nextWaveBtn.addEventListener('click', () => {
      initAudio();
      startNextWave();
    });

    gameoverRestartBtn.addEventListener('click', () => {
      initAudio();
      gameoverOverlay.classList.add('hidden');
      resetGame();
      state.running = true;
    });

    restartLinkBtn.addEventListener('click', () => {
      initAudio();
      winOverlay.classList.add('hidden');
      gameoverOverlay.classList.add('hidden');
      startOverlay.classList.add('hidden');
      resetGame();
      state.running = true;
    });

    // Sound Toggle
    if (soundToggleBtn) {
      soundToggleBtn.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        if (soundEnabled) {
          initAudio();
          soundIcon.setAttribute('data-lucide', 'volume-2');
        } else {
          soundIcon.setAttribute('data-lucide', 'volume-x');
        }
        if (window.lucide) lucide.createIcons();
      });
    }
  }

  // ===== Initialization =====
  document.addEventListener('DOMContentLoaded', () => {
    initStars();
    resetGame();
    setupControls();
    lastFrameTime = performance.now();
    requestAnimationFrame(gameLoop);
  });
})();
