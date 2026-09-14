

(function () {
  const HOLE_COUNT = 9;
  const ROUND_DURATION_SEC = 30;

  const BASE_SPAWN_MS = 900;
  const MIN_SPAWN_MS = 400;
  const BASE_VISIBLE_MS = 1300;
  const MIN_VISIBLE_MS = 650;

  const BOMB_CHANCE = 0.1;
  const BONUS_CHANCE = 0.15; // kumulatif setelah bomb: 0.10–0.25

  const MOLE_EMOJI = { normal: '🐹', bonus: '⭐', bomb: '💣' };
  const MOLE_POINTS = { normal: 10, bonus: 30 };
  const BOMB_PENALTY = 15;

  // ===== DOM refs =====
  const holesGridEl = document.getElementById('holes-grid');
  const hammerEl = document.getElementById('hammer-cursor');
  const scoreValueEl = document.getElementById('score-value');
  const timeValueEl = document.getElementById('time-value');
  const hitsValueEl = document.getElementById('hits-value');
  const gameoverOverlayEl = document.getElementById('gameover-overlay');
  const gameoverSummaryEl = document.getElementById('gameover-summary');
  const restartLinkBtn = document.getElementById('restart-link-btn');
  const gameoverRestartBtn = document.getElementById('gameover-restart-btn');

  // ===== State =====
  let holes = [];
  let roundActive = false;
  let score = 0;
  let hits = 0;
  let timeRemaining = ROUND_DURATION_SEC;
  let spawnTimeoutId = null;
  let countdownIntervalId = null;
  let hammerHideTimeoutId = null;

  function getElapsedFraction() {
    const elapsed = ROUND_DURATION_SEC - timeRemaining;
    return Math.min(1, Math.max(0, elapsed / ROUND_DURATION_SEC));
  }

  function getSpawnIntervalMs() {
    return BASE_SPAWN_MS - getElapsedFraction() * (BASE_SPAWN_MS - MIN_SPAWN_MS);
  }

  function getVisibleDurationMs() {
    return BASE_VISIBLE_MS - getElapsedFraction() * (BASE_VISIBLE_MS - MIN_VISIBLE_MS);
  }

  function pickMoleType() {
    const r = Math.random();
    if (r < BOMB_CHANCE) return 'bomb';
    if (r < BOMB_CHANCE + BONUS_CHANCE) return 'bonus';
    return 'normal';
  }

  // ===== Setup papan =====
  function buildHoles() {
    holesGridEl.innerHTML = '';
    holes = [];

    for (let i = 0; i < HOLE_COUNT; i += 1) {
      const holeEl = document.createElement('button');
      holeEl.type = 'button';
      holeEl.className = 'mole-hole aspect-square';
      holeEl.setAttribute('aria-label', 'Lubang mol');

      const moleEl = document.createElement('span');
      moleEl.className = 'mole-emoji';
      holeEl.appendChild(moleEl);

      holeEl.addEventListener('click', () => handleWhack(i));
      holesGridEl.appendChild(holeEl);

      holes.push({ active: false, type: null, timeoutId: null, holeEl, moleEl });
    }
  }

  function showPopup(index, text, color) {
    const popup = document.createElement('span');
    popup.className = 'score-popup';
    popup.textContent = text;
    popup.style.color = color;
    popup.style.left = '50%';
    popup.style.top = '15%';
    holes[index].holeEl.appendChild(popup);
    setTimeout(() => popup.remove(), 650);
  }

  function shakeHole(index) {
    holes[index].holeEl.classList.add('shake-x');
    setTimeout(() => holes[index].holeEl.classList.remove('shake-x'), 400);
  }

  function showOverlay(el) {
    el.classList.add('visible');
  }

  function hideOverlay(el) {
    el.classList.remove('visible');
  }

  // ===== Palu kursor =====
  function moveHammer(x, y) {
    hammerEl.style.left = `${x}px`;
    hammerEl.style.top = `${y}px`;
  }

  function swingHammer(x, y) {
    moveHammer(x, y);
    hammerEl.classList.add('visible');
    hammerEl.classList.remove('swinging');
    void hammerEl.offsetWidth; // force reflow biar animasi restart
    hammerEl.classList.add('swinging');
  }

  // ===== Efek partikel pas kena =====
  function spawnImpactEffect(index, color, big) {
    const container = holes[index].holeEl;

    const ring = document.createElement('span');
    ring.className = 'impact-ring';
    ring.style.borderColor = color;
    container.appendChild(ring);
    setTimeout(() => ring.remove(), 450);

    const particleCount = big ? 10 : 6;
    for (let i = 0; i < particleCount; i += 1) {
      const particle = document.createElement('span');
      particle.className = 'impact-particle';
      const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.4;
      const distance = (big ? 22 : 16) + Math.random() * 14;
      particle.style.setProperty('--px', `${Math.cos(angle) * distance}px`);
      particle.style.setProperty('--py', `${Math.sin(angle) * distance}px`);
      particle.style.background = color;
      container.appendChild(particle);
      setTimeout(() => particle.remove(), 500);
    }
  }

  // ===== Alur mol =====
  function activateHole(index, type) {
    const hole = holes[index];
    hole.active = true;
    hole.type = type;

    hole.moleEl.textContent = MOLE_EMOJI[type];
    hole.moleEl.className = 'mole-emoji mole-pop';

    hole.timeoutId = setTimeout(() => {
      if (hole.active) retractMole(index);
    }, getVisibleDurationMs());
  }

  function retractMole(index) {
    const hole = holes[index];
    hole.active = false;
    hole.type = null;
    if (hole.timeoutId) clearTimeout(hole.timeoutId);

    hole.moleEl.className = 'mole-emoji mole-retract';
    setTimeout(() => {
      hole.moleEl.className = 'mole-emoji';
      hole.moleEl.textContent = '';
    }, 220);
  }

  function spawnMole() {
    if (!roundActive) return;

    const emptyIndices = holes
      .map((h, i) => (h.active ? null : i))
      .filter((i) => i !== null);

    if (emptyIndices.length > 0) {
      const index = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
      activateHole(index, pickMoleType());
    }

    scheduleSpawn();
  }

  function scheduleSpawn() {
    if (!roundActive) return;
    spawnTimeoutId = setTimeout(spawnMole, getSpawnIntervalMs());
  }

  function handleWhack(index) {
    const hole = holes[index];
    if (!roundActive || !hole.active) return;

    const type = hole.type;
    if (hole.timeoutId) clearTimeout(hole.timeoutId);
    hole.active = false;
    hole.type = null;

    if (type === 'bomb') {
      score = Math.max(0, score - BOMB_PENALTY);
      showPopup(index, `-${BOMB_PENALTY}`, 'var(--arcade-pink)');
      spawnImpactEffect(index, 'var(--arcade-pink)', true);
      shakeHole(index);
    } else {
      const points = MOLE_POINTS[type];
      score += points;
      hits += 1;
      const color = type === 'bonus' ? 'var(--arcade-gold)' : 'var(--arcade-teal)';
      showPopup(index, `+${points}`, color);
      spawnImpactEffect(index, color, false);
      hitsValueEl.textContent = String(hits);
    }

    scoreValueEl.textContent = String(score);

    hole.moleEl.className = 'mole-emoji mole-hit';
    setTimeout(() => {
      hole.moleEl.className = 'mole-emoji';
      hole.moleEl.textContent = '';
    }, 220);
  }

  function tickCountdown() {
    timeRemaining -= 1;
    timeValueEl.textContent = String(Math.max(0, timeRemaining));
    if (timeRemaining <= 0) endRound();
  }

  function endRound() {
    roundActive = false;
    if (countdownIntervalId) clearInterval(countdownIntervalId);
    if (spawnTimeoutId) clearTimeout(spawnTimeoutId);

    holes.forEach((hole, i) => {
      if (hole.active) retractMole(i);
    });

    setTimeout(() => {
      gameoverSummaryEl.textContent = `Skor akhir: ${score} · ${hits} tangkapan`;
      showOverlay(gameoverOverlayEl);
      if (GameHub.saveHighScoreIfBetter('whack', score, true)) {
        refreshScoreBadge('whack');
      }
    }, 400);
  }

  function startRound() {
    roundActive = true;
    score = 0;
    hits = 0;
    timeRemaining = ROUND_DURATION_SEC;

    scoreValueEl.textContent = '0';
    hitsValueEl.textContent = '0';
    timeValueEl.textContent = String(ROUND_DURATION_SEC);
    hideOverlay(gameoverOverlayEl);

    holes.forEach((hole, i) => {
      if (hole.active) retractMole(i);
    });

    scheduleSpawn();
    countdownIntervalId = setInterval(tickCountdown, 1000);
  }

  restartLinkBtn.addEventListener('click', startRound);
  gameoverRestartBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    startRound();
  });

  holesGridEl.addEventListener('mouseenter', () => {
    hammerEl.classList.add('visible');
  });
  holesGridEl.addEventListener('mouseleave', () => {
    hammerEl.classList.remove('visible');
  });
  holesGridEl.addEventListener('mousemove', (e) => {
    moveHammer(e.clientX, e.clientY);
  });
  holesGridEl.addEventListener('click', (e) => {
    swingHammer(e.clientX, e.clientY);
  });
  holesGridEl.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    swingHammer(t.clientX, t.clientY);
    clearTimeout(hammerHideTimeoutId);
    hammerHideTimeoutId = setTimeout(() => hammerEl.classList.remove('visible'), 300);
  }, { passive: true });

  buildHoles();
  startRound();
})();