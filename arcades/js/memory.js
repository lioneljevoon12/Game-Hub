(function () {
  const SYMBOLS = ['🍒', '🍋', '🔔', '🍇', '💎', '🍀', '⭐', '7️⃣'];

  const boardEl = document.getElementById('board');
  const movesEl = document.getElementById('moves-count');
  const timerEl = document.getElementById('timer');
  const pairsEl = document.getElementById('pairs-count');
  const resultTextEl = document.getElementById('result-text');
  const resetBtn = document.getElementById('reset-session');

  let deck = [];
  let flippedCards = [];
  let matchedCount = 0;
  let moves = 0;
  let locked = false;
  let hasStarted = false;
  let secondsElapsed = 0;
  let timerInterval = null;

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function startTimerIfNeeded() {
    if (hasStarted) return;
    hasStarted = true;
    secondsElapsed = 0;
    timerEl.textContent = formatTime(0);
    timerInterval = setInterval(() => {
      secondsElapsed += 1;
      timerEl.textContent = formatTime(secondsElapsed);
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
  }

  function setResultText(text, colorClass) {
    resultTextEl.textContent = text;
    resultTextEl.className =
      `font-pixel text-center text-xs sm:text-sm mb-6 min-h-[2.5em] flex items-center justify-center px-2 ${colorClass}`;
  }

  function buildDeck() {
    deck = shuffle([...SYMBOLS, ...SYMBOLS]);
  }

  function renderBoard() {
    boardEl.innerHTML = '';
    deck.forEach((symbol, index) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'memory-card aspect-square';
      card.dataset.symbol = symbol;
      card.dataset.index = String(index);
      card.setAttribute('aria-label', 'Kartu tertutup');
      card.innerHTML = `
        <span class="memory-card-inner">
          <span class="memory-card-face memory-card-back text-lg sm:text-xl" aria-hidden="true">❔</span>
          <span class="memory-card-face memory-card-front text-2xl sm:text-3xl" aria-hidden="true">${symbol}</span>
        </span>
      `;
      card.addEventListener('click', () => handleCardClick(card));
      boardEl.appendChild(card);
    });
  }

  function handleCardClick(card) {
    if (locked) return;
    if (card.classList.contains('is-flipped') || card.classList.contains('is-matched')) return;
    if (flippedCards.length === 2) return;

    startTimerIfNeeded();
    card.classList.add('is-flipped');
    card.setAttribute('aria-label', `Kartu ${card.dataset.symbol}`);
    flippedCards.push(card);

    if (flippedCards.length < 2) return;

    moves += 1;
    movesEl.textContent = String(moves);
    locked = true;

    const [first, second] = flippedCards;

    if (first.dataset.symbol === second.dataset.symbol) {
      setTimeout(() => {
        first.classList.add('is-matched');
        second.classList.add('is-matched');
        first.setAttribute('aria-label', `Kartu ${first.dataset.symbol}, cocok`);
        second.setAttribute('aria-label', `Kartu ${second.dataset.symbol}, cocok`);
        matchedCount += 1;
        pairsEl.textContent = `${matchedCount}/${SYMBOLS.length}`;
        flippedCards = [];
        locked = false;

        if (matchedCount === SYMBOLS.length) {
          finishGame();
        }
      }, 400);
    } else {
      setTimeout(() => {
        first.classList.add('mismatch-shake');
        second.classList.add('mismatch-shake');
      }, 600);

      setTimeout(() => {
        first.classList.remove('is-flipped', 'mismatch-shake');
        second.classList.remove('is-flipped', 'mismatch-shake');
        first.setAttribute('aria-label', 'Kartu tertutup');
        second.setAttribute('aria-label', 'Kartu tertutup');
        flippedCards = [];
        locked = false;
      }, 1050);
    }
  }

  function finishGame() {
    stopTimer();
    setResultText(`Selesai dalam ${moves} langkah, ${formatTime(secondsElapsed)}!`, 'text-arcade-teal');
    if (GameHub.saveHighScoreIfBetter('memory', moves, false)) {
      refreshScoreBadge('memory');
    }
  }

  function newGame() {
    stopTimer();
    hasStarted = false;
    secondsElapsed = 0;
    moves = 0;
    matchedCount = 0;
    flippedCards = [];
    locked = false;

    movesEl.textContent = '0';
    timerEl.textContent = '00:00';
    pairsEl.textContent = `0/${SYMBOLS.length}`;
    setResultText('Cari semua pasangannya.', 'text-arcade-muted');

    buildDeck();
    renderBoard();
  }

  resetBtn.addEventListener('click', newGame);

  newGame();
})();