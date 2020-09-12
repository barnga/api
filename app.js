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
  socket.on('create game', (values, fn) => {
    const gameId = generateId(6);
    const game = new Game(gameId);
    const { sessionId } = socket.handshake.query;

    console.log(socket.id);
    gameList.addGame(game);
    gameList.games[gameId].addTeacher(sessionId, socket.id);
    fn({ success: true, gameId });
  });

  socket.on('join game', (values, emitFn) => {
    const { gameId, nickname } = values;
    const game = gameList.games[gameId];
    const { sessionId } = socket.handshake.query;

    // TODO: Stop player from joining if game is in session
    if (game) {
      game.addPlayer(sessionId, socket.id, nickname);
      emitFn({ success: true });
    } else {
      emitFn({ success: false });
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
      } else if (game.teachers[sessionId]) {
        game.teachers[sessionId].socketId = socket.id;
      }
      socket.emit('200');
    }

    socket.on('player loaded', () => {
      socket.nsp.emit('player update', game.getBasicPlayersData());
    });

    socket.on('start game', (emitFn) => {
      // TODO: Customize player number and rulesheet count
      const hasMinimumPlayers = Object.keys(game.players).length > 0;
      emitFn({ hasMinimumPlayers });
      if (hasMinimumPlayers) {
        game.createRooms(2)
          .then(() => {
            Object.keys(game.rooms).forEach((roomId) => {
              Object.keys(game.rooms[roomId].players).forEach((playerId) => {
                game.players[playerId].joinRoom(roomId);
                socket.nsp.connected[game.players[playerId].socketId].join(roomId);
              });
            });
          })
          .then(() => game.assignRulesheets(3))
          .then(() => game.dealCardsToAllRooms(7))
          .then(() => socket.nsp.emit('game started'));
      }
    });

    socket.on('joined room', (emitFn) => {
      const { room, hand } = game.players[sessionId];
      const roomData = game.rooms[room].getBasicData();
      emitFn({ hand, ...roomData });
    });

    socket.on('get rooms', (emitFn) => emitFn({ rooms: game.getBasicRoomsData() }));

    socket.on('new message', (message) => {
      const roomId = Object.keys(socket.rooms)[1];
      const senderName = game.players[sessionId].nickname || 'Anonymous';
      const messageData = {
        body: message,
        sender: senderName,
        global: false,
      };
      socket.nsp.to(roomId).emit('messages update', messageData);

      // Send to teacher
      socket.nsp.emit('messages update room', {
        roomId: roomId,
        message: messageData,
      });
    });

    socket.on('new message global', (message) => {
      socket.nsp.emit('messages update', {
        body: message,
        sender: 'Admin',
        global: true,
      });

      // Send to teacher
      Object.entries(game.rooms).forEach(([roomId, room]) => {
        socket.nsp.emit('messages update room', {
          roomId: roomId,
          message: {
            body: message,
            sender: 'Admin',
            global: true,
          }
        });
      });
    });

    socket.on('new message room', (data) => {
      const message = {
        body: data.message,
        sender: 'Admin',
        global: false
      };

      // Send to room
      socket.nsp.to(data.roomId).emit('messages update', message);

      // Send to teacher
      socket.nsp.emit('messages update room', {
        roomId: data.roomId,
        message: message,
      });
    });

    socket.on('strokes update', (stroke) => {
      const roomId = Object.keys(socket.rooms)[1];
      socket.nsp.to(roomId).emit('strokes update', stroke);
    });

    socket.on('play card', (card) => {
      const roomId = Object.keys(socket.rooms)[1];
      const room = game.rooms[roomId];
      const emitGameUpdate = () => socket.nsp.to(roomId).emit('game update', room.getBasicData());

      room.playCard(sessionId, card)
        .then((isRoundEnd) => {
          emitGameUpdate();

          if (isRoundEnd) {
            room.roundSettings = {
              ...room.roundSettings,
              disablePlayCard: true,
              showWinner: true,
            };
            emitGameUpdate();

            setTimeout(() => {
              room.clearPlayedCards();
              room.setPlayersWithCards();
              room.roundSettings = {
                ...room.roundSettings,
                disablePlayCard: false,
                showWinner: false,
              };
              emitGameUpdate();
            }, 5000);
          }
        });
    });

    socket.on('disconnect', () => {
      // TODO: Close game if teacher disconnects
      // TODO: Remove player from game AND room if disconnect (otherwise round will never end)
      if (sessionId) {
        game.deletePlayer(sessionId);
        const roomId = Object.keys(socket.rooms)[1];
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
