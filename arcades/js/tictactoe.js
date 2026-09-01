/**
 * tictactoe.js — Tic Tac Toe vs Bot (minimax) atau vs Teman (lokal 2 pemain).
 * Butuh GameHub + refreshScoreBadge dari shared.js (di-load sebelum file ini).
 */

(function () {
  // ===== Koordinat garis menang, dalam ruang viewBox 0-100 (persegi) =====
  const LINE_COORDS = {
    row0: { x1: 5, y1: 16.67, x2: 95, y2: 16.67 },
    row1: { x1: 5, y1: 50, x2: 95, y2: 50 },
    row2: { x1: 5, y1: 83.33, x2: 95, y2: 83.33 },
    col0: { x1: 16.67, y1: 5, x2: 16.67, y2: 95 },
    col1: { x1: 50, y1: 5, x2: 50, y2: 95 },
    col2: { x1: 83.33, y1: 5, x2: 83.33, y2: 95 },
    diagMain: { x1: 5, y1: 5, x2: 95, y2: 95 },
    diagAnti: { x1: 95, y1: 5, x2: 5, y2: 95 },
  };

  const WIN_PATTERNS = [
    { cells: [0, 1, 2], line: LINE_COORDS.row0 },
    { cells: [3, 4, 5], line: LINE_COORDS.row1 },
    { cells: [6, 7, 8], line: LINE_COORDS.row2 },
    { cells: [0, 3, 6], line: LINE_COORDS.col0 },
    { cells: [1, 4, 7], line: LINE_COORDS.col1 },
    { cells: [2, 5, 8], line: LINE_COORDS.col2 },
    { cells: [0, 4, 8], line: LINE_COORDS.diagMain },
    { cells: [2, 4, 6], line: LINE_COORDS.diagAnti },
  ];

  // ===== Kumpulan teks — random tiap kali dipakai =====
  const BOT_THINKING_MESSAGES = ['BOT MIKIR...', 'BOT LAGI ITUNG LANGKAH...', 'TUNGGU BOT JALAN...', 'BOT NGATUR STRATEGI...'];
  const BOT_FIRST_MESSAGES = ['BOT DULUAN NIH...', 'KALI INI BOT DULUAN.', 'GILIRAN BOT DULU, SABAR YA...'];
  const DRAW_MESSAGES = ['SERI! PAPAN PENUH.', 'IMBANG, GAK ADA YANG MENANG.', 'SERI — MAIN LAGI YUK.'];
  const WIN_MESSAGES = {
    bot: {
      player: ['MANTAP, KAMU MENANG!', 'KEREN, BOT KALAH TELAK!', 'HEBAT, KAMU NGALAHIN BOT!'],
      bot: ['BOT MENANG. COBA LAGI!', 'YAH, KALAH SAMA BOT.', 'BOT LEBIH LICIN KALI INI.'],
    },
    friend: {
      X: ['X MENANG!', 'GARIS X! MENANG TELAK.', 'X BERHASIL BIKIN GARIS!'],
      O: ['O MENANG!', 'GARIS O! MANTAP.', 'O BERHASIL BIKIN GARIS!'],
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
      { key: 'winsX', label: 'X MENANG', color: 'text-arcade-teal' },
      { key: 'draws', label: 'SERI', color: 'text-arcade-gold' },
      { key: 'winsO', label: 'O MENANG', color: 'text-arcade-violet' },
      { key: 'rounds', label: 'RONDE', color: 'text-arcade-text' },
    ],
  };

  // ===== DOM refs =====
  const boardEl = document.getElementById('board');
  const svgEl = document.getElementById('win-line-svg');
  const lineEl = document.getElementById('win-line');
  const statusEl = document.getElementById('status-text');
  const symbolIndicatorEl = document.getElementById('symbol-indicator');
  const modeBotBtn = document.getElementById('mode-bot');
  const modeFriendBtn = document.getElementById('mode-friend');
  const newRoundBtn = document.getElementById('new-round-btn');
  const resetStatsBtn = document.getElementById('reset-stats-btn');

  // ===== State =====
  let mode = 'bot'; // 'bot' | 'friend'
  let cells = Array(9).fill(null);
  let cellEls = [];
  let currentPlayer = 'X';
  let boardLocked = false;

  // Simbol pemain vs bot di-random tiap ronde baru (mode bot) — gak selalu X.
  let playerSymbol = 'X';
  let botSymbol = 'O';

  let botStats = { wins: 0, draws: 0, losses: 0, streak: 0 };
  let friendStats = { winsX: 0, draws: 0, winsO: 0, rounds: 0 };

  function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  // ===== Aturan main =====
  function checkWinnerPattern(boardState) {
    for (let p = 0; p < WIN_PATTERNS.length; p += 1) {
      const [a, b, c] = WIN_PATTERNS[p].cells;
      if (boardState[a] && boardState[a] === boardState[b] && boardState[a] === boardState[c]) {
        return { winner: boardState[a], pattern: WIN_PATTERNS[p].cells, line: WIN_PATTERNS[p].line };
      }
    }
    return null;
  }

  function isBoardFull(boardState) {
    return boardState.every((v) => v !== null);
  }

  // ===== Bot: minimax (main sempurna, unbeatable) — pakai botSymbol/playerSymbol dinamis =====
  function minimax(boardState, depth, isMaximizing) {
    const result = checkWinnerPattern(boardState);
    if (result) return result.winner === botSymbol ? 10 - depth : depth - 10;
    if (isBoardFull(boardState)) return 0;

    if (isMaximizing) {
      let best = -Infinity;
      for (let i = 0; i < 9; i += 1) {
        if (boardState[i] === null) {
          boardState[i] = botSymbol;
          best = Math.max(best, minimax(boardState, depth + 1, false));
          boardState[i] = null;
        }
      }
      return best;
    }

    let best = Infinity;
    for (let i = 0; i < 9; i += 1) {
      if (boardState[i] === null) {
        boardState[i] = playerSymbol;
        best = Math.min(best, minimax(boardState, depth + 1, true));
        boardState[i] = null;
      }
    }
    return best;
  }

  function getBotMove(boardState) {
    let bestScore = -Infinity;
    let bestMoves = [];
    for (let i = 0; i < 9; i += 1) {
      if (boardState[i] === null) {
        boardState[i] = botSymbol;
        const score = minimax(boardState, 1, false);
        boardState[i] = null;
        if (score > bestScore) {
          bestScore = score;
          bestMoves = [i];
        } else if (score === bestScore) {
          bestMoves.push(i);
        }
      }
    }
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  // ===== Render helpers =====
  function setStatus(text, colorClass) {
    statusEl.textContent = text;
    statusEl.className =
      `font-pixel text-center text-xs sm:text-sm mb-6 min-h-[2.5em] flex items-center justify-center px-2 ${colorClass || 'text-arcade-muted'}`;
  }

  function updateSymbolIndicator() {
    if (mode === 'bot') {
      const colorClass = playerSymbol === 'X' ? 'text-arcade-teal' : 'text-arcade-violet';
      symbolIndicatorEl.textContent = `KAMU MAIN SEBAGAI ${playerSymbol}`;
      symbolIndicatorEl.className = `font-mono text-[10px] text-center mb-3 ${colorClass}`;
      symbolIndicatorEl.classList.remove('hidden');
    } else {
      symbolIndicatorEl.textContent = '';
      symbolIndicatorEl.classList.add('hidden');
    }
  }

  function renderMark(index, symbol) {
    const cell = cellEls[index];
    const colorClass = symbol === 'X' ? 'text-arcade-teal' : 'text-arcade-violet';
    const iconName = symbol === 'X' ? 'x' : 'circle';
    cell.innerHTML = `<span class="ttt-mark reveal-pop inline-flex ${colorClass}"><i data-lucide="${iconName}" class="w-8 h-8 sm:w-10 sm:h-10"></i></span>`;
    cell.disabled = true;
    cell.setAttribute('aria-label', `Kotak ${index + 1}, isi ${symbol}`);
    if (window.lucide) lucide.createIcons();
  }

  function clearCellVisual(cell, index) {
    cell.innerHTML = '';
    cell.disabled = false;
    cell.classList.remove('result-glow-win', 'is-shattering');
    cell.setAttribute('aria-label', `Kotak ${index + 1}, kosong`);
  }

  function buildBoardCells() {
    boardEl.innerHTML = '';
    cellEls = [];
    for (let i = 0; i < 9; i += 1) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ttt-cell rounded-2xl relative flex items-center justify-center';
      btn.dataset.index = String(i);
      btn.setAttribute('aria-label', `Kotak ${i + 1}, kosong`);
      btn.addEventListener('click', () => handleCellClick(i));
      boardEl.appendChild(btn);
      cellEls.push(btn);
    }
  }

  // ===== Garis kemenangan (SVG, digambar progresif) =====
  function drawWinLine(line, winner) {
    const { x1, y1, x2, y2 } = line;
    lineEl.setAttribute('x1', x1);
    lineEl.setAttribute('y1', y1);
    lineEl.setAttribute('x2', x2);
    lineEl.setAttribute('y2', y2);
    lineEl.style.stroke = winner === 'X' ? 'var(--arcade-teal)' : 'var(--arcade-violet)';

    const length = Math.hypot(x2 - x1, y2 - y1);
    lineEl.style.transition = 'none';
    lineEl.style.strokeDasharray = String(length);
    lineEl.style.strokeDashoffset = String(length);

    svgEl.style.opacity = '1';

    // Force reflow biar transition selalu ke-trigger dari state awal.
    void lineEl.getBoundingClientRect();
    lineEl.style.transition = 'stroke-dashoffset 0.5s ease-out';
    lineEl.style.strokeDashoffset = '0';
  }

  function resetWinLine() {
    svgEl.style.opacity = '0';
    lineEl.style.transition = 'none';
    lineEl.style.strokeDashoffset = lineEl.style.strokeDasharray || '0';
  }

  // ===== Efek "hancur" buat simbol yang kalah =====
  function shatterCell(index) {
    const cell = cellEls[index];
    const symbol = cells[index];
    const color = symbol === 'X' ? 'var(--arcade-teal)' : 'var(--arcade-violet)';

    cell.classList.add('is-shattering');

    for (let i = 0; i < 8; i += 1) {
      const shard = document.createElement('span');
      shard.className = 'shatter-piece';
      const angle = Math.random() * Math.PI * 2;
      const distance = 26 + Math.random() * 24;
      shard.style.setProperty('--tx', `${Math.cos(angle) * distance}px`);
      shard.style.setProperty('--ty', `${Math.sin(angle) * distance}px`);
      shard.style.setProperty('--rot', `${Math.random() * 360}deg`);
      shard.style.background = color;
      shard.style.animationDelay = `${Math.random() * 80}ms`;
      cell.appendChild(shard);
    }

    setTimeout(() => {
      cell.querySelectorAll('.shatter-piece').forEach((el) => el.remove());
      cell.innerHTML = '';
      cell.classList.remove('is-shattering');
    }, 850);
  }

  // ===== Stats =====
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

  function updateStatsOnWin(winner) {
    if (mode === 'bot') {
      if (winner === playerSymbol) {
        botStats.wins += 1;
        botStats.streak += 1;
        if (GameHub.saveHighScoreIfBetter('tictactoe', botStats.streak, true)) {
          refreshScoreBadge('tictactoe');
        }
      } else {
        botStats.losses += 1;
        botStats.streak = 0;
      }
    } else if (winner === 'X') {
      friendStats.winsX += 1;
      friendStats.rounds += 1;
    } else {
      friendStats.winsO += 1;
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

  // ===== Alur permainan =====
  function handleWin(result) {
    boardLocked = true;
    drawWinLine(result.line, result.winner);
    result.pattern.forEach((i) => cellEls[i].classList.add('result-glow-win'));

    const loserSymbol = result.winner === 'X' ? 'O' : 'X';
    setTimeout(() => {
      cells.forEach((val, i) => {
        if (val === loserSymbol) shatterCell(i);
      });
    }, 350);

    updateStatsOnWin(result.winner);

    const colorClass = result.winner === 'X' ? 'text-arcade-teal' : 'text-arcade-violet';
    if (mode === 'bot') {
      const outcomeKey = result.winner === playerSymbol ? 'player' : 'bot';
      setStatus(pickRandom(WIN_MESSAGES.bot[outcomeKey]), colorClass);
    } else {
      setStatus(pickRandom(WIN_MESSAGES.friend[result.winner]), colorClass);
    }
  }

  function handleDraw() {
    boardLocked = true;
    updateStatsOnDraw();
    setStatus(pickRandom(DRAW_MESSAGES), 'text-arcade-gold');
  }

  function afterMove() {
    const result = checkWinnerPattern(cells);
    if (result) {
      handleWin(result);
      return true;
    }
    if (isBoardFull(cells)) {
      handleDraw();
      return true;
    }
    return false;
  }

  function triggerBotMove(messagePool) {
    boardLocked = true;
    setStatus(pickRandom(messagePool || BOT_THINKING_MESSAGES), 'text-arcade-muted');

    setTimeout(() => {
      const idx = getBotMove(cells);
      cells[idx] = botSymbol;
      renderMark(idx, botSymbol);

      if (afterMove()) return;

      boardLocked = false;
      currentPlayer = playerSymbol;
      setStatus(`GILIRAN KAMU (${playerSymbol})`, 'text-arcade-muted');
    }, 550 + Math.random() * 300);
  }

  function handleCellClick(index) {
    if (boardLocked) return;
    if (cells[index] !== null) return;
    if (mode === 'bot' && currentPlayer !== playerSymbol) return;

    cells[index] = currentPlayer;
    renderMark(index, currentPlayer);

    if (afterMove()) return;

    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';

    if (mode === 'bot' && currentPlayer === botSymbol) {
      triggerBotMove();
    } else {
      setStatus(mode === 'bot' ? `GILIRAN KAMU (${playerSymbol})` : `GILIRAN ${currentPlayer}`, 'text-arcade-muted');
    }
  }

  // ===== Ronde & mode =====
  function newRound() {
    cells = Array(9).fill(null);
    cellEls.forEach((cell, i) => clearCellVisual(cell, i));
    resetWinLine();
    boardLocked = false;
    currentPlayer = 'X'; // X selalu jalan duluan sesuai aturan baku

    if (mode === 'bot') {
      // Simbol pemain di-random tiap ronde — kadang X (jalan duluan), kadang O (bot duluan).
      playerSymbol = Math.random() < 0.5 ? 'X' : 'O';
      botSymbol = playerSymbol === 'X' ? 'O' : 'X';
      updateSymbolIndicator();

      if (currentPlayer === botSymbol) {
        triggerBotMove(BOT_FIRST_MESSAGES);
        return;
      }
      setStatus(`GILIRAN KAMU (${playerSymbol})`, 'text-arcade-muted');
    } else {
      updateSymbolIndicator();
      setStatus(`GILIRAN ${currentPlayer}`, 'text-arcade-muted');
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
      friendStats = { winsX: 0, draws: 0, winsO: 0, rounds: 0 };
    }
    renderStats();
  }

  modeBotBtn.addEventListener('click', () => setMode('bot'));
  modeFriendBtn.addEventListener('click', () => setMode('friend'));
  newRoundBtn.addEventListener('click', newRound);
  resetStatsBtn.addEventListener('click', resetCurrentStats);

  buildBoardCells();
  updateModeButtons();
  renderStats();
  newRound();
})();