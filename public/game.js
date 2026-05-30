/* ============================================
   GAME NỐI TỪ VIỆT - CLIENT LOGIC & SOCKETS
   ============================================ */

// ─── STATE MANAGEMENT ────────────────────────
const state = {
  roomCode: null,
  myPlayer: null, // { id, username, avatar, isHost, ... }
  players: [],
  currentPlayer: null, // { id, username }
  currentWord: null,
  nextSyllable: null,
  isMyTurn: false,
};

const TURN_TIME = 60; // Server turn time in seconds (1 minute)

// Connect to socket server
const socket = io();

// ─── DOM ELEMENTS ────────────────────────────
const pages = {
  'page-home': document.getElementById('page-home'),
  'page-lobby': document.getElementById('page-lobby'),
  'page-game': document.getElementById('page-game'),
  'page-gameover': document.getElementById('page-gameover')
};

// Home Controls
const usernameInput = document.getElementById('input-username');
const roomCodeInput = document.getElementById('input-room-code');
const createRoomBtn = document.getElementById('btn-create-room');
const joinRoomBtn = document.getElementById('btn-join-room');
const homeError = document.getElementById('home-error');
const dictCountSpan = document.getElementById('dict-count');

// Lobby Controls
const backLobbyBtn = document.getElementById('btn-back-lobby');
const lobbyCodeSpan = document.getElementById('lobby-code');
const copyCodeBtn = document.getElementById('btn-copy-code');
const lobbyPlayersDiv = document.getElementById('lobby-players');
const lobbyHostActionsDiv = document.getElementById('lobby-host-actions');
const startGameBtn = document.getElementById('btn-start-game');
const lobbyWaitingTextDiv = document.getElementById('lobby-waiting-text');
const shareLinkDiv = document.getElementById('share-link');
const copyLinkBtn = document.getElementById('btn-copy-link');
const lobbyChatMessages = document.getElementById('lobby-chat-messages');
const lobbyChatInput = document.getElementById('lobby-chat-input');
const lobbyBtnSend = document.getElementById('lobby-btn-send');

// Game Controls
const gamePlayersListDiv = document.getElementById('game-players-list');
const currentPlayerNameSpan = document.getElementById('current-player-name');
const timerCircle = document.getElementById('timer-circle');
const timerTextDiv = document.getElementById('timer-text');
const currentWordDiv = document.getElementById('current-word');
const nextSyllableSpan = document.getElementById('next-syllable');
const wordInput = document.getElementById('word-input');
const submitWordBtn = document.getElementById('btn-submit-word');
const wordErrorDiv = document.getElementById('word-error');
const wordHistoryDiv = document.getElementById('word-history');
const gameChatMessages = document.getElementById('game-chat-messages');
const gameChatInput = document.getElementById('game-chat-input');
const gameBtnSend = document.getElementById('game-btn-send');

// GameOver Controls
const winnerAvatarDiv = document.getElementById('winner-avatar');
const winnerNameDiv = document.getElementById('winner-name');
const winnerScoreDiv = document.getElementById('winner-score');
const leaderboardDiv = document.getElementById('leaderboard');
const playAgainBtn = document.getElementById('btn-play-again');
const homeBtn = document.getElementById('btn-home');

// Toast
const toastDiv = document.getElementById('toast');

// ─── AUDIO SYNTHESIS (WEB AUDIO API) ──────────
const Sound = {
  ctx: null,
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  },
  playSuccess() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.type = 'sine';
    const now = this.ctx.currentTime;
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
    osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
    
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    
    osc.start(now);
    osc.stop(now + 0.3);
  },
  playError() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.type = 'sawtooth';
    const now = this.ctx.currentTime;
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.linearRampToValueAtTime(80, now + 0.22);
    
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    
    osc.start(now);
    osc.stop(now + 0.22);
  },
  playTick() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.type = 'sine';
    const now = this.ctx.currentTime;
    osc.frequency.setValueAtTime(880, now); // A5 tick
    
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    
    osc.start(now);
    osc.stop(now + 0.05);
  },
  playWin() {
    this.init();
    if (!this.ctx) return;
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // Arpeggio C
    const now = this.ctx.currentTime;
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.06, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.35);
    });
  }
};

