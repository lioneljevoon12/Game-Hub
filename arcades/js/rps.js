(function () {
  const CHOICES = ['rock', 'scissors', 'paper'];
  const EMOJI = { rock: '✊', scissors: '✌️', paper: '✋' };
  const LABEL = { rock: 'Batu', scissors: 'Gunting', paper: 'Kertas' };
  const BEATS = { rock: 'scissors', scissors: 'paper', paper: 'rock' };

  const SUSPENSE_MS = 900;
  const playerHandEl = document.getElementById('player-hand');
  const cpuHandEl = document.getElementById('cpu-hand');
  const playerScreenEl = document.getElementById('player-screen');
  const cpuScreenEl = document.getElementById('cpu-screen');
  const resultTextEl = document.getElementById('result-text');
  const winCountEl = document.getElementById('win-count');
  const drawCountEl = document.getElementById('draw-count');
  const loseCountEl = document.getElementById('lose-count');
  const streakEl = document.getElementById('streak-count');
  const choiceButtons = document.querySelectorAll('[data-choice]');
  const resetBtn = document.getElementById('reset-session');

  let wins = 0;
  let draws = 0;
  let losses = 0;
  let streak = 0;
  let isPlaying = false;

  function updateScoreboard() {
    winCountEl.textContent = wins;
    drawCountEl.textContent = draws;
    loseCountEl.textContent = losses;
    streakEl.textContent = streak;
  }

  function setResultText(text, colorClass) {
    resultTextEl.textContent = text;
    resultTextEl.className =
      `font-pixel text-center text-xs sm:text-sm mb-8 min-h-[2.5em] flex items-center justify-center px-2 ${colorClass}`;
  }

  function clearRoundVisuals() {
    [playerScreenEl, cpuScreenEl].forEach((el) => {
      el.classList.remove('result-glow-win', 'result-glow-lose', 'result-glow-draw');
    });
    [playerHandEl, cpuHandEl].forEach((el) => {
      el.classList.remove('hand-pump', 'reveal-pop');
    });
  }

  function setButtonsDisabled(disabled) {
    choiceButtons.forEach((btn) => {
      btn.disabled = disabled;
    });
  }

  function play(playerChoice) {
    if (isPlaying) return;
    isPlaying = true;
    setButtonsDisabled(true);
    clearRoundVisuals();

    playerHandEl.textContent = '✊';
    cpuHandEl.textContent = '✊';
    setResultText('BATU... GUNTING... KERTAS...', 'text-arcade-muted');

    void playerHandEl.offsetWidth;
    playerHandEl.classList.add('hand-pump');
    cpuHandEl.classList.add('hand-pump');

    setTimeout(() => {
      const cpuChoice = CHOICES[Math.floor(Math.random() * CHOICES.length)];
      revealResult(playerChoice, cpuChoice);
    }, SUSPENSE_MS);
  }

  function revealResult(playerChoice, cpuChoice) {
    playerHandEl.classList.remove('hand-pump');
    cpuHandEl.classList.remove('hand-pump');

    playerHandEl.textContent = EMOJI[playerChoice];
    cpuHandEl.textContent = EMOJI[cpuChoice];
    playerHandEl.classList.add('reveal-pop');
    cpuHandEl.classList.add('reveal-pop');

    let outcome;
    if (playerChoice === cpuChoice) {
      outcome = 'draw';
    } else if (BEATS[playerChoice] === cpuChoice) {
      outcome = 'win';
    } else {
      outcome = 'lose';
    }

    if (outcome === 'win') {
      wins += 1;
      streak += 1;
      playerScreenEl.classList.add('result-glow-win');
      cpuScreenEl.classList.add('result-glow-lose');
      setResultText(`${LABEL[playerChoice]} ngalahin ${LABEL[cpuChoice]} — KAMU MENANG!`, 'text-arcade-teal');

      if (GameHub.saveHighScoreIfBetter('rps', streak, true)) {
        refreshScoreBadge('rps');
      }
    } else if (outcome === 'lose') {
      losses += 1;
      streak = 0;
      playerScreenEl.classList.add('result-glow-lose');
      cpuScreenEl.classList.add('result-glow-win');
      setResultText(`${LABEL[cpuChoice]} ngalahin ${LABEL[playerChoice]} — CPU MENANG!`, 'text-arcade-pink');
    } else {
      draws += 1;
      playerScreenEl.classList.add('result-glow-draw');
      cpuScreenEl.classList.add('result-glow-draw');
      setResultText(`Sama-sama ${LABEL[playerChoice]} — SERI!`, 'text-arcade-gold');
    }

    updateScoreboard();
    setButtonsDisabled(false);
    isPlaying = false;
  }

  function resetSession() {
    wins = 0;
    draws = 0;
    losses = 0;
    streak = 0;
    isPlaying = false;
    updateScoreboard();
    clearRoundVisuals();
    playerHandEl.textContent = '✊';
    cpuHandEl.textContent = '✊';
    setResultText('Pilih senjatamu buat mulai.', 'text-arcade-muted');
    setButtonsDisabled(false);
  }

  choiceButtons.forEach((btn) => {
    btn.addEventListener('click', () => play(btn.getAttribute('data-choice')));
  });

  resetBtn.addEventListener('click', resetSession);

  updateScoreboard();
})();