const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const index = require('./routes/index');
const GameManager = require('./models/GameManager');
const Game = require('./models/Game');
const generateId = require('./helpers/generateId');

const port = process.env.port || 3000;
const app = express();
app.use(index);

const server = http.createServer(app);
const io = socketIo(server);
const nsp = io.of(/\w+/);

server.listen(port, () => {
  console.log(`Listening on port ${port}`);
});

const gameList = new GameManager();

io.on('connection', (socket) => {
  console.log(gameList.games);

  socket.on('create game', (values, fn) => {
    const gameId = generateId(6);
    const game = new Game(gameId);

    gameList.addGame(game);
    fn({ success: true, gameId });
  });

  socket.on('join game', (values, fn) => {
    const { gameId, nickname } = values;
    const game = gameList.games[gameId];
    const { sessionId } = socket.handshake.query;

    if (game) {
      game.addPlayer(sessionId, nickname);
      fn({ success: true });
      io.of(`/${gameId}`).emit('player update', game.getBasicPlayersData());
    } else {
      fn({ success: false });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

nsp.on('connection', (socket) => {
  const gameId = socket.nsp['name'].split('/')[1];
  const game = gameList.games[gameId];
  const { sessionId, role } = socket.handshake.query;

  if (game) {
    if (!game.players[sessionId] && (role !== 'teacher')) {
      socket.emit('redirect to join');
    } else {
      socket.emit('200');
      socket.nsp.emit('player update', game.getBasicPlayersData());
      console.log(`Someone connected to Game ${socket.nsp.name}`);
    }

    socket.on('start game', (fn) => {
      const hasMinimumPlayers = Object.keys(game.players).length === 1;
      fn({ hasMinimumPlayers });
      if (hasMinimumPlayers) {
        socket.nsp.emit('game started');
      }
    });

    socket.on('disconnect', () => {
      if (sessionId) {
        game.deletePlayer(sessionId);
        socket.nsp.emit('player update', game.getBasicPlayersData());
      }
      if (Object.keys(socket.nsp.connected).length === 0) {
        gameList.deleteGame(game);
      }
    });
  } else {
    socket.emit('404', `Game ${gameId} does not exist`);
  }
});
