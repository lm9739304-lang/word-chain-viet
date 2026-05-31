const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Load dictionary
const {
  isValidWord,
  getLastSyllable,
  getFirstSyllable,
  getWordsStartingWith,
  getRandomWord,
  canContinueFrom,
  getRandomValidWord
} = require('./public/dictionary.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(express.static(path.join(__dirname, 'public')));

// Serve dictionary to client
app.get('/api/dictionary-size', (req, res) => {
  res.json({ size: require('./public/dictionary.js').DICTIONARY.size });
});

const rooms = new Map();
const TURN_TIME = 60; // giây mỗi lượt (1 phút)
const MAX_LIVES = 1;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function getRoomPublicData(room) {
  return {
    code: room.code,
    players: room.players.map(p => ({
      id: p.id,
      username: p.username,
      lives: p.lives,
      score: p.score,
      isHost: p.isHost,
      avatar: p.avatar,
      isEliminated: p.isEliminated
    })),
    gameStarted: room.gameStarted,
    currentWord: room.currentWord,
    currentPlayerIndex: room.currentPlayerIndex,
    wordHistory: room.wordHistory.slice(-10),
    status: room.status
  };
}

function startTurnTimer(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  clearTurnTimer(roomCode);
  room.timeLeft = TURN_TIME;

  io.to(roomCode).emit('timerStart', { timeLeft: TURN_TIME });

  room.timerInterval = setInterval(() => {
    if (!rooms.has(roomCode)) {
      clearInterval(room.timerInterval);
      return;
    }
    room.timeLeft--;
    io.to(roomCode).emit('timerTick', { timeLeft: room.timeLeft });

    if (room.timeLeft <= 0) {
      clearTurnTimer(roomCode);
      handleTimeout(roomCode);
    }
  }, 1000);
}

function clearTurnTimer(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }
}

function handleTimeout(roomCode) {
  const room = rooms.get(roomCode);
  if (!room || !room.gameStarted) return;

  const activePlayers = room.players.filter(p => !p.isEliminated);
  if (activePlayers.length === 0) return;

  const currentPlayer = activePlayers[room.currentPlayerIndex % activePlayers.length];
  currentPlayer.lives--;

  io.to(roomCode).emit('timeout', {
    playerId: currentPlayer.id,
    username: currentPlayer.username,
    livesLeft: currentPlayer.lives,
    players: getRoomPublicData(room).players
  });

  if (currentPlayer.lives <= 0) {
    currentPlayer.isEliminated = true;
    io.to(roomCode).emit('playerEliminated', {
      username: currentPlayer.username,
      playerId: currentPlayer.id
    });
  }

  const remaining = room.players.filter(p => !p.isEliminated);
  if (remaining.length <= 1) {
    endGame(roomCode);
    return;
  }

  nextTurn(roomCode);
}

function nextTurn(roomCode) {
  const room = rooms.get(roomCode);
  if (!room || !room.gameStarted) return;

  const active = room.players.filter(p => !p.isEliminated);
  if (active.length === 0) return;

  // Find next active player
  let attempts = 0;
  do {
    room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
    attempts++;
  } while (room.players[room.currentPlayerIndex].isEliminated && attempts < room.players.length);

  const currentPlayer = room.players[room.currentPlayerIndex];
  const nextSyllable = getLastSyllable(room.currentWord);

  io.to(roomCode).emit('nextTurn', {
    currentPlayer: { id: currentPlayer.id, username: currentPlayer.username },
    currentWord: room.currentWord,
    nextSyllable,
    hints: getWordsStartingWith(nextSyllable).slice(0, 3)
  });

  startTurnTimer(roomCode);
}

function endGame(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  clearTurnTimer(roomCode);
  room.gameStarted = false;
  room.status = 'finished';

  const winner = room.players.filter(p => !p.isEliminated)[0] || null;
  const sorted = [...room.players].sort((a, b) => b.score - a.score);

  io.to(roomCode).emit('gameOver', {
    winner,
    leaderboard: sorted,
    wordHistory: room.wordHistory
  });
}

