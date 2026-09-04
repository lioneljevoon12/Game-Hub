

(function () {
  const GRID_SIZE = 16;
  const CELL_PERCENT = 100 / GRID_SIZE;
  const BASE_TICK_MS = 160;
  const MIN_TICK_MS = 70;
  const SPEED_STEP_MS = 8;
  const SCORE_PER_LEVEL = 5;
  const SWIPE_THRESHOLD_PX = 20;

  const EYE_POSITIONS = {
    up: [{ x: 30, y: 24 }, { x: 70, y: 24 }],
    down: [{ x: 30, y: 76 }, { x: 70, y: 76 }],
    left: [{ x: 24, y: 30 }, { x: 24, y: 70 }],
    right: [{ x: 76, y: 30 }, { x: 76, y: 70 }],
  };

  const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

  const boardWrapperEl = document.getElementById('board-wrapper');
  const boardLayerEl = document.getElementById('board-layer');
  const scoreValueEl = document.getElementById('score-value');
  const levelValueEl = document.getElementById('level-value');
  const gameoverOverlayEl = document.getElementById('gameover-overlay');
  const gameoverSummaryEl = document.getElementById('gameover-summary');
  const restartLinkBtn = document.getElementById('restart-link-btn');
  const gameoverRestartBtn = document.getElementById('gameover-restart-btn');
  const dpadButtons = document.querySelectorAll('[data-dir]');

  let snake = [];
  let direction = 'right';
  let nextDirection = 'right';
  let food = { row: 0, col: 0 };
  let score = 0;
  let gameOver = true;
  let tickTimeoutId = null;

  function getLevel(currentScore) {
    return Math.floor(currentScore / SCORE_PER_LEVEL) + 1;
  }

  function getTickInterval(level) {
    return Math.max(MIN_TICK_MS, BASE_TICK_MS - (level - 1) * SPEED_STEP_MS);
  }

  function queueDirection(newDir) {
    if (gameOver) return;
    if (newDir === OPPOSITE[direction]) return; // gak boleh langsung balik arah
    nextDirection = newDir;
  }

  // ===== Grid helpers =====
  function getRandomEmptyCell() {
    const occupied = new Set(snake.map((seg) => `${seg.row},${seg.col}`));
    let row;
    let col;
    do {
      row = Math.floor(Math.random() * GRID_SIZE);
      col = Math.floor(Math.random() * GRID_SIZE);
    } while (occupied.has(`${row},${col}`));
    return { row, col };
  }

  function getDirectionBetween(from, to) {
    if (to.row < from.row) return 'up';
    if (to.row > from.row) return 'down';
    if (to.col < from.col) return 'left';
    return 'right';
  }

  function getFlattenedCorners(dir) {
    if (dir === 'left') return ['topLeft', 'bottomLeft'];
    if (dir === 'right') return ['topRight', 'bottomRight'];
    if (dir === 'up') return ['topLeft', 'topRight'];
    return ['bottomLeft', 'bottomRight']; // down
  }

  function applyCornerRadius(el, flattenedSet) {
    const FULL = '38%';
    const FLAT = '6%';
    el.style.borderTopLeftRadius = flattenedSet.has('topLeft') ? FLAT : FULL;
    el.style.borderTopRightRadius = flattenedSet.has('topRight') ? FLAT : FULL;
    el.style.borderBottomRightRadius = flattenedSet.has('bottomRight') ? FLAT : FULL;
    el.style.borderBottomLeftRadius = flattenedSet.has('bottomLeft') ? FLAT : FULL;
  }

  function appendHeadDetails(el, dir) {
    EYE_POSITIONS[dir].forEach((pos) => {
      const eye = document.createElement('span');
      eye.className = 'snake-eye';
      eye.style.left = `${pos.x}%`;
      eye.style.top = `${pos.y}%`;
      const pupil = document.createElement('span');
      pupil.className = 'snake-pupil';
      eye.appendChild(pupil);
      el.appendChild(eye);
    });

    const tongue = document.createElement('span');
    tongue.className = `snake-tongue snake-tongue-${dir}`;
    el.appendChild(tongue);
  }

  function renderFood() {
    const el = document.createElement('div');
    el.className = 'snake-food';
    el.style.left = `${food.col * CELL_PERCENT}%`;
    el.style.top = `${food.row * CELL_PERCENT}%`;
    el.style.width = `${CELL_PERCENT}%`;
    el.style.height = `${CELL_PERCENT}%`;
    el.innerHTML = '<span class="snake-food-emoji">🍎</span>';
    boardLayerEl.appendChild(el);
  }

  function render() {
    boardLayerEl.innerHTML = '';

    snake.forEach((segment, index) => {
      const isHead = index === 0;
      const prev = index > 0 ? snake[index - 1] : null; // ke arah kepala
      const next = index < snake.length - 1 ? snake[index + 1] : null; // ke arah ekor

      const el = document.createElement('div');
      el.className = 'snake-segment';
      el.style.left = `${segment.col * CELL_PERCENT}%`;
      el.style.top = `${segment.row * CELL_PERCENT}%`;
      el.style.width = `${CELL_PERCENT}%`;
      el.style.height = `${CELL_PERCENT}%`;

      const flattened = new Set();
      if (prev) getFlattenedCorners(getDirectionBetween(segment, prev)).forEach((c) => flattened.add(c));
      if (next) getFlattenedCorners(getDirectionBetween(segment, next)).forEach((c) => flattened.add(c));
      applyCornerRadius(el, flattened);

      const t = snake.length > 1 ? 1 - index / (snake.length - 1) : 1;
      const opacity = 0.48 + 0.42 * t;
      el.style.background = `rgba(94, 234, 212, ${opacity})`;
      el.style.borderColor = `rgba(94, 234, 212, ${Math.min(opacity + 0.15, 1)})`;

      if (isHead) {
        el.style.background = 'rgba(94, 234, 212, 0.95)';
        el.style.boxShadow = '0 0 14px rgba(94, 234, 212, 0.55)';
        appendHeadDetails(el, direction);
      }

      boardLayerEl.appendChild(el);
    });

    renderFood();
  }

  function triggerEatEffect(position) {
    const popup = document.createElement('span');
    popup.className = 'score-popup';
    popup.textContent = '+1';
    popup.style.left = `${position.col * CELL_PERCENT + CELL_PERCENT / 2}%`;
    popup.style.top = `${position.row * CELL_PERCENT}%`;
    boardLayerEl.appendChild(popup);
    setTimeout(() => popup.remove(), 650);
  }

  function shatterSegment(segment) {
    const x = segment.col * CELL_PERCENT + CELL_PERCENT / 2;
    const y = segment.row * CELL_PERCENT + CELL_PERCENT / 2;

    for (let i = 0; i < 5; i += 1) {
      const shard = document.createElement('span');
      shard.className = 'shatter-piece';
      shard.style.left = `${x}%`;
      shard.style.top = `${y}%`;
      const angle = Math.random() * Math.PI * 2;
      const distance = 18 + Math.random() * 22;
      shard.style.setProperty('--tx', `${Math.cos(angle) * distance}px`);
      shard.style.setProperty('--ty', `${Math.sin(angle) * distance}px`);
      shard.style.setProperty('--rot', `${Math.random() * 360}deg`);
      shard.style.background = 'rgba(94, 234, 212, 0.85)';
      shard.style.animationDelay = `${Math.random() * 60}ms`;
      boardLayerEl.appendChild(shard);
    }
  }

  function showOverlay(el) {
    el.classList.add('visible');
  }

  function hideOverlay(el) {
    el.classList.remove('visible');
  }

  // ===== Alur main =====
  function tick() {
    if (gameOver) return;
    direction = nextDirection;

    const head = snake[0];
    let newHead;
    if (direction === 'up') newHead = { row: head.row - 1, col: head.col };
    else if (direction === 'down') newHead = { row: head.row + 1, col: head.col };
    else if (direction === 'left') newHead = { row: head.row, col: head.col - 1 };
    else newHead = { row: head.row, col: head.col + 1 };

    if (newHead.row < 0 || newHead.row >= GRID_SIZE || newHead.col < 0 || newHead.col >= GRID_SIZE) {
      triggerGameOver();
      return;
    }

    const willEat = newHead.row === food.row && newHead.col === food.col;
    const bodyToCheck = willEat ? snake : snake.slice(0, -1);
    if (bodyToCheck.some((seg) => seg.row === newHead.row && seg.col === newHead.col)) {
      triggerGameOver();
      return;
    }

    snake.unshift(newHead);
    if (willEat) {
      score += 1;
      scoreValueEl.textContent = String(score);
      levelValueEl.textContent = String(getLevel(score));
      triggerEatEffect(newHead);
      food = getRandomEmptyCell();
    } else {
      snake.pop();
    }

    render();
    scheduleTick();
  }

  function scheduleTick() {
    if (tickTimeoutId) clearTimeout(tickTimeoutId);
    tickTimeoutId = setTimeout(tick, getTickInterval(getLevel(score)));
  }

  function triggerGameOver() {
    gameOver = true;
    if (tickTimeoutId) clearTimeout(tickTimeoutId);

    snake.forEach((segment) => shatterSegment(segment));
    boardWrapperEl.classList.add('shake-x');
    setTimeout(() => boardWrapperEl.classList.remove('shake-x'), 400);

    setTimeout(() => {
      boardLayerEl.innerHTML = '';
      gameoverSummaryEl.textContent = `Skor akhir: ${score} · Level ${getLevel(score)}`;
      showOverlay(gameoverOverlayEl);

      if (GameHub.saveHighScoreIfBetter('snake', score, true)) {
        refreshScoreBadge('snake');
      }
    }, 500);
  }

  function startNewGame() {
    const startRow = Math.floor(GRID_SIZE / 2);
    const startCol = Math.floor(GRID_SIZE / 2) - 1;

    snake = [
      { row: startRow, col: startCol + 1 },
      { row: startRow, col: startCol },
      { row: startRow, col: startCol - 1 },
    ];
    direction = 'right';
    nextDirection = 'right';
    score = 0;
    gameOver = false;

    scoreValueEl.textContent = '0';
    levelValueEl.textContent = '1';
    hideOverlay(gameoverOverlayEl);

    food = getRandomEmptyCell();
    render();
    scheduleTick();
  }

  // ===== Kontrol: keyboard =====
  const KEY_DIRECTIONS = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right',
    W: 'up', S: 'down', A: 'left', D: 'right',
  };

  document.addEventListener('keydown', (e) => {
    const dir = KEY_DIRECTIONS[e.key];
    if (!dir) return;
    e.preventDefault();
    queueDirection(dir);
  });

  // ===== Kontrol: D-pad =====
  dpadButtons.forEach((btn) => {
    btn.addEventListener('click', () => queueDirection(btn.getAttribute('data-dir')));
  });

  let touchStartX = 0;
  let touchStartY = 0;

  boardWrapperEl.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
  }, { passive: true });

  boardWrapperEl.addEventListener('touchend', (e) => {
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) < SWIPE_THRESHOLD_PX) return;

    if (absDx > absDy) queueDirection(dx > 0 ? 'right' : 'left');
    else queueDirection(dy > 0 ? 'down' : 'up');
  }, { passive: true });

  // ===== Tombol restart =====
  restartLinkBtn.addEventListener('click', startNewGame);
  gameoverRestartBtn.addEventListener('click', startNewGame);

  // ===== Init =====
  startNewGame();
})();