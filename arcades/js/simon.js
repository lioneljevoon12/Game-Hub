/**
 * simon.js — Simon Says (ingat pola, ulangi urutannya).
 * Butuh GameHub + refreshScoreBadge dari shared.js (di-load sebelum file ini).
 */

(function () {
  const PADS = [
    { id: 'top', color: 'teal', freq: 329.63 },   // E4
    { id: 'right', color: 'gold', freq: 392.0 },  // G4
    { id: 'bottom', color: 'pink', freq: 261.63 }, // C4
    { id: 'left', color: 'violet', freq: 440.0 }, // A4
  ];
  const PAD_BY_ID = Object.fromEntries(PADS.map((p) => [p.id, p]));

  // ===== Kumpulan teks — dipilih random tiap kali dipakai biar gak monoton =====
  const WATCH_MESSAGES = ['MERHATIIN...', 'INGET-INGET...', 'FOKUS...', 'CATET POLANYA...'];
  const YOUR_TURN_MESSAGES = ['GILIRANMU!', 'ULANGIN!', 'SEKARANG KAMU!', 'TIRUIN TADI!'];
  const ROUND_CLEAR_MESSAGES = ['SIP!', 'MANTAP!', 'GASS LANJUT!', 'OKE, LEBIH SUSAH!', 'NICE!'];
  const IDLE_TAGLINES = ['TEKAN MULAI', 'SIAP UJI INGATAN?', 'YUK COBA LAGI'];

  const GAMEOVER_MESSAGES = {
    low: ['BARU PEMANASAN, COBA LAGI!', 'OTAK MASIH LOADING...', 'SANTAI, INI BARU AWAL.'],
    mid: ['LUMAYAN NIH!', 'INGATANMU LAGI ON FIRE.', 'DIKIT LAGI JAGO.'],
    high: ['GILA, TAJEM BANGET!', 'OTAKMU KAYAK SSD.', 'HAMPIR LEGEND STATUS.'],
    legend: ['LEGEND! DI LUAR NALAR.', 'SIMON AJA SALUT.', 'STOP, KEBANYAKAN JAGO.'],
  };

  const stageEl = document.getElementById('stage-count');
  const bestEl = document.getElementById('best-stage');
  const stageIconEl = document.getElementById('stage-icon');
  const stageTextEl = document.getElementById('stage-text');
  const startBtn = document.getElementById('start-btn');
  const soundToggleBtn = document.getElementById('sound-toggle');
  const padEls = Object.fromEntries(PADS.map((p) => [p.id, document.getElementById(`pad-${p.id}`)]));

  let sequence = [];
  let stage = 0; // = sequence.length = stage yang sedang dijalani/diulang
  let playerStep = 0;
  let state = 'idle'; // idle | playback | input | round-clear | gameover
  let sessionBestStage = null;
  let soundEnabled = true;
  let audioCtx = null;

  function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  // ===== Audio (Web Audio API, tanpa file suara eksternal) =====
  function ensureAudio() {
    if (audioCtx) {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }

  function playTone(freq, durationSec) {
    if (!soundEnabled || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const now = audioCtx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  function playBuzz() {
    if (!soundEnabled || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.value = 110;
    const now = audioCtx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  // ===== UI helpers =====
  function setStageDisplay(icon, text, colorClass) {
    stageIconEl.textContent = icon;
    stageTextEl.textContent = text;
    stageTextEl.className = `font-pixel text-[9px] sm:text-[10px] mt-1 text-center px-2 ${colorClass || 'text-arcade-muted'}`;
  }

  function setPadsDisabled(disabled) {
    PADS.forEach((p) => {
      padEls[p.id].disabled = disabled;
    });
  }

  function litPad(padId, durationMs) {
    const el = padEls[padId];
    el.classList.add('lit');
    setTimeout(() => el.classList.remove('lit'), durationMs);
  }

  // Kecepatan playback makin cepat seiring stage makin tinggi (gak statis).
  function getStepIntervalMs() {
    const base = 640;
    const decrement = 16 * stage;
    return Math.max(260, base - decrement);
  }

  function gameoverTier(finalStage) {
    if (finalStage <= 3) return 'low';
    if (finalStage <= 7) return 'mid';
    if (finalStage <= 12) return 'high';
    return 'legend';
  }

  // game flow 
  function addRandomStep() {
    const pad = PADS[Math.floor(Math.random() * PADS.length)];
    sequence.push(pad.id);
    stage = sequence.length;
    stageEl.textContent = String(stage);
  }

  function playbackSequence() {
    state = 'playback';
    setPadsDisabled(true);
    setStageDisplay('👀', pickRandom(WATCH_MESSAGES));

    const interval = getStepIntervalMs();
    let i = 0;

    function step() {
      if (i >= sequence.length) {
        setTimeout(() => {
          state = 'input';
          playerStep = 0;
          setStageDisplay('👉', pickRandom(YOUR_TURN_MESSAGES), 'text-arcade-teal');
          setPadsDisabled(false);
        }, 300);
        return;
      }
      const padId = sequence[i];
      const padInfo = PAD_BY_ID[padId];
      const litDuration = interval * 0.7;
      litPad(padId, litDuration);
      playTone(padInfo.freq, litDuration / 1000);
      i += 1;
      setTimeout(step, interval);
    }

    step();
  }

  function handlePadPress(padId) {
    if (state !== 'input') return;
    ensureAudio();

    const padInfo = PAD_BY_ID[padId];
    litPad(padId, 220);
    playTone(padInfo.freq, 0.22);

    if (padId === sequence[playerStep]) {
      playerStep += 1;

      if (playerStep === sequence.length) {
        state = 'round-clear';
        setPadsDisabled(true);

        if (sessionBestStage === null || stage > sessionBestStage) {
          sessionBestStage = stage;
          bestEl.textContent = String(sessionBestStage);
        }

        setStageDisplay('✨', pickRandom(ROUND_CLEAR_MESSAGES), 'text-arcade-gold');

        setTimeout(() => {
          addRandomStep();
          playbackSequence();
        }, 750);
      }
    } else {
      playBuzz();
      padEls[padId].classList.add('shake-x');
      setTimeout(() => padEls[padId].classList.remove('shake-x'), 400);
      endGame();
    }
  }

  function endGame() {
    state = 'gameover';
    setPadsDisabled(true);

    const finalStage = stage;
    const tier = gameoverTier(finalStage);
    setStageDisplay('💀', pickRandom(GAMEOVER_MESSAGES[tier]), 'text-arcade-pink');

    startBtn.innerHTML = '<i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i> MAIN LAGI';
    if (window.lucide) lucide.createIcons();

    if (GameHub.saveHighScoreIfBetter('simon', finalStage, true)) {
      refreshScoreBadge('simon');
    }
  }

  function startGame() {
    ensureAudio();
    sequence = [];
    stage = 0;
    playerStep = 0;
    stageEl.textContent = '0';

    startBtn.innerHTML = '<i data-lucide="play" class="w-3.5 h-3.5"></i> MAIN LAGI';
    if (window.lucide) lucide.createIcons();

    setStageDisplay('🎮', 'BERSIAP...', 'text-arcade-muted');
    setPadsDisabled(true);

    addRandomStep();
    setTimeout(playbackSequence, 500);
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    soundToggleBtn.setAttribute('aria-pressed', String(soundEnabled));
    soundToggleBtn.innerHTML = soundEnabled
      ? '<i data-lucide="volume-2" class="w-4 h-4"></i>'
      : '<i data-lucide="volume-x" class="w-4 h-4"></i>';
    if (window.lucide) lucide.createIcons();
  }

  PADS.forEach((p) => {
    padEls[p.id].addEventListener('click', () => handlePadPress(p.id));
  });

  startBtn.addEventListener('click', startGame);
  soundToggleBtn.addEventListener('click', toggleSound);

  setStageDisplay('🎮', pickRandom(IDLE_TAGLINES));
})();