// ─── HELPER FUNCTIONS ─────────────────────────
function showPage(pageId) {
  Object.keys(pages).forEach(key => {
    if (key === pageId) {
      pages[key].classList.add('active');
    } else {
      pages[key].classList.remove('active');
    }
  });
}

let toastTimeout;
function showToast(message, type = 'info', duration = 3000) {
  toastDiv.innerText = message;
  toastDiv.className = `toast show ${type}`;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastDiv.classList.remove('show');
  }, duration);
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

function updateShareLink(roomCode) {
  const shareUrl = `${window.location.origin}/#${roomCode}`;
  shareLinkDiv.innerText = shareUrl;
}

// ─── AVATAR SELECTION ──────────────────────────
let selectedAvatar = '🐉';
const avatarItems = document.querySelectorAll('.avatar-item');
avatarItems.forEach(item => {
  item.addEventListener('click', () => {
    Sound.init(); // Initialize audio context on first interaction
    avatarItems.forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    selectedAvatar = item.dataset.emoji;
  });
});

// ─── CHAT FUNCTIONS ───────────────────────────
function addChatMessage(container, username, message, isSystem = false) {
  const msgDiv = document.createElement('div');
  if (isSystem) {
    msgDiv.className = 'chat-msg is-system';
    msgDiv.innerHTML = `<span class="msg-text">${escapeHTML(message)}</span>`;
  } else {
    msgDiv.className = 'chat-msg';
    msgDiv.innerHTML = `
      <span class="msg-user">${escapeHTML(username)}:</span>
      <span class="msg-text">${escapeHTML(message)}</span>
    `;
  }
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}

// ─── RENDER FUNCTIONS ─────────────────────────
function renderLobbyPlayers(players) {
  lobbyPlayersDiv.innerHTML = '';
  players.forEach(p => {
    const card = document.createElement('div');
    card.className = `player-card${p.isHost ? ' is-host' : ''}`;
    card.innerHTML = `
      <span class="player-avatar">${p.avatar}</span>
      <div class="player-name">${escapeHTML(p.username)}</div>
      ${p.isHost ? '<span class="player-host-tag">CHỦ PHÒNG</span>' : ''}
    `;
    lobbyPlayersDiv.appendChild(card);
  });
}

function renderGamePlayers(players, currentPlayerId) {
  gamePlayersListDiv.innerHTML = '';
  players.forEach(p => {
    const isCurrent = p.id === currentPlayerId;
    const item = document.createElement('div');
    item.className = `game-player-item${isCurrent ? ' is-current' : ''}${p.isEliminated ? ' is-eliminated' : ''}`;
    
    const hearts = '❤️'.repeat(p.lives) + '🖤'.repeat(Math.max(0, 3 - p.lives));
    
    item.innerHTML = `
      <div class="gp-avatar">${p.avatar}</div>
      <div class="gp-info">
        <div class="gp-name">${escapeHTML(p.username)}</div>
        <div class="gp-lives">${hearts}</div>
      </div>
      <div class="gp-score">${p.score} từ</div>
    `;
    gamePlayersListDiv.appendChild(item);
  });
}

function renderWordHistory(history) {
  wordHistoryDiv.innerHTML = '';
  history.forEach((h, idx) => {
    const isLatest = idx === history.length - 1;
    const item = document.createElement('div');
    item.className = `history-word${isLatest ? ' hw-latest' : ''}`;
    item.innerHTML = `
      <span class="hw-word">${escapeHTML(h.word)}</span>
      <span class="hw-player">(${escapeHTML(h.player)})</span>
    `;
    wordHistoryDiv.appendChild(item);
  });
  wordHistoryDiv.scrollTop = wordHistoryDiv.scrollHeight;
}

