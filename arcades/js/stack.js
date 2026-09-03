

(function () {
  const VISIBLE_LAYERS = 7; // termasuk piring dasar + lapisan aktif yang lagi jalan
  const ROW_PERCENT = 100 / VISIBLE_LAYERS;
  const PERFECT_TOLERANCE = 1.2; // persen lebar papan — toleransi dianggap "nempel pas"
  const BASE_SPEED = 42; // persen lebar papan per detik
  const SPEED_INCREMENT = 1.3;
  const MAX_SPEED_BONUS = 38;

  const LAYER_COLORS = [
    { bg: 'rgba(94, 234, 212, 0.55)', border: 'rgba(94, 234, 212, 0.8)' },  // teal
    { bg: 'rgba(255, 184, 77, 0.55)', border: 'rgba(255, 184, 77, 0.8)' }, // gold
    { bg: 'rgba(255, 111, 156, 0.55)', border: 'rgba(255, 111, 156, 0.8)' }, // pink
    { bg: 'rgba(167, 139, 250, 0.55)', border: 'rgba(167, 139, 250, 0.8)' }, // violet
  ];
  const FROSTING_COLOR = 'rgba(244, 238, 255, 0.85)';

  const boardWrapperEl = document.getElementById('board-wrapper');
  const stackLayerEl = document.getElementById('stack-layer');
  const fallingPiecesLayerEl = document.getElementById('falling-pieces-layer');
  const scoreValueEl = document.getElementById('score-value');
  const perfectValueEl = document.getElementById('perfect-value');
  const gameoverOverlayEl = document.getElementById('gameover-overlay');
  const gameoverSummaryEl = document.getElementById('gameover-summary');
  const dropBtn = document.getElementById('drop-btn');
  const restartLinkBtn = document.getElementById('restart-link-btn');
  const gameoverRestartBtn = document.getElementById('gameover-restart-btn');

  let stack = []; 
  let activeLayer = null; 
  let activeLayerEl = null;
  let score = 0;
  let perfectCount = 0;
  let gameOver = true;
  let lastFrameTime = null;

  function getLayerColor(index) {
    return LAYER_COLORS[((index % LAYER_COLORS.length) + LAYER_COLORS.length) % LAYER_COLORS.length];
  }

  function getVisibleRow(layerIndex, currentStackLength) {
    const cameraOffset = Math.max(0, currentStackLength - (VISIBLE_LAYERS - 1));
    return layerIndex - cameraOffset;
  }

  // ===== Render =====
  function createLayerElement(layer, row, isBase) {
    const el = document.createElement('div');
    el.className = 'cake-layer';
    el.style.left = `${layer.x}%`;
    el.style.width = `${layer.width}%`;
    el.style.bottom = `${row * ROW_PERCENT}%`;
    el.style.height = `${ROW_PERCENT}%`;

    if (isBase) {
      el.style.background = 'rgba(255, 255, 255, 0.16)';
      el.style.borderColor = 'rgba(255, 255, 255, 0.3)';
    } else {
      const color = getLayerColor(layer.colorIndex);
      el.style.background = color.bg;
      el.style.borderColor = color.border;

      const frosting = document.createElement('div');
      frosting.className = 'cake-frosting';
      frosting.style.background = FROSTING_COLOR;
      el.appendChild(frosting);
    }

    return el;
  }

  function renderStack() {
    stackLayerEl.innerHTML = '';
    stack.forEach((layer, index) => {
      const row = getVisibleRow(index, stack.length);
      if (row < 0 || row >= VISIBLE_LAYERS) return;
      stackLayerEl.appendChild(createLayerElement(layer, row, index === 0));
    });
  }

  function renderActiveLayer(withSpawnAnim) {
    if (activeLayerEl) activeLayerEl.remove();
    activeLayerEl = createLayerElement(
      { x: activeLayer.x, width: activeLayer.width, colorIndex: activeLayer.colorIndex },
      Math.min(stack.length, VISIBLE_LAYERS - 1),
      false
    );
    if (withSpawnAnim) activeLayerEl.classList.add('tile-spawn-in');
    stackLayerEl.appendChild(activeLayerEl);
  }

  function updateActiveLayerDOM() {
    if (activeLayerEl) activeLayerEl.style.left = `${activeLayer.x}%`;
  }

  function spawnFallingPiece(row, x, width, colorIndex) {
    const piece = document.createElement('div');
    piece.className = 'cake-layer cake-falling-piece';
    piece.style.left = `${x}%`;
    piece.style.width = `${width}%`;
    piece.style.bottom = `${row * ROW_PERCENT}%`;
    piece.style.height = `${ROW_PERCENT}%`;

    const color = getLayerColor(colorIndex);
    piece.style.background = color.bg;
    piece.style.borderColor = color.border;
    piece.style.setProperty('--fall-rot', `${(Math.random() < 0.5 ? -1 : 1) * (15 + Math.random() * 20)}deg`);

    fallingPiecesLayerEl.appendChild(piece);
    setTimeout(() => piece.remove(), 600);
  }

  function showPerfectPopup(row) {
    const popup = document.createElement('span');
    popup.className = 'cake-perfect-popup';
    popup.textContent = 'PERFECT!';
    popup.style.bottom = `${row * ROW_PERCENT + ROW_PERCENT}%`;
    fallingPiecesLayerEl.appendChild(popup);
    setTimeout(() => popup.remove(), 700);
  }

  function shakeBoard() {
    boardWrapperEl.classList.add('shake-x');
    setTimeout(() => boardWrapperEl.classList.remove('shake-x'), 400);
  }

  function showOverlay(el) {
    el.classList.add('visible');
  }

  function hideOverlay(el) {
    el.classList.remove('visible');
  }

  // ===== Alur main =====
  function spawnNextActiveLayer() {
    const below = stack[stack.length - 1];
    const fromLeft = stack.length % 2 === 0;
    const width = below.width;
    const x = fromLeft ? 0 : 100 - width;
    const dir = fromLeft ? 1 : -1;
    const speed = BASE_SPEED + Math.min((stack.length - 1) * SPEED_INCREMENT, MAX_SPEED_BONUS);
    const colorIndex = stack.length % LAYER_COLORS.length;

    activeLayer = { x, width, dir, speed, colorIndex };
    renderActiveLayer(true);
  }

  function handleDrop() {
    if (gameOver || !activeLayer) return;

    const activeRow = Math.min(stack.length, VISIBLE_LAYERS - 1);
    const below = stack[stack.length - 1];

    const overlapStart = Math.max(activeLayer.x, below.x);
    const overlapEnd = Math.min(activeLayer.x + activeLayer.width, below.x + below.width);
    const overlapWidth = overlapEnd - overlapStart;

    if (overlapWidth <= 0) {
      triggerGameOver();
      return;
    }

    let finalX = overlapStart;
    let finalWidth = overlapWidth;
    let isPerfect = false;

    if (below.width - overlapWidth <= PERFECT_TOLERANCE) {
      isPerfect = true;
      finalX = below.x;
      finalWidth = below.width;
    }

    if (activeLayer.x < finalX - 0.01) {
      spawnFallingPiece(activeRow, activeLayer.x, finalX - activeLayer.x, activeLayer.colorIndex);
    }
    const activeRight = activeLayer.x + activeLayer.width;
    const finalRight = finalX + finalWidth;
    if (activeRight > finalRight + 0.01) {
      spawnFallingPiece(activeRow, finalRight, activeRight - finalRight, activeLayer.colorIndex);
    }

    stack.push({ x: finalX, width: finalWidth, colorIndex: activeLayer.colorIndex });
    score = stack.length - 1;
    scoreValueEl.textContent = String(score);

    if (isPerfect) {
      perfectCount += 1;
      perfectValueEl.textContent = String(perfectCount);
      showPerfectPopup(activeRow);
    }

    renderStack();
    spawnNextActiveLayer();
  }

  function triggerGameOver() {
    gameOver = true;

    if (activeLayerEl) {
      activeLayerEl.classList.add('cake-falling-piece');
      activeLayerEl.style.setProperty('--fall-rot', `${(activeLayer.dir >= 0 ? 1 : -1) * 35}deg`);
    }

    shakeBoard();

    setTimeout(() => {
      const perfectNote = perfectCount > 0 ? ` · ${perfectCount}x PERFECT` : '';
      gameoverSummaryEl.textContent = `Skor akhir: ${score} lapisan${perfectNote}`;
      showOverlay(gameoverOverlayEl);

      if (GameHub.saveHighScoreIfBetter('stack', score, true)) {
        refreshScoreBadge('stack');
      }
    }, 500);
  }

  function startNewGame() {
    gameOver = false;
    score = 0;
    perfectCount = 0;
    stack = [{ x: 25, width: 50, colorIndex: -1 }];

    scoreValueEl.textContent = '0';
    perfectValueEl.textContent = '0';
    hideOverlay(gameoverOverlayEl);
    fallingPiecesLayerEl.innerHTML = '';

    renderStack();
    spawnNextActiveLayer();
  }

  function tick(timestamp) {
    if (lastFrameTime === null) lastFrameTime = timestamp;
    const deltaSec = Math.min((timestamp - lastFrameTime) / 1000, 0.05);
    lastFrameTime = timestamp;

    if (!gameOver && activeLayer) {
      activeLayer.x += activeLayer.dir * activeLayer.speed * deltaSec;
      if (activeLayer.x <= 0) {
        activeLayer.x = 0;
        activeLayer.dir = 1;
      } else if (activeLayer.x + activeLayer.width >= 100) {
        activeLayer.x = 100 - activeLayer.width;
        activeLayer.dir = -1;
      }
      updateActiveLayerDOM();
    }

    requestAnimationFrame(tick);
  }

  boardWrapperEl.addEventListener('click', handleDrop);
  dropBtn.addEventListener('click', handleDrop);
  restartLinkBtn.addEventListener('click', startNewGame);
  gameoverRestartBtn.addEventListener('click', startNewGame);

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      handleDrop();
    }
  });
  startNewGame();
  requestAnimationFrame(tick);
})();