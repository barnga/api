const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const index = require('./routes/index');
const GameManager = require('./models/GameManager');
const Game = require('./models/Game');

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

const generateId = (length) => {
  let text = "";
  const charset = "abcdefghijklmnopqrstuvwxyz";
  for (let i = 0; i < length; i++) {
    text += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return text;
};

io.on('connection', (socket) => {
  console.log(gameList.games);

  socket.on('create game', (values, fn) => {
    const gameId = generateId(6);
    const game = new Game(`/${gameId}`);
    gameList.addGame(game);
    fn({ success: true, gameId });
  });

  socket.on('join game', (values, fn) => {
    const { gameId, nickname } = values;
    const game = gameList.games[`/${gameId}`];
    console.log(socket.handshake.query.sessionId);

    if (game) {
      fn({ success: true });
      game.addPlayer(socket.handshake.query.sessionId, nickname);
      io.of(`/${gameId}`).emit('update', game.players);
    } else {
      fn({ success: false });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

nsp.on('connection', (socket) => {
  const gameId = socket.nsp.name;
  const game = gameList.games[gameId];

  if (game) {
    console.log(`Someone connected to Game ${socket.nsp.name}`);

    socket.on('disconnect', () => {
      if (socket.id) {
        game.deletePlayer(socket.handshake.query.sessionId);
      }
    });
  } else {
    socket.emit('404', `Game ${gameId} does not exist`);
  }
});
