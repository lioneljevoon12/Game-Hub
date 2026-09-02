
(function () {
  const SIZE = 4;
  const GAP_PERCENT = 3;
  const CELL_PERCENT = (100 - GAP_PERCENT * (SIZE + 1)) / SIZE;
  const SLIDE_DURATION_MS = 150;
  const SWIPE_THRESHOLD_PX = 24;

  const TIER_STYLES = {
    1: { bg: 'rgba(94, 234, 212, 0.16)', border: 'rgba(94, 234, 212, 0.3)' },    // 2
    2: { bg: 'rgba(94, 234, 212, 0.30)', border: 'rgba(94, 234, 212, 0.45)' },   // 4
    3: { bg: 'rgba(94, 234, 212, 0.48)', border: 'rgba(94, 234, 212, 0.6)' },    // 8
    4: { bg: 'rgba(255, 184, 77, 0.30)', border: 'rgba(255, 184, 77, 0.45)' },   // 16
    5: { bg: 'rgba(255, 184, 77, 0.46)', border: 'rgba(255, 184, 77, 0.6)' },    // 32
    6: { bg: 'rgba(255, 184, 77, 0.65)', border: 'rgba(255, 184, 77, 0.8)' },    // 64
    7: { bg: 'rgba(255, 111, 156, 0.40)', border: 'rgba(255, 111, 156, 0.55)' }, // 128
    8: { bg: 'rgba(255, 111, 156, 0.58)', border: 'rgba(255, 111, 156, 0.7)' },  // 256
    9: { bg: 'rgba(255, 111, 156, 0.76)', border: 'rgba(255, 111, 156, 0.88)', glow: 'rgba(255,111,156,0.5)' }, // 512
    10: { bg: 'rgba(167, 139, 250, 0.58)', border: 'rgba(167, 139, 250, 0.72)', glow: 'rgba(167,139,250,0.55)' }, // 1024
    11: { bg: 'rgba(167, 139, 250, 0.92)', border: 'rgba(255, 255, 255, 0.5)', glow: 'rgba(167,139,250,0.8)' }, // 2048
  };
  const PRESTIGE_STYLE = { bg: 'rgba(255, 184, 77, 0.9)', border: 'rgba(255,255,255,0.55)', glow: 'rgba(255,184,77,0.85)' };

  // ===== DOM refs =====
  const boardWrapperEl = document.getElementById('board-wrapper');
  const boardBgEl = document.getElementById('board-bg');
  const tilesLayerEl = document.getElementById('tiles-layer');
  const scoreValueEl = document.getElementById('score-value');
  const movesValueEl = document.getElementById('moves-value');
  const bestTileValueEl = document.getElementById('best-tile-value');
  const winOverlayEl = document.getElementById('win-overlay');
  const gameoverOverlayEl = document.getElementById('gameover-overlay');
  const gameoverSummaryEl = document.getElementById('gameover-summary');
  const newGameBtn = document.getElementById('new-game-btn');
  const winContinueBtn = document.getElementById('win-continue-btn');
  const winRestartBtn = document.getElementById('win-restart-btn');
  const gameoverRestartBtn = document.getElementById('gameover-restart-btn');

  // ===== State =====
  let grid = createEmptyGrid();
  let tileElements = {};
  let tileIdCounter = 0;
  let score = 0;
  let moves = 0;
  let hasWon = false;
  let boardLocked = false;

  function nextTileId() {
    tileIdCounter += 1;
    return tileIdCounter;
  }

  function cellOffsetPercent(index) {
    return GAP_PERCENT * (index + 1) + CELL_PERCENT * index;
  }

  // ===== Grid helpers =====
  function createEmptyGrid() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  }

  function getEmptyCells(boardState) {
    const cells = [];
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        if (boardState[r][c] === null) cells.push({ row: r, col: c });
      }
    }
    return cells;
  }

  function spawnTile(boardState) {
    const empties = getEmptyCells(boardState);
    if (empties.length === 0) return null;
    const { row, col } = empties[Math.floor(Math.random() * empties.length)];
    const value = Math.random() < 0.9 ? 2 : 4;
    const tile = { id: nextTileId(), value, row, col };
    boardState[row][col] = tile;
    return tile;
  }

  function getMaxTileValue(boardState) {
    let max = 0;
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        if (boardState[r][c] && boardState[r][c].value > max) max = boardState[r][c].value;
      }
    }
    return max;
  }

  function hasAvailableMoves(boardState) {
    if (getEmptyCells(boardState).length > 0) return true;
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        const val = boardState[r][c].value;
        if (c < SIZE - 1 && boardState[r][c + 1].value === val) return true;
        if (r < SIZE - 1 && boardState[r + 1][c].value === val) return true;
      }
    }
    return false;
  }

  // Urutan sel dalam 1 baris/kolom, dari sisi tujuan gerakan ke sisi jauh.
  function getLineCoords(direction, lineIndex) {
    const coords = [];
    for (let i = 0; i < SIZE; i += 1) {
      if (direction === 'left') coords.push({ row: lineIndex, col: i });
      else if (direction === 'right') coords.push({ row: lineIndex, col: SIZE - 1 - i });
      else if (direction === 'up') coords.push({ row: i, col: lineIndex });
      else coords.push({ row: SIZE - 1 - i, col: lineIndex }); // down
    }
    return coords;
  }

  // Inti mekanik 2048: geser tiap baris/kolom, gabungin yang sama (maksimal
  // sekali gabung per tile per gerakan), balikin daftar "actions" buat animasi.
  function move(boardState, direction) {
    const actions = [];
    let scoreGained = 0;

    for (let lineIndex = 0; lineIndex < SIZE; lineIndex += 1) {
      const coords = getLineCoords(direction, lineIndex);
      const tilesInLine = coords
        .map(({ row, col }) => boardState[row][col])
        .filter((t) => t !== null);

      const newLineTiles = [];
      let i = 0;
      while (i < tilesInLine.length) {
        const current = tilesInLine[i];
        const next = tilesInLine[i + 1];

        if (next && next.value === current.value) {
          const destCoord = coords[newLineTiles.length];
          const mergedValue = current.value * 2;
          const mergedTile = { id: nextTileId(), value: mergedValue, row: destCoord.row, col: destCoord.col };

          actions.push({
            type: 'merge',
            fromA: { id: current.id, row: current.row, col: current.col },
            fromB: { id: next.id, row: next.row, col: next.col },
            to: destCoord,
            resultId: mergedTile.id,
            resultValue: mergedValue,
          });

          scoreGained += mergedValue;
          newLineTiles.push(mergedTile);
          i += 2;
        } else {
          const destCoord = coords[newLineTiles.length];
          if (current.row !== destCoord.row || current.col !== destCoord.col) {
            actions.push({
              type: 'move',
              id: current.id,
              to: destCoord,
            });
          }
          newLineTiles.push({ id: current.id, value: current.value, row: destCoord.row, col: destCoord.col });
          i += 1;
        }
      }

      coords.forEach((coord, idx) => {
        boardState[coord.row][coord.col] = newLineTiles[idx] || null;
      });
    }

    return { actions, scoreGained, moved: actions.length > 0 };
  }

  // ===== Render helpers =====
  function getTileStyle(value) {
    const tier = Math.round(Math.log2(value));
    return TIER_STYLES[tier] || PRESTIGE_STYLE;
  }

  function getFontSizeClass(value) {
    const len = String(value).length;
    if (len <= 1) return 'text-2xl sm:text-3xl';
    if (len === 2) return 'text-xl sm:text-2xl';
    if (len === 3) return 'text-lg sm:text-xl';
    return 'text-base sm:text-lg';
  }

  function positionTile(el, row, col) {
    el.style.left = `${cellOffsetPercent(col)}%`;
    el.style.top = `${cellOffsetPercent(row)}%`;
    el.style.width = `${CELL_PERCENT}%`;
    el.style.height = `${CELL_PERCENT}%`;
  }

  function createTileElement(tile, animationClass) {
    const el = document.createElement('div');
    el.className = `tile-2048 ${getFontSizeClass(tile.value)}`;
    positionTile(el, tile.row, tile.col);

    const style = getTileStyle(tile.value);
    el.style.background = style.bg;
    el.style.borderColor = style.border;
    if (style.glow) el.style.boxShadow = `0 0 18px ${style.glow}`;
    el.style.color = 'var(--arcade-text)';
    el.textContent = String(tile.value);

    if (animationClass) el.classList.add(animationClass);

    tileElements[tile.id] = el;
    tilesLayerEl.appendChild(el);
    return el;
  }

  function renderBoardBackground() {
    boardBgEl.innerHTML = '';
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        const cell = document.createElement('div');
        cell.className = 'tile-2048-bg';
        cell.style.left = `${cellOffsetPercent(c)}%`;
        cell.style.top = `${cellOffsetPercent(r)}%`;
        cell.style.width = `${CELL_PERCENT}%`;
        cell.style.height = `${CELL_PERCENT}%`;
        boardBgEl.appendChild(cell);
      }
    }
  }

  function showScorePopup(row, col, value) {
    const popup = document.createElement('span');
    popup.className = 'score-popup';
    popup.textContent = `+${value}`;
    popup.style.left = `${cellOffsetPercent(col) + CELL_PERCENT / 2}%`;
    popup.style.top = `${cellOffsetPercent(row)}%`;
    tilesLayerEl.appendChild(popup);
    setTimeout(() => popup.remove(), 650);
  }

  function shakeBoard() {
    boardWrapperEl.classList.add('shake-x');
    setTimeout(() => boardWrapperEl.classList.remove('shake-x'), 400);
  }

  function pulseScore() {
    scoreValueEl.classList.remove('reveal-pop');
    void scoreValueEl.offsetWidth; // force reflow biar animasi restart
    scoreValueEl.classList.add('reveal-pop');
  }

  function updateBestTileStat() {
    const max = getMaxTileValue(grid);
    bestTileValueEl.textContent = max > 0 ? String(max) : '--';
  }

  function showOverlay(el) {
    el.classList.add('visible');
  }

  function hideOverlay(el) {
    el.classList.remove('visible');
  }

  // ===== Terapin actions ke DOM (animasi geser + gabung) =====
  function applyMoveActions(actions) {
    actions.forEach((action) => {
      if (action.type === 'move') {
        const el = tileElements[action.id];
        if (el) positionTile(el, action.to.row, action.to.col);
        return;
      }

      // merge: dua tile sumber sama-sama meluncur ke tujuan, lalu digantiin
      // satu tile baru dengan animasi pop begitu sampai.
      const elA = tileElements[action.fromA.id];
      const elB = tileElements[action.fromB.id];
      if (elA) positionTile(elA, action.to.row, action.to.col);
      if (elB) positionTile(elB, action.to.row, action.to.col);

      setTimeout(() => {
        if (elA) elA.remove();
        if (elB) elB.remove();
        delete tileElements[action.fromA.id];
        delete tileElements[action.fromB.id];

        createTileElement(
          { id: action.resultId, value: action.resultValue, row: action.to.row, col: action.to.col },
          'reveal-pop'
        );
        showScorePopup(action.to.row, action.to.col, action.resultValue);
      }, SLIDE_DURATION_MS);
    });
  }

  // ===== Alur gerakan =====
  function attemptMove(direction) {
    if (boardLocked) return;

    const result = move(grid, direction);
    if (!result.moved) {
      shakeBoard();
      return;
    }

    boardLocked = true;
    moves += 1;
    movesValueEl.textContent = String(moves);

    applyMoveActions(result.actions);

    if (result.scoreGained > 0) {
      score += result.scoreGained;
      scoreValueEl.textContent = String(score);
      pulseScore();
    }

    setTimeout(() => {
      const spawned = spawnTile(grid);
      if (spawned) createTileElement(spawned, 'tile-spawn-in');

      updateBestTileStat();

      const reachedWin = !hasWon && getMaxTileValue(grid) >= 2048;
      if (reachedWin) {
        hasWon = true;
        setTimeout(() => showOverlay(winOverlayEl), 300);
        return; // boardLocked tetap true sampe overlay ditutup
      }

      if (!hasAvailableMoves(grid)) {
        setTimeout(() => {
          gameoverSummaryEl.textContent = `Skor akhir: ${score} · Tile terbesar: ${getMaxTileValue(grid)}`;
          shakeBoard();
          showOverlay(gameoverOverlayEl);
          if (GameHub.saveHighScoreIfBetter('2048', score, true)) {
            refreshScoreBadge('2048');
          }
        }, 300);
        return;
      }

      boardLocked = false;
    }, SLIDE_DURATION_MS + 40);
  }

  // ===== Ronde baru =====
  function startNewGame() {
    grid = createEmptyGrid();
    tileElements = {};
    tilesLayerEl.innerHTML = '';
    score = 0;
    moves = 0;
    hasWon = false;
    boardLocked = false;

    scoreValueEl.textContent = '0';
    movesValueEl.textContent = '0';
    bestTileValueEl.textContent = '--';
    hideOverlay(winOverlayEl);
    hideOverlay(gameoverOverlayEl);

    const first = spawnTile(grid);
    const second = spawnTile(grid);
    if (first) createTileElement(first, 'tile-spawn-in');
    if (second) createTileElement(second, 'tile-spawn-in');
  }

  // ===== Kontrol: keyboard =====
  const KEY_DIRECTIONS = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right',
    W: 'up', S: 'down', A: 'left', D: 'right',
  };

  document.addEventListener('keydown', (e) => {
    const direction = KEY_DIRECTIONS[e.key];
    if (!direction) return;
    e.preventDefault();
    attemptMove(direction);
  });

  // ===== Kontrol: swipe (mobile) =====
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

    if (absDx > absDy) {
      attemptMove(dx > 0 ? 'right' : 'left');
    } else {
      attemptMove(dy > 0 ? 'down' : 'up');
    }
  }, { passive: true });

  // ===== Tombol-tombol =====
  newGameBtn.addEventListener('click', startNewGame);
  winRestartBtn.addEventListener('click', startNewGame);
  gameoverRestartBtn.addEventListener('click', startNewGame);
  winContinueBtn.addEventListener('click', () => {
    hideOverlay(winOverlayEl);
    boardLocked = false;
  });

  // ===== Init =====
  renderBoardBackground();
  startNewGame();
})();