function renderGame(currentWord, currentPlayer, players, nextSyllable, hints = []) {
  renderGamePlayers(players, currentPlayer.id);
  
  const isMe = currentPlayer.id === socket.id;
  currentPlayerNameSpan.innerText = isMe ? 'Bạn' : currentPlayer.username;
  
  const badge = document.getElementById('current-player-badge');
  badge.className = `current-player-badge${isMe ? ' my-turn' : ''}`;
  
  currentWordDiv.innerText = currentWord;
  nextSyllableSpan.innerText = nextSyllable;
  
  // Set up input state
  if (isMe) {
    wordInput.disabled = false;
    wordInput.placeholder = `Nối tiếp với âm "${nextSyllable}"...`;
    wordInput.focus();
    submitWordBtn.disabled = false;
  } else {
    wordInput.disabled = true;
    wordInput.placeholder = `Chờ ${currentPlayer.username} trả lời...`;
    submitWordBtn.disabled = true;
  }
  

  
  wordErrorDiv.classList.add('hidden');
  wordErrorDiv.innerText = '';
}

function updateTimerUI(timeLeft) {
  timerTextDiv.innerText = timeLeft;
  
  // Circle progress calculation (circumference = 213.63)
  const circumference = 213.63;
  const pct = Math.max(0, Math.min(TURN_TIME, timeLeft)) / TURN_TIME;
  const offset = circumference - (pct * circumference);
  
  timerCircle.style.strokeDashoffset = offset;
  
  timerCircle.classList.remove('warning', 'danger');
  timerTextDiv.classList.remove('warning', 'danger');
  
  if (timeLeft <= 10) {
    timerCircle.classList.add('danger');
    timerTextDiv.classList.add('danger');
  } else if (timeLeft <= 20) {
    timerCircle.classList.add('warning');
    timerTextDiv.classList.add('warning');
  }
}

// ─── FIREWORKS PARTICLE EFFECTS ────────────────
let fireworksInterval = null;
function startFireworks() {
  stopFireworks();
  spawnFirework();
  fireworksInterval = setInterval(spawnFirework, 500);
}

function stopFireworks() {
  if (fireworksInterval) {
    clearInterval(fireworksInterval);
    fireworksInterval = null;
  }
  const container = document.getElementById('fireworks');
  if (container) container.innerHTML = '';
}

function spawnFirework() {
  const container = document.getElementById('fireworks');
  if (!container) return;
  
  const rect = container.getBoundingClientRect();
  const x = Math.random() * (rect.width || window.innerWidth);
  const y = Math.random() * (rect.height * 0.6 || window.innerHeight * 0.6) + 50; // spawn in upper part
  
  const colors = ['#00f5c4', '#7c3aed', '#f43f5e', '#f59e0b', '#0ea5e9'];
  const particleCount = 32;
  
  for (let i = 0; i < particleCount; i++) {
    const spark = document.createElement('div');
    spark.className = 'spark';
    spark.style.left = `${x}px`;
    spark.style.top = `${y}px`;
    spark.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    
    // Generate radial explosion trajectory
    const angle = (i / particleCount) * 2 * Math.PI + (Math.random() * 0.2 - 0.1);
    const distance = 60 + Math.random() * 120;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance;
    
    spark.style.setProperty('--tx', `${tx}px`);
    spark.style.setProperty('--ty', `${ty}px`);
    
    container.appendChild(spark);
    
    // Auto-remove particles after animation completes
    setTimeout(() => spark.remove(), 1200);
  }
}

// ─── ACTION LISTENERS ─────────────────────────
createRoomBtn.addEventListener('click', () => {
  Sound.init();
  const username = usernameInput.value.trim();
  if (!username) {
    homeError.innerText = '⚠️ Bạn phải nhập tên hiển thị!';
    homeError.classList.remove('hidden');
    Sound.playError();
    return;
  }
  homeError.classList.add('hidden');
  socket.emit('createRoom', { username, avatar: selectedAvatar });
});

joinRoomBtn.addEventListener('click', () => {
  Sound.init();
  const username = usernameInput.value.trim();
  const roomCode = roomCodeInput.value.trim();
  if (!username) {
    homeError.innerText = '⚠️ Bạn phải nhập tên hiển thị!';
    homeError.classList.remove('hidden');
    Sound.playError();
    return;
  }
  if (!roomCode) {
    homeError.innerText = '⚠️ Vui lòng nhập mã phòng!';
    homeError.classList.remove('hidden');
    Sound.playError();
    return;
  }
  homeError.classList.add('hidden');
  socket.emit('joinRoom', { username, avatar: selectedAvatar, roomCode });
});

