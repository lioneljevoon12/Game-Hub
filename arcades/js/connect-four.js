
(function () {
  const COLS = 7;
  const ROWS = 6;
  const COL_PERCENT = 100 / COLS;
  const ROW_PERCENT = 100 / ROWS;
  const PIECE_INSET = 0.11; // proporsi padding tiap sisi biar piece pas di dalam hole
  const FALL_DURATION_MS = 380;
  const AI_DEPTH = 5;

  const PIECE_A = 'A'; // teal
  const PIECE_B = 'B'; // violet

  const PIECE_COLOR = {
    [PIECE_A]: { solid: 'var(--arcade-teal)', glow: 'rgba(94, 234, 212, 0.6)' },
    [PIECE_B]: { solid: 'var(--arcade-violet)', glow: 'rgba(167, 139, 250, 0.6)' },
  };
  const PIECE_LABEL = { [PIECE_A]: 'TEAL', [PIECE_B]: 'VIOLET' };
  const PIECE_TEXT_CLASS = { [PIECE_A]: 'text-arcade-teal', [PIECE_B]: 'text-arcade-violet' };

  const BOT_THINKING_MESSAGES = ['BOT MIKIR...', 'BOT NGITUNG LANGKAH...', 'BOT NGATUR STRATEGI...', 'TUNGGU BOT JALAN...'];
  const DRAW_MESSAGES = ['SERI! PAPAN PENUH.', 'IMBANG, GAK ADA YANG MENANG.', 'SERI — MAIN LAGI YUK.'];
  const WIN_MESSAGES = {
    bot: {
      player: ['MANTAP, KAMU MENANG!', 'KEREN, BOT KALAH TELAK!', 'HEBAT, KAMU NGALAHIN BOT!'],
      bot: ['BOT MENANG. COBA LAGI!', 'YAH, KALAH SAMA BOT.', 'BOT LEBIH LICIN KALI INI.'],
    },
    friend: {
      [PIECE_A]: ['TEAL MENANG!', 'EMPAT SEJAJAR BUAT TEAL!', 'TEAL BERHASIL NYUSUN 4!'],
      [PIECE_B]: ['VIOLET MENANG!', 'EMPAT SEJAJAR BUAT VIOLET!', 'VIOLET BERHASIL NYUSUN 4!'],
    },
  };

  const STAT_CONFIG = {
    bot: [
      { key: 'wins', label: 'MENANG', color: 'text-arcade-teal' },
      { key: 'draws', label: 'SERI', color: 'text-arcade-gold' },
      { key: 'losses', label: 'KALAH', color: 'text-arcade-pink' },
      { key: 'streak', label: 'STREAK', color: 'text-arcade-text' },
    ],
    friend: [
      { key: 'winsA', label: 'TEAL MENANG', color: 'text-arcade-teal' },
      { key: 'draws', label: 'SERI', color: 'text-arcade-gold' },
      { key: 'winsB', label: 'VIOLET MENANG', color: 'text-arcade-violet' },
      { key: 'rounds', label: 'RONDE', color: 'text-arcade-text' },
    ],
  };

  // ===== DOM refs =====
  const holesLayerEl = document.getElementById('holes-layer');
  const piecesLayerEl = document.getElementById('pieces-layer');
  const columnButtonsEl = document.getElementById('column-buttons');
  const statusEl = document.getElementById('status-text');
  const symbolIndicatorEl = document.getElementById('symbol-indicator');
  const modeBotBtn = document.getElementById('mode-bot');
  const modeFriendBtn = document.getElementById('mode-friend');
  const newRoundBtn = document.getElementById('new-round-btn');
  const resetStatsBtn = document.getElementById('reset-stats-btn');

  // ===== State =====
  let mode = 'bot'; // 'bot' | 'friend'
  let board = createEmptyBoard();
  let currentPlayer = PIECE_A;
  let boardLocked = false;

  let playerPiece = PIECE_A;
  let botPiece = PIECE_B;

  let botStats = { wins: 0, draws: 0, losses: 0, streak: 0 };
  let friendStats = { winsA: 0, draws: 0, winsB: 0, rounds: 0 };

  function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function createEmptyBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  // ===== Aturan main =====
  function getValidColumns(boardState) {
    const cols = [];
    for (let c = 0; c < COLS; c += 1) {
      if (boardState[0][c] === null) cols.push(c);
    }
    return cols;
  }

  function getNextOpenRow(boardState, col) {
    for (let r = ROWS - 1; r >= 0; r -= 1) {
      if (boardState[r][col] === null) return r;
    }
    return -1;
  }

  function hasWin(boardState, piece) {
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c <= COLS - 4; c += 1) {
        if (boardState[r][c] === piece && boardState[r][c + 1] === piece && boardState[r][c + 2] === piece && boardState[r][c + 3] === piece) return true;
      }
    }
    for (let c = 0; c < COLS; c += 1) {
      for (let r = 0; r <= ROWS - 4; r += 1) {
        if (boardState[r][c] === piece && boardState[r + 1][c] === piece && boardState[r + 2][c] === piece && boardState[r + 3][c] === piece) return true;
      }
    }
    for (let r = 0; r <= ROWS - 4; r += 1) {
      for (let c = 0; c <= COLS - 4; c += 1) {
        if (boardState[r][c] === piece && boardState[r + 1][c + 1] === piece && boardState[r + 2][c + 2] === piece && boardState[r + 3][c + 3] === piece) return true;
      }
    }
    for (let r = 3; r < ROWS; r += 1) {
      for (let c = 0; c <= COLS - 4; c += 1) {
        if (boardState[r][c] === piece && boardState[r - 1][c + 1] === piece && boardState[r - 2][c + 2] === piece && boardState[r - 3][c + 3] === piece) return true;
      }
    }
    return false;
  }

  function findWinningCells(boardState, piece) {
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c <= COLS - 4; c += 1) {
        if (boardState[r][c] === piece && boardState[r][c + 1] === piece && boardState[r][c + 2] === piece && boardState[r][c + 3] === piece) {
          return [[r, c], [r, c + 1], [r, c + 2], [r, c + 3]];
        }
      }
    }
    for (let c = 0; c < COLS; c += 1) {
      for (let r = 0; r <= ROWS - 4; r += 1) {
        if (boardState[r][c] === piece && boardState[r + 1][c] === piece && boardState[r + 2][c] === piece && boardState[r + 3][c] === piece) {
          return [[r, c], [r + 1, c], [r + 2, c], [r + 3, c]];
        }
      }
    }
    for (let r = 0; r <= ROWS - 4; r += 1) {
      for (let c = 0; c <= COLS - 4; c += 1) {
        if (boardState[r][c] === piece && boardState[r + 1][c + 1] === piece && boardState[r + 2][c + 2] === piece && boardState[r + 3][c + 3] === piece) {
          return [[r, c], [r + 1, c + 1], [r + 2, c + 2], [r + 3, c + 3]];
        }
      }
    }
    for (let r = 3; r < ROWS; r += 1) {
      for (let c = 0; c <= COLS - 4; c += 1) {
        if (boardState[r][c] === piece && boardState[r - 1][c + 1] === piece && boardState[r - 2][c + 2] === piece && boardState[r - 3][c + 3] === piece) {
          return [[r, c], [r - 1, c + 1], [r - 2, c + 2], [r - 3, c + 3]];
        }
      }
    }
    return null;
  }

  function isBoardFull(boardState) {
    return getValidColumns(boardState).length === 0;
  }

  // ===== Bot: minimax + alpha-beta, dengan heuristik posisi =====
  function evaluateWindow(window4, piece, opponent) {
    const countPiece = window4.filter((v) => v === piece).length;
    const countEmpty = window4.filter((v) => v === null).length;
    const countOpp = window4.filter((v) => v === opponent).length;

    if (countPiece === 4) return 100;
    if (countPiece === 3 && countEmpty === 1) return 6;
    if (countPiece === 2 && countEmpty === 2) return 2;
    if (countOpp === 3 && countEmpty === 1) return -5;
    return 0;
  }

  function scorePosition(boardState, piece) {
    const opponent = piece === PIECE_A ? PIECE_B : PIECE_A;
    let score = 0;

    const centerCol = Math.floor(COLS / 2);
    for (let r = 0; r < ROWS; r += 1) {
      if (boardState[r][centerCol] === piece) score += 3;
    }

    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c <= COLS - 4; c += 1) {
        score += evaluateWindow([boardState[r][c], boardState[r][c + 1], boardState[r][c + 2], boardState[r][c + 3]], piece, opponent);
      }
    }
    for (let c = 0; c < COLS; c += 1) {
      for (let r = 0; r <= ROWS - 4; r += 1) {
        score += evaluateWindow([boardState[r][c], boardState[r + 1][c], boardState[r + 2][c], boardState[r + 3][c]], piece, opponent);
      }
    }
    for (let r = 0; r <= ROWS - 4; r += 1) {
      for (let c = 0; c <= COLS - 4; c += 1) {
        score += evaluateWindow([boardState[r][c], boardState[r + 1][c + 1], boardState[r + 2][c + 2], boardState[r + 3][c + 3]], piece, opponent);
      }
    }
    for (let r = 3; r < ROWS; r += 1) {
      for (let c = 0; c <= COLS - 4; c += 1) {
        score += evaluateWindow([boardState[r][c], boardState[r - 1][c + 1], boardState[r - 2][c + 2], boardState[r - 3][c + 3]], piece, opponent);
      }
    }

    return score;
  }

  function minimax(boardState, depth, alpha, beta, maximizing) {
    const validCols = getValidColumns(boardState);
    const terminal = hasWin(boardState, botPiece) || hasWin(boardState, playerPiece) || validCols.length === 0;

    if (depth === 0 || terminal) {
      if (terminal) {
        if (hasWin(boardState, botPiece)) return { score: 1000000 };
        if (hasWin(boardState, playerPiece)) return { score: -1000000 };
        return { score: 0 };
      }
      return { score: scorePosition(boardState, botPiece) };
    }

    let bestCol = validCols[Math.floor(Math.random() * validCols.length)];

    if (maximizing) {
      let value = -Infinity;
      for (let i = 0; i < validCols.length; i += 1) {
        const col = validCols[i];
        const row = getNextOpenRow(boardState, col);
        boardState[row][col] = botPiece;
        const result = minimax(boardState, depth - 1, alpha, beta, false);
        boardState[row][col] = null;
        if (result.score > value) {
          value = result.score;
          bestCol = col;
        }
        alpha = Math.max(alpha, value);
        if (alpha >= beta) break;
      }
      return { score: value, column: bestCol };
    }

    let value = Infinity;
    for (let i = 0; i < validCols.length; i += 1) {
      const col = validCols[i];
      const row = getNextOpenRow(boardState, col);
      boardState[row][col] = playerPiece;
      const result = minimax(boardState, depth - 1, alpha, beta, true);
      boardState[row][col] = null;
      if (result.score < value) {
        value = result.score;
        bestCol = col;
      }
      beta = Math.min(beta, value);
      if (alpha >= beta) break;
    }
    return { score: value, column: bestCol };
  }

  function getBotColumn() {
    return minimax(board, AI_DEPTH, -Infinity, Infinity, true).column;
  }

  // ===== Render =====
  function buildBoardVisuals() {
    holesLayerEl.innerHTML = '';
    columnButtonsEl.innerHTML = '';

    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const cell = document.createElement('div');
        cell.className = 'absolute';
        cell.style.left = `${c * COL_PERCENT}%`;
        cell.style.top = `${r * ROW_PERCENT}%`;
        cell.style.width = `${COL_PERCENT}%`;
        cell.style.height = `${ROW_PERCENT}%`;

        const hole = document.createElement('div');
        hole.className = 'connect4-hole';
        hole.style.position = 'absolute';
        hole.style.left = '9%';
        hole.style.top = '9%';
        hole.style.width = '82%';
        hole.style.height = '82%';
        cell.appendChild(hole);

        holesLayerEl.appendChild(cell);
      }
    }

    for (let c = 0; c < COLS; c += 1) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'h-full w-full hover:bg-white/5 transition-colors';
      btn.setAttribute('aria-label', `Jatuhin di kolom ${c + 1}`);
      btn.addEventListener('click', () => handleColumnClick(c));
      columnButtonsEl.appendChild(btn);
    }
  }

  function createPieceElement(col, piece) {
    const el = document.createElement('div');
    el.className = 'connect4-piece';
    el.style.left = `${col * COL_PERCENT + COL_PERCENT * PIECE_INSET}%`;
    el.style.width = `${COL_PERCENT * (1 - PIECE_INSET * 2)}%`;
    el.style.height = `${ROW_PERCENT * (1 - PIECE_INSET * 2)}%`;
    el.style.top = `${-ROW_PERCENT}%`;
    el.style.background = PIECE_COLOR[piece].solid;
    el.style.boxShadow = `0 0 10px ${PIECE_COLOR[piece].glow}`;
    el.style.transition = 'none';
    return el;
  }

  function setStatus(text, colorClass) {
    statusEl.textContent = text;
    statusEl.className =
      `font-pixel text-center text-xs sm:text-sm mb-5 min-h-[2.5em] flex items-center justify-center px-2 ${colorClass || 'text-arcade-muted'}`;
  }

  function updateSymbolIndicator() {
    if (mode === 'bot') {
      symbolIndicatorEl.textContent = `KAMU PAKE ${PIECE_LABEL[playerPiece]}`;
      symbolIndicatorEl.className = `font-mono text-[10px] text-center mb-3 ${PIECE_TEXT_CLASS[playerPiece]}`;
      symbolIndicatorEl.classList.remove('hidden');
    } else {
      symbolIndicatorEl.textContent = '';
      symbolIndicatorEl.classList.add('hidden');
    }
  }

  function renderStats() {
    const config = STAT_CONFIG[mode];
    const data = mode === 'bot' ? botStats : friendStats;
    config.forEach((stat, i) => {
      const valueEl = document.getElementById(`stat${i + 1}-value`);
      const labelEl = document.getElementById(`stat${i + 1}-label`);
      valueEl.textContent = String(data[stat.key]);
      valueEl.className = `font-mono text-base sm:text-lg ${stat.color}`;
      labelEl.textContent = stat.label;
    });
  }

  function setColumnButtonsDisabled(disabled) {
    columnButtonsEl.querySelectorAll('button').forEach((btn) => {
      btn.disabled = disabled;
    });
  }

  // ===== Alur permainan =====
  function dropPiece(col, piece) {
    const row = getNextOpenRow(board, col);
    if (row === -1) return null;

    board[row][col] = piece;
    const el = createPieceElement(col, piece);
    piecesLayerEl.appendChild(el);

    void el.offsetWidth; // force reflow biar transisi selalu jalan
    el.style.transition = `top ${FALL_DURATION_MS}ms cubic-bezier(0.5, 0, 0.85, 0.15)`;
    el.style.top = `${row * ROW_PERCENT}%`;

    setTimeout(() => {
      el.classList.add('piece-settle');
    }, FALL_DURATION_MS);

    return { row, col, el };
  }

  function updateStatsOnWin(winner) {
    if (mode === 'bot') {
      if (winner === playerPiece) {
        botStats.wins += 1;
        botStats.streak += 1;
        if (GameHub.saveHighScoreIfBetter('connect4', botStats.streak, true)) {
          refreshScoreBadge('connect4');
        }
      } else {
        botStats.losses += 1;
        botStats.streak = 0;
      }
    } else if (winner === PIECE_A) {
      friendStats.winsA += 1;
      friendStats.rounds += 1;
    } else {
      friendStats.winsB += 1;
      friendStats.rounds += 1;
    }
    renderStats();
  }

  function updateStatsOnDraw() {
    if (mode === 'bot') {
      botStats.draws += 1;
    } else {
      friendStats.draws += 1;
      friendStats.rounds += 1;
    }
    renderStats();
  }

  function handleWin(winner) {
    boardLocked = true;
    setColumnButtonsDisabled(true);

    const cells = findWinningCells(board, winner);

    // Highlight keping pemenang, dicari lewat posisi (left/top) akhirnya di papan.
    if (cells) {
      const pieceEls = piecesLayerEl.querySelectorAll('.connect4-piece');
      cells.forEach(([r, c]) => {
        const targetLeft = `${c * COL_PERCENT + COL_PERCENT * PIECE_INSET}%`;
        const targetTop = `${r * ROW_PERCENT}%`;
        pieceEls.forEach((el) => {
          if (el.style.left === targetLeft && el.style.top === targetTop) {
            el.classList.add('result-glow-win');
          }
        });
      });
    }

    updateStatsOnWin(winner);

    const colorClass = PIECE_TEXT_CLASS[winner];
    if (mode === 'bot') {
      const outcomeKey = winner === playerPiece ? 'player' : 'bot';
      setStatus(pickRandom(WIN_MESSAGES.bot[outcomeKey]), colorClass);
    } else {
      setStatus(pickRandom(WIN_MESSAGES.friend[winner]), colorClass);
    }
  }

  function handleDraw() {
    boardLocked = true;
    setColumnButtonsDisabled(true);
    updateStatsOnDraw();
    setStatus(pickRandom(DRAW_MESSAGES), 'text-arcade-gold');
  }

  function afterDrop() {
    if (hasWin(board, currentPlayer)) {
      handleWin(currentPlayer);
      return true;
    }
    if (isBoardFull(board)) {
      handleDraw();
      return true;
    }
    return false;
  }

  function triggerBotMove(messagePool) {
    boardLocked = true;
    setColumnButtonsDisabled(true);
    setStatus(pickRandom(messagePool || BOT_THINKING_MESSAGES), 'text-arcade-muted');

    setTimeout(() => {
      const col = getBotColumn();
      currentPlayer = botPiece;
      dropPiece(col, botPiece);

      setTimeout(() => {
        if (afterDrop()) return;
        boardLocked = false;
        setColumnButtonsDisabled(false);
        currentPlayer = playerPiece;
        setStatus('GILIRAN KAMU', 'text-arcade-muted');
      }, FALL_DURATION_MS + 60);
    }, 500 + Math.random() * 300);
  }

  function handleColumnClick(col) {
    if (boardLocked) return;
    if (mode === 'bot' && currentPlayer !== playerPiece) return;
    if (getNextOpenRow(board, col) === -1) return;

    dropPiece(col, currentPlayer);

    setTimeout(() => {
      if (afterDrop()) return;

      const nextPlayer = currentPlayer === PIECE_A ? PIECE_B : PIECE_A;
      currentPlayer = nextPlayer;

      if (mode === 'bot' && currentPlayer === botPiece) {
        triggerBotMove();
      } else {
        setStatus(mode === 'bot' ? 'GILIRAN KAMU' : `GILIRAN ${PIECE_LABEL[currentPlayer]}`, 'text-arcade-muted');
      }
    }, FALL_DURATION_MS + 60);
  }

  // ===== Ronde & mode =====
  function newRound() {
    board = createEmptyBoard();
    piecesLayerEl.innerHTML = '';
    boardLocked = false;
    setColumnButtonsDisabled(false);
    currentPlayer = PIECE_A;

    if (mode === 'bot') {
      playerPiece = Math.random() < 0.5 ? PIECE_A : PIECE_B;
      botPiece = playerPiece === PIECE_A ? PIECE_B : PIECE_A;
      updateSymbolIndicator();

      if (currentPlayer === botPiece) {
        triggerBotMove(['BOT DULUAN NIH...', 'KALI INI BOT DULUAN.', 'GILIRAN BOT DULU, SABAR YA...']);
        return;
      }
      setStatus('GILIRAN KAMU', 'text-arcade-muted');
    } else {
      updateSymbolIndicator();
      setStatus(`GILIRAN ${PIECE_LABEL[currentPlayer]}`, 'text-arcade-muted');
    }
  }

  function updateModeButtons() {
    const botActive = mode === 'bot';
    modeBotBtn.className =
      `flex-1 rounded-md py-2 font-mono text-xs transition-colors ${botActive ? 'bg-arcade-teal text-arcade-bg font-semibold' : 'text-arcade-muted hover:text-arcade-text'}`;
    modeFriendBtn.className =
      `flex-1 rounded-md py-2 font-mono text-xs transition-colors ${!botActive ? 'bg-arcade-teal text-arcade-bg font-semibold' : 'text-arcade-muted hover:text-arcade-text'}`;
    modeBotBtn.setAttribute('aria-pressed', String(botActive));
    modeFriendBtn.setAttribute('aria-pressed', String(!botActive));
  }

  function setMode(newMode) {
    if (newMode === mode) return;
    mode = newMode;
    updateModeButtons();
    renderStats();
    newRound();
  }

  function resetCurrentStats() {
    if (mode === 'bot') {
      botStats = { wins: 0, draws: 0, losses: 0, streak: 0 };
    } else {
      friendStats = { winsA: 0, draws: 0, winsB: 0, rounds: 0 };
    }
    renderStats();
  }

  modeBotBtn.addEventListener('click', () => setMode('bot'));
  modeFriendBtn.addEventListener('click', () => setMode('friend'));
  newRoundBtn.addEventListener('click', newRound);
  resetStatsBtn.addEventListener('click', resetCurrentStats);

  buildBoardVisuals();
  updateModeButtons();
  renderStats();
  newRound();
})();