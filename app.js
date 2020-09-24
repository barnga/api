const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { expressCspHeader, SELF, NONE } = require('express-csp-header');
const index = require('./routes/index');
const GameManager = require('./models/GameManager');
const Game = require('./models/Game');
const generateId = require('./helpers/generateId');

const port = process.env.PORT || 3000;
const app = express();

app.use(expressCspHeader({
  directives: {
    'default-src': [NONE],
    'connect-src': [SELF, 'https://www.barngaproject.net'],
    'script-src': [SELF],
  }
}));
app.use(cors());
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
    const game = new Game(gameId, values.playersPerRoom);
    const { sessionId } = socket.handshake.query;
    const { adminToken } = game;

    gameList.addGame(game);
    gameList.games[gameId].addTeacher(sessionId, socket.id, values.nickname || 'Admin');
    fn({ success: true, gameId, adminToken });

    console.log(gameList);
  });

  socket.on('join game', (values, emitFn) => {
    const { gameId, nickname } = values;
    const game = gameList.games[gameId];
    const { sessionId } = socket.handshake.query;

    if (game && !game.hasStarted) {
      game.addPlayer(sessionId, socket.id, nickname);
      emitFn({ success: true });
    } else if (game && game.hasStarted) {
      emitFn({
        success: false,
        message: 'This game has already started.'
      });
    } else {
      emitFn({
        success: false,
        message: 'The game with that code does not exist.'
      });
    }
  });

  socket.on('join admin', (values, emitFn) => {
    const {gameId, nickname, adminToken} = values;
    const game = gameList.games[gameId];
    const {sessionId} = socket.handshake.query;

    if (game && adminToken === game.adminToken && !game.hasStarted) {
      game.addTeacher(sessionId, socket.id, nickname);
      emitFn({ success: true, adminToken });
    } else if (game && adminToken !== game.adminToken && !game.hasStarted) {
      emitFn({
        success: false,
        message: 'Incorrect admin token.'
      });
    } else if (game && game.hasStarted) {
      emitFn({
        success: false,
        message: 'This game has already started.'
      });
    } else {
      emitFn({
        success: false,
        message: 'The game with that code does not exist.'
      });
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

  console.log(gameId);
  console.log(gameList);
  console.log(Object.keys(socket.nsp.connected));

  if (game) {
    // if (!game.teachers[sessionId] && !game.players[sessionId]) {
      // socket.emit('redirect to join');
    // } else {
      if (game.players[sessionId]) {
        game.players[sessionId].socketId = socket.id;
      } else if (game.teachers[sessionId]) {
        game.teachers[sessionId].socketId = socket.id;
      }
      socket.emit('200');
    // }

    socket.on('player loaded', () => {
      socket.nsp.emit('player update', game.getBasicPlayersData());
    });

    socket.on('start game', (emitFn) => {
      const hasMinimumPlayers = Object.keys(game.players).length >= game.roomSize;
      emitFn({ hasMinimumPlayers });

      if (hasMinimumPlayers) {
        game.hasStarted = true;
        game.createRooms()
          .then(() => new Promise((resolve) => {
            Object.keys(game.rooms).forEach((roomId) => {
              Object.keys(game.rooms[roomId].players).forEach((playerId) => {
                if (socket.nsp.connected[game.players[playerId].socketId]) {
                  game.players[playerId].joinRoom(roomId);
                  socket.nsp.connected[game.players[playerId].socketId].join(roomId);
                }
              })});
              resolve();
          }))
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
      console.log(Object.keys(socket.rooms));
      const roomId = Object.keys(socket.rooms)[1];
      const sender = game.players[sessionId];
      const messageData = {
        body: message,
        sender: sender,
        global: false,
      };

      socket.nsp.to(roomId).emit('messages update', messageData);

      // Send to teachers
      socket.nsp.emit('messages update room', {
        roomId: roomId,
        message: messageData,
      });
    });

    socket.on('new message global', (message) => {
      const sender = game.teachers[sessionId];
      const messageData = {
        body: message,
        sender: sender,
        global: true,
      };

      socket.nsp.emit('messages update', messageData);

      // Send to teacher
      Object.entries(game.rooms).forEach(([roomId, room]) => {
        socket.nsp.emit('messages update room', {
          roomId: roomId,
          message: messageData
        });
      });
    });

    socket.on('new message room', (data) => {
      const sender = game.teachers[sessionId];

      const message = {
        body: data.message,
        sender: sender,
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
      // Send to room
      const roomId = Object.keys(socket.rooms)[1];
      socket.nsp.to(roomId).emit('strokes update', stroke);

      // Send to teacher
      socket.nsp.emit('strokes update room', {
        roomId: roomId,
        stroke: stroke,
      });
    });

    const endRoomRound = (roomId) => {
      const room = game.rooms[roomId];
      const emitGameUpdate = () => socket.nsp.to(roomId).emit('game update', room.getBasicData());

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
          winner: null,
          votes: [],
        };
        emitGameUpdate();
      }, 5000);
    };

    socket.on('play card', (card) => {
      const roomId = game.players[sessionId].room;
      const room = game.rooms[roomId];

      room.playCard(sessionId, card)
        .then((isRoundEnd) => {
          socket.nsp.to(roomId).emit('game update', room.getBasicData());
          if (isRoundEnd) endRoomRound(roomId);
        });
    });

    socket.on('vote', (playerId) => {
      const roomId = game.players[sessionId].room;
      game.rooms[roomId].castVote(playerId).then((isVotingDone) => {
        if (isVotingDone) endRoomRound(roomId);
      });
    });

    socket.on('change rooms', () => game.changeRooms().then(async (updatedRooms) => {
      const updateRoomPromises = Object.entries(updatedRooms).map(async (updatedRoom, idx) => {
        const [roomId, players] = updatedRoom;
        game.rooms[roomId].players = players;

        const switchRoomPromises = Object.keys(players).map((playerId) => {
          return new Promise((resolve) => {
            const player = players[playerId];
            const playerSocket = socket.nsp.connected[player.socketId];

            playerSocket.leave(players[playerId].room, () => {
              playerSocket.join(roomId, () => {
                player.joinRoom(roomId);
                resolve();
              });
            });
          });
        });

        await Promise.all(switchRoomPromises);
      });

      await Promise.all(updateRoomPromises);
    })
        .then(() => game.resetRooms())
        .then(() => game.dealCardsToAllRooms(7))
        .then(() => {
          Object.keys(game.rooms).forEach((roomId) => {
            socket.nsp.to(roomId).emit('game update', game.rooms[roomId].getBasicData());
          });
        }));

    socket.on('disconnect', () => {
      console.log('socket has disconnected from game');
      // TODO: Close game if teacher disconnects
      // TODO: Remove player from game AND room if disconnect (otherwise round will never end)
      if (sessionId) {
        game.deletePlayer(sessionId);
        socket.nsp.emit('player update', game.getBasicPlayersData());
      }
      if (Object.keys(socket.nsp.connected).length === 0) {
        gameList.deleteGame(game);

        console.log('deleting game');
      }
    });
  } else {
    socket.emit('404', `Game ${gameId} does not exist`);
  }
});
