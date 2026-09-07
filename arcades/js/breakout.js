

(function () {
  const BRICK_ROWS = 5;
  const BRICK_COLS = 7;
  const BRICK_GAP = 1.5;
  const BRICK_TOP_MARGIN = 8;
  const BRICK_WIDTH = (100 - BRICK_GAP * (BRICK_COLS + 1)) / BRICK_COLS;
  const BRICK_HEIGHT = 6;

  const PADDLE_WIDTH = 24;
  const PADDLE_HEIGHT = 2.8;
  const PADDLE_Y = 92;
  const PADDLE_SPEED = 90; // persen papan per detik (kontrol keyboard)

  const BALL_RADIUS = 1.8;
  const BASE_BALL_SPEED = 55;
  const WAVE_SPEED_INCREMENT = 6;
  const MAX_BALL_SPEED = 95;
  const MAX_BOUNCE_ANGLE = (60 * Math.PI) / 180;

  const ROW_COLORS = [
    { bg: 'rgba(167, 139, 250, 0.55)', border: 'rgba(167, 139, 250, 0.8)' }, // violet — baris atas
    { bg: 'rgba(255, 111, 156, 0.55)', border: 'rgba(255, 111, 156, 0.8)' }, // pink
    { bg: 'rgba(255, 184, 77, 0.55)', border: 'rgba(255, 184, 77, 0.8)' },  // gold
    { bg: 'rgba(94, 234, 212, 0.55)', border: 'rgba(94, 234, 212, 0.8)' },  // teal
    { bg: 'rgba(167, 139, 250, 0.4)', border: 'rgba(167, 139, 250, 0.65)' }, // violet redup — baris bawah
  ];

  const boardWrapperEl = document.getElementById('board-wrapper');
  const bricksLayerEl = document.getElementById('bricks-layer');
  const paddleEl = document.getElementById('paddle-el');
  const ballEl = document.getElementById('ball-el');
  const scoreValueEl = document.getElementById('score-value');
  const livesValueEl = document.getElementById('lives-value');
  const bricksValueEl = document.getElementById('bricks-value');
  const winOverlayEl = document.getElementById('win-overlay');
  const gameoverOverlayEl = document.getElementById('gameover-overlay');
  const gameoverSummaryEl = document.getElementById('gameover-summary');
  const winContinueBtn = document.getElementById('win-continue-btn');
  const restartLinkBtn = document.getElementById('restart-link-btn');
  const gameoverRestartBtn = document.getElementById('gameover-restart-btn');

  let paddle = { x: 50 - PADDLE_WIDTH / 2 };
  let ball = { x: 50, y: PADDLE_Y - BALL_RADIUS - 0.5, vx: 0, vy: 0, speed: BASE_BALL_SPEED, launched: false };
  let bricks = [];
  let bricksAlive = 0;
  let score = 0;
  let lives = 3;
  let gameOver = true;
  let leftPressed = false;
  let rightPressed = false;
  let lastFrameTime = null;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function renderPaddle() {
    paddleEl.style.left = `${paddle.x}%`;
    paddleEl.style.top = `${PADDLE_Y}%`;
    paddleEl.style.width = `${PADDLE_WIDTH}%`;
    paddleEl.style.height = `${PADDLE_HEIGHT}%`;
  }

  function renderBall() {
    ballEl.style.left = `${ball.x - BALL_RADIUS}%`;
    ballEl.style.top = `${ball.y - BALL_RADIUS}%`;
    ballEl.style.width = `${BALL_RADIUS * 2}%`;
    ballEl.style.height = `${BALL_RADIUS * 2}%`;
  }

  function createBrickElement(brick) {
    const el = document.createElement('div');
    el.className = 'brick';
    el.style.left = `${brick.x}%`;
    el.style.top = `${brick.y}%`;
    el.style.width = `${brick.width}%`;
    el.style.height = `${brick.height}%`;
    el.style.background = ROW_COLORS[brick.colorIndex].bg;
    el.style.borderColor = ROW_COLORS[brick.colorIndex].border;
    return el;
  }

  function createBricks() {
    bricksLayerEl.innerHTML = '';
    bricks = [];

    for (let r = 0; r < BRICK_ROWS; r += 1) {
      for (let c = 0; c < BRICK_COLS; c += 1) {
        const x = BRICK_GAP + c * (BRICK_WIDTH + BRICK_GAP);
        const y = BRICK_TOP_MARGIN + r * (BRICK_HEIGHT + BRICK_GAP);
        const brick = {
          x, y, width: BRICK_WIDTH, height: BRICK_HEIGHT,
          colorIndex: r % ROW_COLORS.length,
          points: (BRICK_ROWS - r) * 10,
          alive: true,
          el: null,
        };
        brick.el = createBrickElement(brick);
        bricksLayerEl.appendChild(brick.el);
        bricks.push(brick);
      }
    }

    bricksAlive = bricks.length;
    bricksValueEl.textContent = String(bricksAlive);
  }

  function shatterBrick(brick) {
    const cx = brick.x + brick.width / 2;
    const cy = brick.y + brick.height / 2;
    const color = ROW_COLORS[brick.colorIndex].bg;

    for (let i = 0; i < 6; i += 1) {
      const shard = document.createElement('span');
      shard.className = 'shatter-piece';
      shard.style.left = `${cx}%`;
      shard.style.top = `${cy}%`;
      const angle = Math.random() * Math.PI * 2;
      const distance = 16 + Math.random() * 20;
      shard.style.setProperty('--tx', `${Math.cos(angle) * distance}px`);
      shard.style.setProperty('--ty', `${Math.sin(angle) * distance}px`);
      shard.style.setProperty('--rot', `${Math.random() * 360}deg`);
      shard.style.background = color;
      shard.style.animationDelay = `${Math.random() * 60}ms`;
      bricksLayerEl.appendChild(shard);
      setTimeout(() => shard.remove(), 700);
    }
  }

  function flashPaddle() {
    paddleEl.classList.remove('reveal-pop');
    void paddleEl.offsetWidth; // force reflow biar animasi restart
    paddleEl.classList.add('reveal-pop');
  }

  function shakeBoard() {
    boardWrapperEl.classList.add('shake-x');
    setTimeout(() => boardWrapperEl.classList.remove('shake-x'), 400);
  }

  function showOverlay(el) {
    el.classList.add('visible');
  }

  function hideOverlay(el) {
    el.classList.remove('visible');
  }

  function destroyBrick(brick) {
    brick.alive = false;
    brick.el.remove();
    shatterBrick(brick);

    score += brick.points;
    scoreValueEl.textContent = String(score);

    bricksAlive -= 1;
    bricksValueEl.textContent = String(bricksAlive);

    if (bricksAlive <= 0) {
      triggerWin();
    }
  }

  function resetBallOnPaddle() {
    ball.launched = false;
    ball.vx = 0;
    ball.vy = 0;
    ball.x = paddle.x + PADDLE_WIDTH / 2;
    ball.y = PADDLE_Y - BALL_RADIUS - 0.5;
  }

  function launchBall() {
    if (gameOver || ball.launched) return;
    const angle = ((Math.random() * 40 - 20) * Math.PI) / 180;
    ball.vx = ball.speed * Math.sin(angle);
    ball.vy = -ball.speed * Math.cos(angle);
    ball.launched = true;
  }

  function handleBallMiss() {
    lives -= 1;
    livesValueEl.textContent = String(lives);
    shakeBoard();

    if (lives <= 0) {
      triggerGameOver();
    } else {
      resetBallOnPaddle();
    }
  }

  function triggerWin() {
    gameOver = true;
    setTimeout(() => showOverlay(winOverlayEl), 300);
  }

  function triggerGameOver() {
    gameOver = true;
    setTimeout(() => {
      gameoverSummaryEl.textContent = `Skor akhir: ${score}`;
      showOverlay(gameoverOverlayEl);
      if (GameHub.saveHighScoreIfBetter('breakout', score, true)) {
        refreshScoreBadge('breakout');
      }
    }, 400);
  }

  function startNextWave() {
    hideOverlay(winOverlayEl);
    ball.speed = Math.min(ball.speed + WAVE_SPEED_INCREMENT, MAX_BALL_SPEED);
    gameOver = false;
    createBricks();
    resetBallOnPaddle();
  }

  function startNewGame() {
    gameOver = false;
    score = 0;
    lives = 3;
    ball.speed = BASE_BALL_SPEED;
    paddle.x = 50 - PADDLE_WIDTH / 2;

    scoreValueEl.textContent = '0';
    livesValueEl.textContent = '3';
    hideOverlay(winOverlayEl);
    hideOverlay(gameoverOverlayEl);

    createBricks();
    resetBallOnPaddle();
    renderPaddle();
    renderBall();
  }

  function updatePaddle(deltaSec) {
    if (leftPressed) paddle.x -= PADDLE_SPEED * deltaSec;
    if (rightPressed) paddle.x += PADDLE_SPEED * deltaSec;
    paddle.x = clamp(paddle.x, 0, 100 - PADDLE_WIDTH);
  }

  function setPaddleCenterX(percentX) {
    paddle.x = clamp(percentX - PADDLE_WIDTH / 2, 0, 100 - PADDLE_WIDTH);
  }

  function updateBall() {
    if (!ball.launched) {
      ball.x = paddle.x + PADDLE_WIDTH / 2;
      ball.y = PADDLE_Y - BALL_RADIUS - 0.5;
      return;
    }

    if (ball.x - BALL_RADIUS <= 0) {
      ball.x = BALL_RADIUS;
      ball.vx = Math.abs(ball.vx);
    } else if (ball.x + BALL_RADIUS >= 100) {
      ball.x = 100 - BALL_RADIUS;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y - BALL_RADIUS <= 0) {
      ball.y = BALL_RADIUS;
      ball.vy = Math.abs(ball.vy);
    }

    if (
      ball.vy > 0 &&
      ball.y + BALL_RADIUS >= PADDLE_Y &&
      ball.y + BALL_RADIUS <= PADDLE_Y + PADDLE_HEIGHT + 3 &&
      ball.x >= paddle.x - BALL_RADIUS &&
      ball.x <= paddle.x + PADDLE_WIDTH + BALL_RADIUS
    ) {
      const paddleCenter = paddle.x + PADDLE_WIDTH / 2;
      const hitPos = clamp((ball.x - paddleCenter) / (PADDLE_WIDTH / 2), -1, 1);
      const angle = hitPos * MAX_BOUNCE_ANGLE;
      ball.vx = ball.speed * Math.sin(angle);
      ball.vy = -Math.abs(ball.speed * Math.cos(angle));
      ball.y = PADDLE_Y - BALL_RADIUS;
      flashPaddle();
    }

    for (let i = 0; i < bricks.length; i += 1) {
      const brick = bricks[i];
      if (!brick.alive) continue;

      const brickCenterX = brick.x + brick.width / 2;
      const brickCenterY = brick.y + brick.height / 2;
      const dx = ball.x - brickCenterX;
      const dy = ball.y - brickCenterY;
      const combinedHalfW = brick.width / 2 + BALL_RADIUS;
      const combinedHalfH = brick.height / 2 + BALL_RADIUS;

      if (Math.abs(dx) <= combinedHalfW && Math.abs(dy) <= combinedHalfH) {
        const overlapX = combinedHalfW - Math.abs(dx);
        const overlapY = combinedHalfH - Math.abs(dy);
        if (overlapX < overlapY) {
          ball.vx *= -1;
        } else {
          ball.vy *= -1;
        }
        destroyBrick(brick);
        break;
      }
    }

    if (ball.y - BALL_RADIUS > 100) {
      handleBallMiss();
    }
  }

  function tick(timestamp) {
    if (lastFrameTime === null) lastFrameTime = timestamp;
    const deltaSec = Math.min((timestamp - lastFrameTime) / 1000, 0.033);
    lastFrameTime = timestamp;

    if (!gameOver) {
      updatePaddle(deltaSec);

      ball.x += ball.launched ? ball.vx * deltaSec : 0;
      ball.y += ball.launched ? ball.vy * deltaSec : 0;
      updateBall();

      renderPaddle();
      renderBall();
    }

    requestAnimationFrame(tick);
  }

  // ===== Kontrol =====
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') leftPressed = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') rightPressed = true;
    if (e.code === 'Space' || e.key === 'Enter') {
      e.preventDefault();
      launchBall();
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') leftPressed = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') rightPressed = false;
  });

  boardWrapperEl.addEventListener('mousemove', (e) => {
    const rect = boardWrapperEl.getBoundingClientRect();
    setPaddleCenterX(((e.clientX - rect.left) / rect.width) * 100);
  });

  boardWrapperEl.addEventListener('touchmove', (e) => {
    const rect = boardWrapperEl.getBoundingClientRect();
    const t = e.touches[0];
    setPaddleCenterX(((t.clientX - rect.left) / rect.width) * 100);
  }, { passive: true });

  boardWrapperEl.addEventListener('click', launchBall);

  winContinueBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    startNextWave();
  });
  restartLinkBtn.addEventListener('click', startNewGame);
  gameoverRestartBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    startNewGame();
  });

  startNewGame();
  requestAnimationFrame(tick);
})();