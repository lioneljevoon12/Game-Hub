const GameHub = {
  KEY_PREFIX: 'gamehub_highscore_',

  getHighScore(gameId) {
    const raw = localStorage.getItem(this.KEY_PREFIX + gameId);
    return raw === null ? null : Number(raw);
  },

  saveHighScoreIfBetter(gameId, score, higherIsBetter = true) {
    const current = this.getHighScore(gameId);
    const isBetter =
      current === null ||
      (higherIsBetter ? score > current : score < current);

    if (isBetter) {
      localStorage.setItem(this.KEY_PREFIX + gameId, String(score));
    }
    return isBetter;
  },

  setHighScore(gameId, score) {
    localStorage.setItem(this.KEY_PREFIX + gameId, String(score));
  },

  clearHighScore(gameId) {
    localStorage.removeItem(this.KEY_PREFIX + gameId);
  },
};

function refreshScoreBadge(gameId) {
  const el = document.querySelector(`[data-score="${gameId}"]`);
  if (!el) return;
  const score = GameHub.getHighScore(gameId);
  el.textContent = score === null ? 'HI: --' : `HI: ${score}`;
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();

  document.querySelectorAll('[data-score]').forEach((el) => {
    refreshScoreBadge(el.getAttribute('data-score'));
  });

  const overlay = document.getElementById('score-modal-overlay');
  const titleEl = document.getElementById('score-modal-title');
  const inputEl = document.getElementById('score-modal-input');
  const formEl = document.getElementById('score-modal-form');
  const closeBtn = document.getElementById('score-modal-close');
  const resetBtn = document.getElementById('score-modal-reset');

  let activeGameId = null;

  function openModal(gameId, gameName) {
    activeGameId = gameId;
    titleEl.textContent = `Set skor — ${gameName}`;
    const current = GameHub.getHighScore(gameId);
    inputEl.value = current === null ? '' : current;
    overlay.classList.remove('hidden');
    inputEl.focus();
  }

  function closeModal() {
    overlay.classList.add('hidden');
    activeGameId = null;
  }

  document.querySelectorAll('[data-edit-score]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openModal(btn.getAttribute('data-edit-score'), btn.getAttribute('data-game-name'));
    });
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!activeGameId) return;
    const value = Number(inputEl.value);
    if (Number.isNaN(value)) return;
    GameHub.setHighScore(activeGameId, value);
    refreshScoreBadge(activeGameId);
    closeModal();
  });

  resetBtn.addEventListener('click', () => {
    if (!activeGameId) return;
    GameHub.clearHighScore(activeGameId);
    refreshScoreBadge(activeGameId);
    closeModal();
  });

  closeBtn.addEventListener('click', closeModal);

  // Klik area
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  // Tombol Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeModal();
  });
});