io.on('connection', (socket) => {
  console.log('📡 Kết nối:', socket.id);

  // Tạo phòng
  socket.on('createRoom', ({ username, avatar }) => {
    const code = generateRoomCode();
    const player = {
      id: socket.id,
      username: username || 'Người chơi',
      avatar: avatar || '🐉',
      lives: MAX_LIVES,
      score: 0,
      isHost: true,
      isEliminated: false
    };

    const room = {
      code,
      players: [player],
      currentPlayerIndex: 0,
      currentWord: null,
      usedWords: new Set(),
      wordHistory: [],
      timerInterval: null,
      timeLeft: TURN_TIME,
      gameStarted: false,
      status: 'waiting'
    };

    rooms.set(code, room);
    socket.join(code);
    socket.roomCode = code;
    socket.username = username;

    socket.emit('roomCreated', { code, player, room: getRoomPublicData(room) });
    console.log(`🏠 Tạo phòng: ${code} bởi ${username}`);
  });

  // Vào phòng
  socket.on('joinRoom', ({ username, avatar, roomCode }) => {
    const code = roomCode?.toUpperCase().trim();
    const room = rooms.get(code);

    if (!room) {
      socket.emit('joinError', { message: '❌ Phòng không tồn tại!' });
      return;
    }
    if (room.gameStarted) {
      socket.emit('joinError', { message: '⏳ Trò chơi đã bắt đầu, vui lòng chờ!' });
      return;
    }
    if (room.players.length >= MAX_PLAYERS) {
      socket.emit('joinError', { message: '🚫 Phòng đã đủ người!' });
      return;
    }

    const player = {
      id: socket.id,
      username: username || 'Người chơi',
      avatar: avatar || '🌟',
      lives: MAX_LIVES,
      score: 0,
      isHost: false,
      isEliminated: false
    };

    room.players.push(player);
    socket.join(code);
    socket.roomCode = code;
    socket.username = username;

    socket.emit('roomJoined', { code, player, room: getRoomPublicData(room) });
    io.to(code).emit('playerJoined', { username: player.username, avatar: player.avatar, room: getRoomPublicData(room) });
    console.log(`🚪 ${username} vào phòng ${code}`);
  });

  // Bắt đầu game
  socket.on('startGame', () => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player?.isHost) {
      socket.emit('error', { message: 'Chỉ chủ phòng mới có thể bắt đầu!' });
      return;
    }
    if (room.players.length < MIN_PLAYERS) {
      socket.emit('error', { message: `Cần ít nhất ${MIN_PLAYERS} người chơi!` });
      return;
    }

    // Reset state
    room.players.forEach(p => {
      p.lives = MAX_LIVES;
      p.score = 0;
      p.isEliminated = false;
    });
    room.usedWords = new Set();
    room.wordHistory = [];
    room.currentPlayerIndex = 0;
    room.gameStarted = true;
    room.status = 'playing';

    // Chọn từ đầu tiên ngẫu nhiên (đảm bảo có thể nối tiếp)
    room.currentWord = getRandomValidWord();
    room.usedWords.add(room.currentWord);
    room.wordHistory.push({
      word: room.currentWord,
      player: 'Hệ thống',
      timestamp: Date.now()
    });

    io.to(socket.roomCode).emit('gameStarted', {
      currentWord: room.currentWord,
      currentPlayer: room.players[room.currentPlayerIndex],
      players: getRoomPublicData(room).players,
      nextSyllable: getLastSyllable(room.currentWord)
    });

    startTurnTimer(socket.roomCode);
    console.log(`🎮 Game bắt đầu phòng ${socket.roomCode}, từ đầu: ${room.currentWord}`);
  });

  // Gửi từ
  socket.on('submitWord', ({ word }) => {
    const room = rooms.get(socket.roomCode);
    if (!room || !room.gameStarted) return;

    const activePlayers = room.players.filter(p => !p.isEliminated);
    const activeIndex = room.currentPlayerIndex % activePlayers.length;
    // Fix: get current player from full list
    const currentPlayer = room.players[room.currentPlayerIndex];

    if (!currentPlayer || currentPlayer.id !== socket.id) {
      socket.emit('wordError', { message: '⚠️ Không phải lượt của bạn!' });
      return;
    }

    const wordClean = word.trim().toLowerCase();

    // Kiểm tra từ hợp lệ
    const expectedStart = getLastSyllable(room.currentWord);
    const wordStart = getFirstSyllable(wordClean);

    if (wordStart !== expectedStart) {
      socket.emit('wordError', {
        message: `❌ Từ phải bắt đầu bằng "${expectedStart}"!`
      });
      return;
    }

    if (room.usedWords.has(wordClean)) {
      socket.emit('wordError', { message: '🔄 Từ này đã được dùng rồi!' });
      return;
    }

    if (!isValidWord(wordClean)) {
      socket.emit('wordError', { message: '📖 Từ này không có trong từ điển!' });
      return;
    }

    // Kiểm tra từ chết (dead word)
    if (!canContinueFrom(wordClean)) {
      // Từ chết - người chơi này THẮNG!
      clearTurnTimer(socket.roomCode);
      room.usedWords.add(wordClean);
      room.currentWord = wordClean;
      currentPlayer.score++;
      
      room.wordHistory.push({
        word: wordClean,
        player: currentPlayer.username,
        playerId: socket.id,
        timestamp: Date.now(),
        isDeadWord: true
      });

      // Kết thúc trò chơi - người chơi này thắng
      room.gameStarted = false;
      room.status = 'finished';

      io.to(socket.roomCode).emit('deadWordWin', {
        word: wordClean,
        winner: { id: currentPlayer.id, username: currentPlayer.username },
        message: `🏆 ${currentPlayer.username} thắng!`,
        details: `🎯 Từ "${wordClean}" là dead word. Đối thủ không thể tiếp tục nối từ.`,
        players: getRoomPublicData(room).players,
        wordHistory: room.wordHistory
      });

      return;
    }

    // Từ hợp lệ!
    clearTurnTimer(socket.roomCode);
    room.usedWords.add(wordClean);
    room.currentWord = wordClean;
    currentPlayer.score++;

    room.wordHistory.push({
      word: wordClean,
      player: currentPlayer.username,
      playerId: socket.id,
      timestamp: Date.now()
    });

    io.to(socket.roomCode).emit('wordAccepted', {
      word: wordClean,
      player: { id: currentPlayer.id, username: currentPlayer.username },
      score: currentPlayer.score,
      players: getRoomPublicData(room).players,
      wordHistory: room.wordHistory.slice(-10)
    });

    nextTurn(socket.roomCode);
  });

  // Chat
  socket.on('chatMessage', ({ message }) => {
    const room = rooms.get(socket.roomCode);
    if (!room || !message?.trim()) return;
    io.to(socket.roomCode).emit('chatMessage', {
      username: socket.username || 'Ẩn danh',
      message: message.trim().substring(0, 200),
      timestamp: Date.now()
    });
  });

  // Chơi lại
  socket.on('restartGame', () => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player?.isHost) return;

    room.gameStarted = false;
    room.status = 'waiting';
    room.players.forEach(p => {
      p.lives = MAX_LIVES;
      p.score = 0;
      p.isEliminated = false;
    });

    io.to(socket.roomCode).emit('gameReset', { room: getRoomPublicData(room) });
  });

  // Ngắt kết nối
  socket.on('disconnect', () => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;

    const playerIdx = room.players.findIndex(p => p.id === socket.id);
    if (playerIdx === -1) return;

    const player = room.players[playerIdx];
    room.players.splice(playerIdx, 1);

    console.log(`👋 ${socket.username} rời phòng ${socket.roomCode}`);

    if (room.players.length === 0) {
      clearTurnTimer(socket.roomCode);
      rooms.delete(socket.roomCode);
      console.log(`🗑️ Xóa phòng ${socket.roomCode}`);
      return;
    }

    // Chuyển host nếu cần
    if (player.isHost && room.players.length > 0) {
      room.players[0].isHost = true;
    }

    io.to(socket.roomCode).emit('playerLeft', {
      username: player.username,
      room: getRoomPublicData(room)
    });

    if (room.gameStarted) {
      const remaining = room.players.filter(p => !p.isEliminated);
      if (remaining.length <= 1) {
        endGame(socket.roomCode);
        return;
      }

      // Adjust current player index
      if (room.currentPlayerIndex >= room.players.length) {
        room.currentPlayerIndex = 0;
      }

      if (room.players[room.currentPlayerIndex]?.id === socket.id) {
        nextTurn(socket.roomCode);
      }
    }
  });
});

// Hiển thị danh sách phòng (admin)
app.get('/api/rooms', (req, res) => {
  const data = [];
  rooms.forEach((room, code) => {
    data.push({
      code,
      players: room.players.length,
      status: room.status
    });
  });
  res.json(data);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🎮 ==========================================`);
  console.log(`🎮  GAME NỐI TỪ TIẾNG VIỆT`);
  console.log(`🎮  Server: http://localhost:${PORT}`);
  console.log(`🎮 ==========================================\n`);
});
