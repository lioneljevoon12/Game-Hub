
(function () {
  const MIN_RANGE = 1;
  const MAX_RANGE = 100;

  const attemptsEl = document.getElementById('attempts-count');
  const rangeEl = document.getElementById('range-text');
  const bestEl = document.getElementById('best-attempts');
  const screenEl = document.getElementById('screen');
  const iconEl = document.getElementById('screen-icon');
  const textEl = document.getElementById('screen-text');
  const formEl = document.getElementById('guess-form');
  const inputEl = document.getElementById('guess-input');
  const historyEl = document.getElementById('history-list');
  const resetBtn = document.getElementById('reset-session');

  let secret = 0;
  let attempts = 0;
  let lowerBound = MIN_RANGE;
  let upperBound = MAX_RANGE;
  let guessedNumbers = [];
  let sessionBestAttempts = null;
  let isSolved = false;

  const UP_MESSAGES = {
    hot: [
      'DIKIT LAGI, NAIKIN TIPIS-TIPIS!',
      'UDAH DEKET BANGET, GESER DIKIT KE ATAS.',
      'NANGGUNG, COBA SEDIKIT LEBIH GEDE.',
    ],
    warm: [
      'MASIH KURANG, NAIKIN LAGI.',
      'COBA ANGKA YANG LEBIH BESAR.',
      'BELUM NYAMPE, GESER KE ATAS.',
    ],
    cold: [
      'MASIH JAUH BANGET, NAIKIN GEDE-GEDE.',
      'COBA LONCAT JAUH KE ANGKA LEBIH BESAR.',
      'DINGIN — ANGKANYA JAUH LEBIH TINGGI.',
    ],
  };

  const DOWN_MESSAGES = {
    hot: [
      'DIKIT LAGI, TURUNIN TIPIS-TIPIS!',
      'UDAH DEKET BANGET, GESER DIKIT KE BAWAH.',
      'NANGGUNG, COBA SEDIKIT LEBIH KECIL.',
    ],
    warm: [
      'KEGEDEAN, TURUNIN LAGI.',
      'COBA ANGKA YANG LEBIH KECIL.',
      'KELEWAT, GESER KE BAWAH.',
    ],
    cold: [
      'JAUH KELEWATAN, TURUNIN LEBIH JAUH.',
      'COBA LONCAT JAUH KE ANGKA LEBIH KECIL.',
      'DINGIN — ANGKANYA JAUH LEBIH RENDAH.',
    ],
  };

  function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function closenessTier(diff) {
    if (diff <= 2) return 'hot';
    if (diff <= 10) return 'warm';
    return 'cold';
  }

  function tierIcon(tier, direction) {
    if (tier === 'hot') return '🔥';
    if (tier === 'cold') return '🧊';
    return direction === 'up' ? '📈' : '📉';
  }

  function randomSecret() {
    return Math.floor(Math.random() * (MAX_RANGE - MIN_RANGE + 1)) + MIN_RANGE;
  }

  function setScreen(icon, text, colorClass) {
    iconEl.textContent = icon;
    textEl.textContent = text;
    textEl.className = `font-pixel text-sm sm:text-base ${colorClass}`;
  }

  function updateRangeText() {
    rangeEl.textContent = `${lowerBound} – ${upperBound}`;
  }

  function renderHistory() {
    if (guessedNumbers.length === 0) {
      historyEl.innerHTML = '<span class="font-mono text-[11px] text-arcade-muted/60">Belum ada tebakan.</span>';
      return;
    }

    historyEl.innerHTML = guessedNumbers
      .map((entry) => {
        const iconName = entry.direction === 'up' ? 'arrow-up' : entry.direction === 'down' ? 'arrow-down' : 'check';
        const colorClass =
          entry.direction === 'correct'
            ? 'text-arcade-teal border-arcade-teal/40'
            : 'text-arcade-muted border-white/10';
        return `
          <span class="inline-flex items-center gap-1 rounded-md bg-arcade-alt border ${colorClass} px-2 py-1 font-mono text-xs">
            ${entry.value}
            <i data-lucide="${iconName}" class="w-3 h-3"></i>
          </span>
        `;
      })
      .join('');

    if (window.lucide) lucide.createIcons();
  }

  function setInputDisabled(disabled) {
    inputEl.disabled = disabled;
    formEl.querySelector('button[type="submit"]').disabled = disabled;
  }

  function handleGuess(event) {
    event.preventDefault();
    if (isSolved) return;

    const value = Number(inputEl.value);

    if (!Number.isInteger(value) || value < MIN_RANGE || value > MAX_RANGE) {
      setScreen('⚠️', `MASUKIN ANGKA ${MIN_RANGE}–${MAX_RANGE}`, 'text-arcade-pink');
      return;
    }

    if (guessedNumbers.some((entry) => entry.value === value)) {
      setScreen('🙄', 'ANGKA ITU UDAH DITEBAK', 'text-arcade-gold');
      inputEl.value = '';
      inputEl.focus();
      return;
    }

    attempts += 1;
    attemptsEl.textContent = String(attempts);

    if (value === secret) {
      guessedNumbers.push({ value, direction: 'correct' });
      isSolved = true;
      setScreen('🎉', `BENAR! CUMA ${attempts} PERCOBAAN`, 'text-arcade-teal');
      setInputDisabled(true);

      if (sessionBestAttempts === null || attempts < sessionBestAttempts) {
        sessionBestAttempts = attempts;
        bestEl.textContent = String(sessionBestAttempts);
      }

      if (GameHub.saveHighScoreIfBetter('guess', attempts, false)) {
        refreshScoreBadge('guess');
      }
    } else if (value < secret) {
      guessedNumbers.push({ value, direction: 'up' });
      lowerBound = Math.max(lowerBound, value + 1);
      updateRangeText();
      const tier = closenessTier(secret - value);
      setScreen(tierIcon(tier, 'up'), pickRandom(UP_MESSAGES[tier]), 'text-arcade-gold');
    } else {
      guessedNumbers.push({ value, direction: 'down' });
      upperBound = Math.min(upperBound, value - 1);
      updateRangeText();
      const tier = closenessTier(value - secret);
      setScreen(tierIcon(tier, 'down'), pickRandom(DOWN_MESSAGES[tier]), 'text-arcade-gold');
    }

    renderHistory();
    inputEl.value = '';
    if (!isSolved) inputEl.focus();
  }

  function newGame() {
    secret = randomSecret();
    attempts = 0;
    lowerBound = MIN_RANGE;
    upperBound = MAX_RANGE;
    guessedNumbers = [];
    isSolved = false;

    attemptsEl.textContent = '0';
    updateRangeText();
    renderHistory();
    setScreen('🔢', 'MASUKIN TEBAKANMU', 'text-arcade-muted');
    setInputDisabled(false);
    inputEl.value = '';
    inputEl.focus();
  }

  formEl.addEventListener('submit', handleGuess);
  resetBtn.addEventListener('click', newGame);

  newGame();
})();