backLobbyBtn.addEventListener('click', () => {
  window.location.hash = '';
  window.location.reload();
});

copyCodeBtn.addEventListener('click', () => {
  if (!state.roomCode) return;
  navigator.clipboard.writeText(state.roomCode)
    .then(() => showToast('📋 Đã sao chép mã phòng!', 'success'))
    .catch(() => showToast('❌ Lỗi sao chép!', 'error'));
});

copyLinkBtn.addEventListener('click', () => {
  if (!state.roomCode) return;
  const shareUrl = `${window.location.origin}/#${state.roomCode}?avatar=${encodeURIComponent(selectedAvatar)}`;
  navigator.clipboard.writeText(shareUrl)
    .then(() => showToast('📋 Đã sao chép liên kết mời!', 'success'))
    .catch(() => showToast('❌ Lỗi sao chép!', 'error'));
});

startGameBtn.addEventListener('click', () => {
  socket.emit('startGame');
});

// Chat handlers
function sendLobbyChat() {
  const msg = lobbyChatInput.value.trim();
  if (!msg) return;
  socket.emit('chatMessage', { message: msg });
  lobbyChatInput.value = '';
}
lobbyBtnSend.addEventListener('click', sendLobbyChat);
lobbyChatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendLobbyChat();
});

function sendGameChat() {
  const msg = gameChatInput.value.trim();
  if (!msg) return;
  socket.emit('chatMessage', { message: msg });
  gameChatInput.value = '';
}
gameBtnSend.addEventListener('click', sendGameChat);
gameChatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendGameChat();
});

// Word input handlers
function performWordSubmit() {
  const word = wordInput.value.trim();
  if (!word) return;
  socket.emit('submitWord', { word });
}
submitWordBtn.addEventListener('click', performWordSubmit);
wordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') performWordSubmit();
});
wordInput.addEventListener('input', () => {
  wordErrorDiv.classList.add('hidden'); // Clear error message when user starts typing again
});

// Gameover handlers
playAgainBtn.addEventListener('click', () => {
  socket.emit('restartGame');
});

homeBtn.addEventListener('click', () => {
  window.location.hash = '';
  window.location.reload();
});

// ─── SOCKET LISTENERS ─────────────────────────
socket.on('roomCreated', ({ code, player, room }) => {
  state.roomCode = code;
  state.myPlayer = player;
  state.players = room.players;
  
  lobbyCodeSpan.innerText = code;
  updateShareLink(code);
  renderLobbyPlayers(room.players);
  
  lobbyHostActionsDiv.classList.remove('hidden');
  lobbyWaitingTextDiv.classList.add('hidden');
  
  showPage('page-lobby');
  showToast('🎉 Đã tạo phòng chơi mới!', 'success');
  window.location.hash = code;
});

socket.on('roomJoined', ({ code, player, room }) => {
  state.roomCode = code;
  state.myPlayer = player;
  state.players = room.players;
  
  lobbyCodeSpan.innerText = code;
  updateShareLink(code);
  renderLobbyPlayers(room.players);
  
  lobbyHostActionsDiv.classList.add('hidden');
  lobbyWaitingTextDiv.classList.remove('hidden');
  
  showPage('page-lobby');
  showToast('🚀 Vào phòng chơi thành công!', 'success');
  window.location.hash = code;
});

socket.on('joinError', ({ message }) => {
  showToast(message, 'error');
  homeError.innerText = message;
  homeError.classList.remove('hidden');
});

socket.on('playerJoined', ({ username, avatar, room }) => {
  state.players = room.players;
  renderLobbyPlayers(room.players);
  addChatMessage(lobbyChatMessages, null, `👋 ${username} đã tham gia phòng.`, true);
  showToast(`${avatar} ${username} đã vào phòng.`, 'info');
  Sound.playSuccess();
});

