
(function () {
  const MIN_DELAY_MS = 1200;
  const MAX_DELAY_MS = 4000;

  const screenEl = document.getElementById('screen');
  const iconEl = document.getElementById('screen-icon');
  const textEl = document.getElementById('screen-text');
  const attemptsEl = document.getElementById('attempts-count');
  const avgEl = document.getElementById('avg-time');
  const bestEl = document.getElementById('best-time');
  const resetBtn = document.getElementById('reset-session');

  let state = 'idle';
  let armedTimeoutId = null;
  let readyStartTime = 0;
  let attempts = 0;
  let totalMs = 0;
  let sessionBestMs = null;

  function clearArmedTimeout() {
    if (armedTimeoutId) {
      clearTimeout(armedTimeoutId);
      armedTimeoutId = null;
    }
  }

  function setScreenState(stateClass, icon, text, textColorClass) {
    screenEl.classList.remove('reaction-state-armed', 'reaction-state-ready', 'flash-pulse');
    if (stateClass) screenEl.classList.add(stateClass);
    iconEl.textContent = icon;
    textEl.textContent = text;
    textEl.className = `font-pixel text-sm sm:text-base ${textColorClass}`;
  }

  function goIdle(message) {
    clearArmedTimeout();
    state = 'idle';
    setScreenState(null, '🎯', message || 'KLIK BUAT MULAI', 'text-arcade-muted');
  }

  function armRound() {
    state = 'armed';
    setScreenState('reaction-state-armed', '⏳', 'TUNGGU WARNA HIJAU...', 'text-arcade-pink');
    const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
    armedTimeoutId = setTimeout(goReady, delay);
  }

  function goReady() {
    armedTimeoutId = null;
    state = 'ready';
    setScreenState('reaction-state-ready', '⚡', 'KLIK SEKARANG!', 'text-arcade-teal');
    readyStartTime = performance.now();
  }

  function falseStart() {
    clearArmedTimeout();
    state = 'toosoon';
    setScreenState('reaction-state-armed', '🙈', 'KECEPETAN! KLIK BUAT COBA LAGI', 'text-arcade-pink');
    screenEl.classList.add('flash-pulse');
    setTimeout(() => screenEl.classList.remove('flash-pulse'), 400);
  }

  function recordResult() {
    const elapsed = Math.round(performance.now() - readyStartTime);
    state = 'result';

    attempts += 1;
    totalMs += elapsed;
    if (sessionBestMs === null || elapsed < sessionBestMs) sessionBestMs = elapsed;

    attemptsEl.textContent = String(attempts);
    avgEl.textContent = `${Math.round(totalMs / attempts)} ms`;
    bestEl.textContent = `${sessionBestMs} ms`;

    let tier;
    let colorClass;
    let icon;
    if (elapsed < 200) {
      tier = 'GILA CEPET!';
      colorClass = 'text-arcade-teal';
      icon = '🔥';
    } else if (elapsed < 300) {
      tier = 'BAGUS!';
      colorClass = 'text-arcade-teal';
      icon = '✨';
    } else if (elapsed < 400) {
      tier = 'LUMAYAN';
      colorClass = 'text-arcade-gold';
      icon = '👍';
    } else {
      tier = 'COBA LAGI';
      colorClass = 'text-arcade-pink';
      icon = '🐢';
    }

    setScreenState(null, icon, `${elapsed} MS — ${tier}`, colorClass);

    if (GameHub.saveHighScoreIfBetter('reaction', elapsed, false)) {
      refreshScoreBadge('reaction');
    }
  }

  function handleScreenClick() {
    if (state === 'idle' || state === 'toosoon' || state === 'result') {
      armRound();
    } else if (state === 'armed') {
      falseStart();
    } else if (state === 'ready') {
      recordResult();
    }
  }

  function resetSession() {
    attempts = 0;
    totalMs = 0;
    sessionBestMs = null;
    attemptsEl.textContent = '0';
    avgEl.textContent = '--';
    bestEl.textContent = '--';
    goIdle();
  }

  screenEl.addEventListener('click', handleScreenClick);
  resetBtn.addEventListener('click', resetSession);

  goIdle();
})();