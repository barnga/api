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
    const { sessionId } = socket.handshake.query;

    gameList.addGame(game);
    gameList.games[gameId].addTeacher(sessionId, socket.id);
    fn({ success: true, gameId });
  });

  socket.on('join game', (values, fn) => {
    const { gameId, nickname } = values;
    const game = gameList.games[gameId];
    const { sessionId } = socket.handshake.query;

    if (game) {
      game.addPlayer(sessionId, socket.id, nickname);
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
  const { sessionId } = socket.handshake.query;

  if (game) {
    if (!game.teachers[sessionId] && !game.players[sessionId]) {
      socket.emit('redirect to join');
    } else {
      if (game.players[sessionId]) {
        game.players[sessionId].socketId = socket.id;
      }
      socket.emit('200');
      socket.nsp.emit('player update', game.getBasicPlayersData());
    }

    socket.on('start game', (fn) => {
      // TODO: Customize logic
      const hasMinimumPlayers = Object.keys(game.players).length > 2;
      fn({ hasMinimumPlayers });

      if (hasMinimumPlayers) {
        game.createRooms(2)
          .then(() => {
            Object.entries(game.rooms).forEach((room) => {
              const [roomId, players] = room;
              players.forEach((playerId) => game.players[playerId].joinRoom(roomId));
              const socketIds = players.map((playerId) => game.players[playerId].socketId);
              socketIds.forEach((socketId) => socket.nsp.connected[socketId].join(roomId));
            });
          });
        socket.nsp.emit('game started');
      }
    });

    socket.on('joined game', (fn) => {
      const roomId = game.players[socket.handshake.query.sessionId].room;
      const roomNumber = Object.keys(game.rooms).indexOf(roomId) + 1;
      fn({ roomNumber });
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