socket.on('playerLeft', ({ username, room }) => {
  state.players = room.players;
  
  // If my role has updated (e.g. now I am the host)
  const me = room.players.find(p => p.id === socket.id);
  if (me) {
    state.myPlayer = me;
    if (me.isHost) {
      lobbyHostActionsDiv.classList.remove('hidden');
      lobbyWaitingTextDiv.classList.add('hidden');
    }
  }
  
  if (room.gameStarted) {
    renderGamePlayers(room.players, state.currentPlayer?.id);
    addChatMessage(gameChatMessages, null, `💨 ${username} đã rời phòng.`, true);
  } else {
    renderLobbyPlayers(room.players);
    addChatMessage(lobbyChatMessages, null, `💨 ${username} đã rời phòng.`, true);
  }
  
  showToast(`${username} đã rời phòng.`, 'info');
});

socket.on('chatMessage', ({ username, message }) => {
  addChatMessage(lobbyChatMessages, username, message);
  addChatMessage(gameChatMessages, username, message);
});

socket.on('gameStarted', ({ currentWord, currentPlayer, players, nextSyllable }) => {
  state.players = players;
  state.currentPlayer = currentPlayer;
  state.currentWord = currentWord;
  state.nextSyllable = nextSyllable;
  state.isMyTurn = currentPlayer.id === socket.id;
  
  lobbyChatMessages.innerHTML = '';
  gameChatMessages.innerHTML = '';
  
  renderGame(currentWord, currentPlayer, players, nextSyllable);
  showPage('page-game');
  showToast('🎮 Trò chơi bắt đầu!', 'success');
  Sound.playSuccess();
});

socket.on('timerStart', ({ timeLeft }) => {
  updateTimerUI(timeLeft);
});

socket.on('timerTick', ({ timeLeft }) => {
  updateTimerUI(timeLeft);
  if (timeLeft <= 10) {
    Sound.playTick(); // Play countdown warnings
  }
});

socket.on('timeout', ({ playerId, username, livesLeft, players }) => {
  state.players = players;
  const isMe = playerId === socket.id;
  const msg = isMe ? 'Bạn đã hết thời gian! Mất 1 mạng.' : `${username} đã hết thời gian! Mất 1 mạng.`;
  
  showToast(msg, 'error');
  addChatMessage(gameChatMessages, null, `⏰ ${msg} (còn ${livesLeft} ❤️)`, true);
  Sound.playError();
  
  renderGamePlayers(players, state.currentPlayer?.id);
});

socket.on('playerEliminated', ({ username, playerId }) => {
  const isMe = playerId === socket.id;
  const msg = isMe ? '💀 Bạn đã bị loại khỏi trò chơi!' : `💀 ${username} đã bị loại!`;
  
  showToast(msg, 'error');
  addChatMessage(gameChatMessages, null, msg, true);
  Sound.playError();
});

socket.on('nextTurn', ({ currentPlayer, currentWord, nextSyllable, hints }) => {
  state.currentPlayer = currentPlayer;
  state.currentWord = currentWord;
  state.nextSyllable = nextSyllable;
  state.isMyTurn = currentPlayer.id === socket.id;
  
  renderGame(currentWord, currentPlayer, state.players, nextSyllable, hints);
});

socket.on('wordAccepted', ({ word, player, score, players, wordHistory }) => {
  state.players = players;
  
  if (player.id === socket.id) {
    Sound.playSuccess();
    wordInput.value = '';
  }
  
  renderWordHistory(wordHistory);
  renderGamePlayers(players, state.currentPlayer?.id);
});

socket.on('wordError', ({ message }) => {
  wordErrorDiv.innerText = message;
  wordErrorDiv.classList.remove('hidden');
  
  // Retrigger shake CSS animation
  wordErrorDiv.style.animation = 'none';
  wordErrorDiv.offsetHeight; /* Trigger reflow */
  wordErrorDiv.style.animation = null;
  
  Sound.playError();
});

