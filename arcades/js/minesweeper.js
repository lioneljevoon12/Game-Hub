/**
 * Minesweeper — InsertCoin
 * Retro arcade neon minesweeper with procedural random mines, first-click safe guarantee,
 * cascade flood-fill, mobile toggle modes, audio synthesis, and best time tracking.
 */

(function () {
  'use strict';

  // ===== Web Audio API Synthesizer =====
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
    } catch (e) {}
  }

  function playNoise(duration, gainVal = 0.15) {
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
    click() {
      playTone(600, 'triangle', 0.04, 300, 0.06);
    },
    flag() {
      playTone(1050, 'sine', 0.08, 1400, 0.08);
    },
    unflag() {
      playTone(800, 'sine', 0.06, 500, 0.05);
    },
    chord() {
      playTone(750, 'triangle', 0.05, 900, 0.07);
    },
    explode() {
      playNoise(0.5, 0.25);
      playTone(160, 'sawtooth', 0.4, 35, 0.2);
    },
    win() {
      [523.25, 659.25, 783.99, 1046.50, 1318.51].forEach((freq, idx) => {
        setTimeout(() => playTone(freq, 'sine', 0.2, freq, 0.1), idx * 80);
      });
    }
  };

  // ===== Difficulties Configuration =====
  const CONFIGS = {
    easy: { rows: 8, cols: 8, mines: 10, name: 'Mudah' },
    medium: { rows: 12, cols: 12, mines: 22, name: 'Menengah' },
    hard: { rows: 16, cols: 16, mines: 40, name: 'Ahli' }
  };

  const GAME_ID = 'minesweeper';

  // ===== State =====
  let currentDiff = 'easy';
  let board = [];
  let rows = 8;
  let cols = 8;
  let mineCount = 10;
  let flagsPlaced = 0;
  let revealedCount = 0;
  let minesGenerated = false;
  let gameOver = false;
  let gameWon = false;
  let startTime = null;
  let timerInterval = null;
  let elapsedSeconds = 0;
  let mobileMode = 'dig'; // 'dig' or 'flag'

  // Long press helper for touch devices
  let longPressTimer = null;
  let touchMoved = false;

  // ===== DOM Elements =====
  const boardGrid = document.getElementById('board-grid');
  const minesCountEl = document.getElementById('mines-count');
  const timerValEl = document.getElementById('timer-val');
  const faceBtn = document.getElementById('face-btn');
  const winOverlay = document.getElementById('win-overlay');
  const winSummary = document.getElementById('win-summary');
  const winRestartBtn = document.getElementById('win-restart-btn');
  const gameoverOverlay = document.getElementById('gameover-overlay');
  const gameoverRestartBtn = document.getElementById('gameover-restart-btn');
  const modeDigBtn = document.getElementById('mode-dig-btn');
  const modeFlagBtn = document.getElementById('mode-flag-btn');
  const soundToggleBtn = document.getElementById('sound-toggle-btn');
  const soundIcon = document.getElementById('sound-icon');
  const diffBtns = document.querySelectorAll('.diff-btn');

  // ===== Timer Management =====
  function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    startTime = Date.now();
    timerInterval = setInterval(() => {
      elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      timerValEl.textContent = String(Math.min(999, elapsedSeconds)).padStart(3, '0');
    }, 500);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function resetTimer() {
    stopTimer();
    elapsedSeconds = 0;
    timerValEl.textContent = '000';
  }

  // ===== Board Initialization =====
  function initBoard() {
    const config = CONFIGS[currentDiff];
    rows = config.rows;
    cols = config.cols;
    mineCount = config.mines;
    flagsPlaced = 0;
    revealedCount = 0;
    minesGenerated = false;
    gameOver = false;
    gameWon = false;

    resetTimer();
    faceBtn.textContent = '🙂';
    minesCountEl.textContent = String(mineCount);

    winOverlay.classList.add('hidden');
    gameoverOverlay.classList.add('hidden');

    // Setup CSS Grid template
    boardGrid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    boardGrid.innerHTML = '';

    // Initialize 2D board model
    board = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        const cellData = {
          row: r,
          col: c,
          isMine: false,
          neighborMines: 0,
          revealed: false,
          flagged: false,
          element: null
        };

        const cellEl = document.createElement('button');
        cellEl.type = 'button';
        cellEl.className = 'mine-cell';
        cellEl.setAttribute('data-r', r);
        cellEl.setAttribute('data-c', c);
        cellEl.setAttribute('aria-label', `Baris ${r + 1} Kolom ${c + 1}`);

        // Handle Events
        attachCellEvents(cellEl, cellData);

        cellData.element = cellEl;
        boardGrid.appendChild(cellEl);
        row.push(cellData);
      }
      board.push(row);
    }
  }

  // ===== Procedural Mine Generator (First-Click Safe) =====
  function generateRandomMines(startR, startC) {
    const pool = [];

    // Gather all valid coords excluding the first clicked cell & its 8 neighbors
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isNeighbor = Math.abs(r - startR) <= 1 && Math.abs(c - startC) <= 1;
        if (!isNeighbor) {
          pool.push({ r, c });
        }
      }
    }

    // Fallback if grid is tight
    if (pool.length < mineCount) {
      pool.length = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!(r === startR && c === startC)) {
            pool.push({ r, c });
          }
        }
      }
    }

    // Fisher-Yates Shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // Place mines
    for (let i = 0; i < mineCount && i < pool.length; i++) {
      const { r, c } = pool[i];
      board[r][c].isMine = true;
    }

    // Calculate neighbor counts
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!board[r][c].isMine) {
          let count = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              const nr = r + dr;
              const nc = c + dc;
              if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].isMine) {
                count++;
              }
            }
          }
          board[r][c].neighborMines = count;
        }
      }
    }

    minesGenerated = true;
    startTimer();
  }

  // ===== Cell Action Handlers =====
  function revealCell(cell) {
    if (gameOver || gameWon || cell.revealed || cell.flagged) return;

    initAudio();

    if (!minesGenerated) {
      generateRandomMines(cell.row, cell.col);
    }

    if (cell.isMine) {
      // Hit a mine! BOOM!
      triggerGameOver(cell);
      return;
    }

    // Safe reveal
    sfx.click();
    cascadeReveal(cell);
    checkWinCondition();
  }

  function cascadeReveal(startCell) {
    const queue = [startCell];
    startCell.revealed = true;

    while (queue.length > 0) {
      const cell = queue.shift();
      revealedCount++;

      cell.element.classList.add('revealed');
      cell.element.classList.remove('flagged');

      if (cell.neighborMines > 0) {
        cell.element.textContent = cell.neighborMines;
        cell.element.classList.add(`num-${cell.neighborMines}`);
      } else {
        cell.element.textContent = '';
        // Flood fill to 8 neighbors
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = cell.row + dr;
            const nc = cell.col + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
              const neighbor = board[nr][nc];
              if (!neighbor.revealed && !neighbor.flagged && !neighbor.isMine) {
                neighbor.revealed = true;
                queue.push(neighbor);
              }
            }
          }
        }
      }
    }
  }

  function toggleFlag(cell) {
    if (gameOver || gameWon || cell.revealed) return;

    initAudio();

    if (cell.flagged) {
      cell.flagged = false;
      cell.element.classList.remove('flagged');
      cell.element.textContent = '';
      flagsPlaced--;
      sfx.unflag();
    } else {
      cell.flagged = true;
      cell.element.classList.add('flagged');
      cell.element.textContent = '🚩';
      flagsPlaced++;
      sfx.flag();
    }

    const remaining = mineCount - flagsPlaced;
    minesCountEl.textContent = String(remaining);
  }

  // Quick chord when clicking a revealed number
  function handleChord(cell) {
    if (gameOver || gameWon || !cell.revealed || cell.neighborMines === 0) return;

    let flagCount = 0;
    const unrevealedNeighbors = [];

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = cell.row + dr;
        const nc = cell.col + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          const neighbor = board[nr][nc];
          if (neighbor.flagged) flagCount++;
          else if (!neighbor.revealed) unrevealedNeighbors.push(neighbor);
        }
      }
    }

    if (flagCount === cell.neighborMines && unrevealedNeighbors.length > 0) {
      sfx.chord();
      for (let neighbor of unrevealedNeighbors) {
        revealCell(neighbor);
      }
    }
  }

  // ===== End Game Logic =====
  function triggerGameOver(hitCell) {
    gameOver = true;
    stopTimer();
    faceBtn.textContent = '😵';
    sfx.explode();

    hitCell.element.classList.add('mine-exploded');
    hitCell.element.textContent = '💥';

    // Reveal all remaining mines with slight stagger
    let delay = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = board[r][c];
        if (cell.isMine && cell !== hitCell) {
          setTimeout(() => {
            cell.element.classList.add('revealed');
            cell.element.textContent = cell.flagged ? '🚩' : '💣';
            if (!cell.flagged) cell.element.style.color = '#ff6f9c';
          }, delay);
          delay += 25;
        } else if (cell.flagged && !cell.isMine) {
          // False flag marker
          cell.element.textContent = '❌';
        }
      }
    }

    setTimeout(() => {
      gameoverOverlay.classList.remove('hidden');
    }, Math.max(600, delay + 200));
  }

  function checkWinCondition() {
    const totalCells = rows * cols;
    if (revealedCount === totalCells - mineCount) {
      gameWon = true;
      stopTimer();
      faceBtn.textContent = '😎';
      sfx.win();

      // Flag all remaining mines
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = board[r][c];
          if (cell.isMine && !cell.flagged) {
            cell.element.classList.add('flagged');
            cell.element.textContent = '🚩';
          }
        }
      }
      minesCountEl.textContent = '0';

      // Save Best Time (Lower is better!)
      const isNewBest = GameHub.saveHighScoreIfBetter(GAME_ID, elapsedSeconds, false);
      if (typeof refreshScoreBadge === 'function') {
        refreshScoreBadge(GAME_ID);
      }

      winSummary.textContent = `Waktu selesai: ${elapsedSeconds} detik pada level ${CONFIGS[currentDiff].name}.${isNewBest ? ' 🔥 Rekor waktu baru!' : ''}`;
      setTimeout(() => {
        winOverlay.classList.remove('hidden');
      }, 400);
    }
  }

  // ===== Event Bindings =====
  function attachCellEvents(cellEl, cellData) {
    // Desktop left click / Mobile tap
    cellEl.addEventListener('click', (e) => {
      e.preventDefault();
      if (cellData.revealed) {
        handleChord(cellData);
      } else {
        if (mobileMode === 'flag') {
          toggleFlag(cellData);
        } else {
          revealCell(cellData);
        }
      }
    });

    // Right click (Context menu) -> Flag
    cellEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      toggleFlag(cellData);
    });

    // Mobile Long-Press to Flag
    cellEl.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      touchMoved = false;
      faceBtn.textContent = '😮';
      longPressTimer = setTimeout(() => {
        if (!touchMoved && !cellData.revealed) {
          toggleFlag(cellData);
          if (navigator.vibrate) navigator.vibrate(35);
        }
      }, 450);
    });

    cellEl.addEventListener('pointermove', () => {
      touchMoved = true;
    });

    cellEl.addEventListener('pointerup', () => {
      clearTimeout(longPressTimer);
      if (!gameOver && !gameWon) faceBtn.textContent = '🙂';
    });

    cellEl.addEventListener('pointercancel', () => {
      clearTimeout(longPressTimer);
      if (!gameOver && !gameWon) faceBtn.textContent = '🙂';
    });
  }

  function setupGlobalEvents() {
    // Face button restart
    faceBtn.addEventListener('click', () => {
      initAudio();
      initBoard();
    });

    // Overlay restart buttons
    winRestartBtn.addEventListener('click', () => {
      initAudio();
      initBoard();
    });

    gameoverRestartBtn.addEventListener('click', () => {
      initAudio();
      initBoard();
    });

    // Difficulty tab buttons
    diffBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        initAudio();
        const diff = btn.getAttribute('data-diff');
        if (CONFIGS[diff]) {
          currentDiff = diff;
          diffBtns.forEach((b) => {
            b.className = 'diff-btn px-3 py-1.5 rounded-lg font-mono text-xs transition-colors bg-arcade-alt text-arcade-muted hover:text-arcade-gold border border-white/5';
          });
          btn.className = 'diff-btn px-3 py-1.5 rounded-lg font-mono text-xs transition-colors bg-arcade-teal text-arcade-bg font-semibold';
          initBoard();
        }
      });
    });

    // Mobile Dig / Flag Mode Switcher
    if (modeDigBtn && modeFlagBtn) {
      modeDigBtn.addEventListener('click', () => {
        initAudio();
        mobileMode = 'dig';
        modeDigBtn.className = 'flex-1 py-2 px-3 rounded-lg font-mono text-xs font-semibold flex items-center justify-center gap-1.5 bg-arcade-teal text-arcade-bg transition-all';
        modeFlagBtn.className = 'flex-1 py-2 px-3 rounded-lg font-mono text-xs font-semibold flex items-center justify-center gap-1.5 bg-arcade-alt text-arcade-muted hover:text-arcade-gold border border-white/10 transition-all';
      });

      modeFlagBtn.addEventListener('click', () => {
        initAudio();
        mobileMode = 'flag';
        modeFlagBtn.className = 'flex-1 py-2 px-3 rounded-lg font-mono text-xs font-semibold flex items-center justify-center gap-1.5 bg-arcade-gold text-arcade-bg transition-all';
        modeDigBtn.className = 'flex-1 py-2 px-3 rounded-lg font-mono text-xs font-semibold flex items-center justify-center gap-1.5 bg-arcade-alt text-arcade-muted hover:text-arcade-gold border border-white/10 transition-all';
      });
    }

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

  // ===== Startup =====
  document.addEventListener('DOMContentLoaded', () => {
    setupGlobalEvents();
    initBoard();
  });
})();