socket.on('gameOver', ({ winner, leaderboard }) => {
  stopFireworks();
  
  if (winner) {
    winnerAvatarDiv.innerText = winner.avatar;
    winnerNameDiv.innerText = winner.username;
    winnerScoreDiv.innerText = `Đạt tổng cộng ${winner.score} từ`;
    
    if (winner.id === socket.id) {
      showToast('🏆 Bạn đã giành chiến thắng chung cuộc!', 'success');
    } else {
      showToast(`👑 ${winner.username} đã thắng cuộc!`, 'info');
    }
    
    Sound.playWin();
    startFireworks();
  } else {
    winnerAvatarDiv.innerText = '🤖';
    winnerNameDiv.innerText = 'Không có ai!';
    winnerScoreDiv.innerText = 'Tất cả mọi người đều đã thất bại.';
  }
  
  // Render leaderboard
  leaderboardDiv.innerHTML = '';
  leaderboard.forEach((p, idx) => {
    const rank = idx + 1;
    let rankClass = '';
    if (rank === 1) rankClass = ' gold';
    else if (rank === 2) rankClass = ' silver';
    else if (rank === 3) rankClass = ' bronze';
    
    const lbItem = document.createElement('div');
    lbItem.className = 'lb-item';
    lbItem.innerHTML = `
      <div class="lb-rank${rankClass}">${rank}</div>
      <div class="lb-avatar">${p.avatar}</div>
      <div class="lb-name">${escapeHTML(p.username)}</div>
      <div class="lb-score">${p.score} từ</div>
    `;
    leaderboardDiv.appendChild(lbItem);
  });
  
  // Show Play Again only to the Host
  if (state.myPlayer && state.myPlayer.isHost) {
    playAgainBtn.classList.remove('hidden');
  } else {
    playAgainBtn.classList.add('hidden');
  }
  
  showPage('page-gameover');
});

socket.on('gameReset', ({ room }) => {
  state.players = room.players;
  stopFireworks();
  
  lobbyCodeSpan.innerText = room.code;
  updateShareLink(room.code);
  renderLobbyPlayers(room.players);
  
  const me = room.players.find(p => p.id === socket.id);
  if (me) {
    state.myPlayer = me;
    if (me.isHost) {
      lobbyHostActionsDiv.classList.remove('hidden');
      lobbyWaitingTextDiv.classList.add('hidden');
    } else {
      lobbyHostActionsDiv.classList.add('hidden');
      lobbyWaitingTextDiv.classList.remove('hidden');
    }
  }
  
  lobbyChatMessages.innerHTML = '';
  gameChatMessages.innerHTML = '';
  
  showPage('page-lobby');
  showToast('🎮 Chủ phòng đã thiết lập lại game!', 'info');
});

socket.on('error', ({ message }) => {
  showToast(message, 'error');
});

// Load size of dictionary dynamically
fetch('/api/dictionary-size')
  .then(res => res.json())
  .then(data => {
    if (data && data.size) {
      dictCountSpan.innerText = `${data.size.toLocaleString()}`;
    }
  })
  .catch(err => console.error('Failed to load dictionary size:', err));

// Auto prefill room code if hash is present
window.addEventListener('DOMContentLoaded', () => {
  const hash = window.location.hash;
  if (hash) {
    // Parse room code and avatar from URL
    // Format: #ROOMCODE?avatar=emoji
    const hashParts = hash.substring(1).split('?');
    const code = hashParts[0].toUpperCase();
    
    if (code && code.length === 6) {
      roomCodeInput.value = code;
      showToast(`📍 Đã nhận mã phòng từ liên kết: ${code}`, 'info');
      
      // Auto-select avatar if provided in URL
      if (hashParts[1]) {
        const params = new URLSearchParams(hashParts[1]);
        const avatarFromUrl = decodeURIComponent(params.get('avatar'));
        
        if (avatarFromUrl) {
          selectedAvatar = avatarFromUrl;
          // Update UI to show selected avatar
          avatarItems.forEach(item => {
            if (item.dataset.emoji === avatarFromUrl) {
              item.classList.add('active');
            } else {
              item.classList.remove('active');
            }
          });
          showToast(`🎭 Avatar tự động chọn: ${avatarFromUrl}`, 'info');
        }
      }
    }
  }
});


